package org.homecontrol.frame;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.LruCache;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ConcurrentHashMap;

/** Network, JSON and bitmap work never run on Android's UI thread. */
final class FrameRepository {
    interface Listener {
        void dashboard(FrameData.Dashboard value);
        void month(FrameData.Month value);
        void weather(JSONObject value);
        void reminders(JSONObject value);
        void connection(boolean online);
        void accessRequired();
        void photoSettings(PhotoSettings value);
    }
    interface PhotoCallback { void loaded(Bitmap bitmap); }
    private final String address, token;
    private final Context context;
    private final Listener listener;
    private final File cache;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ScheduledExecutorService network = Executors.newSingleThreadScheduledExecutor();
    private final ExecutorService images = Executors.newFixedThreadPool(2);
    private final Set<HttpURLConnection> connections = Collections.synchronizedSet(new HashSet<>());
    private final Map<String, String> revisions = new ConcurrentHashMap<>();
    private volatile Set<String> visibleMonths = Collections.emptySet();
    private volatile boolean closed, authorized = true;
    private int polls;
    private final LruCache<String, Bitmap> bitmaps = new LruCache<String, Bitmap>(16 * 1024 * 1024) {
        @Override protected int sizeOf(String key, Bitmap value) { return value.getAllocationByteCount(); }
    };

    static String validAddress(String input) {
        try {
            URI uri = new URI(input.trim());
            if (!("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) || uri.getHost() == null
                    || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null)
                throw new IllegalArgumentException();
            return new URI(uri.getScheme(), null, uri.getHost(), uri.getPort(), null, null, null).toString();
        } catch (Exception error) { throw new IllegalArgumentException("Enter your Mac’s complete http:// or https:// address."); }
    }
    FrameRepository(Context context, String address, String token, Listener listener) {
        this.context = context.getApplicationContext();
        this.address = validAddress(address); this.token = token; this.listener = listener;
        String namespace;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest((this.address + "\n" + token).getBytes("UTF-8"));
            StringBuilder hex = new StringBuilder();
            for (byte value : digest) hex.append(String.format("%02x", value));
            namespace = hex.toString();
        } catch (Exception error) { throw new IllegalStateException(error); }
        cache = new File(context.getCacheDir(), "native-frame/" + namespace);
        cache.mkdirs();
    }
    void start() {
        network.execute(() -> {
            restore("dashboard", "/api/dashboard"); restore("weather", "/api/weather"); restore("reminders", "/api/reminders");
            restore("photo-settings", "/api/photo-settings");
        });
        network.scheduleWithFixedDelay(this::poll, 0, 5, TimeUnit.SECONDS);

    }
    void refresh() { if (!closed) network.execute(this::poll); }
    void months(Set<String> months) {
        Set<String> next = new HashSet<>(months);
        if (next.equals(visibleMonths)) return;
        visibleMonths = next;
        if (!closed) network.execute(() -> {
            for (String month : next) {
                if (!month.matches("(19|20|21)\\d{2}-(0[1-9]|1[0-2])")) continue;
                restore("month-" + month, "/api/calendar/" + month);
                fetch("month-" + month, "/api/calendar/" + month);
            }
        });
    }
    private void poll() {
        if (closed || !authorized) return;
        boolean ok = fetch("dashboard", "/api/dashboard");
        post(() -> listener.connection(ok));
        if (polls % 3 == 0) {
            fetch("reminders", "/api/reminders");
            fetch("photo-settings", "/api/photo-settings");
        }
        if (polls % 12 == 0) fetch("weather", "/api/weather");
        for (String month : visibleMonths) fetch("month-" + month, "/api/calendar/" + month);
        polls++;
    }
    private boolean fetch(String key, String endpoint) {
        if (!authorized || closed) return false;
        try {
            byte[] bytes = request(endpoint, null, 16 * 1024 * 1024);
            JSONObject json = new JSONObject(new String(bytes, "UTF-8"));
            if (key.startsWith("month-") && !"ready".equals(FrameData.state(json, "status"))) {
                // Keep a ready month on screen during export/revision changes.
                if ("denied".equals(FrameData.state(json, "status"))) deliver(key, json);
                else if (!revisions.containsKey(key)) deliver(key, json);
                return true;
            }
            deliver(key, json);
            write(new File(cache, key + ".json"), bytes);
            return true;
        } catch (Exception error) { return false; }
    }
    private void restore(String key, String endpoint) {
        if (revisions.containsKey(key) || closed) return;
        File file = new File(cache, key + ".json");
        if (!file.exists()) return;
        try { deliver(key, new JSONObject(new String(read(new FileInputStream(file), 16 * 1024 * 1024), "UTF-8"))); }
        catch (Exception ignored) { /* An incomplete cache never blocks a live refresh. */ }
    }
    private void deliver(String key, JSONObject json) throws Exception {
        JSONObject content = new JSONObject(json.toString());
        content.remove("generatedAt"); content.remove("observedAt");
        String fingerprint = content.toString();
        if (fingerprint.equals(revisions.get(key))) return;
        if (key.equals("dashboard")) {
            FrameData.Dashboard value = new FrameData.Dashboard(json);
            post(() -> listener.dashboard(value));
        } else if (key.equals("photo-settings")) {
            PhotoSettings value = new PhotoSettings(json);
            post(() -> listener.photoSettings(value));
        } else if (key.startsWith("month-")) {
            FrameData.Month value = new FrameData.Month(json);
            post(() -> listener.month(value));
        } else if (key.equals("weather")) post(() -> listener.weather(json));
        else if (key.equals("reminders")) post(() -> listener.reminders(json));
        revisions.put(key, fingerprint);
    }
    void savePhotoSettings(PhotoSettings settings, PhotoSettings.Saved callback) {
        if (closed) { post(() -> callback.finished(false)); return; }
        network.execute(() -> {
            boolean success = false;
            try {
                byte[] bytes = request("/api/photo-settings", settings.json().toString(), 4096);
                JSONObject result = new JSONObject(new String(bytes, "UTF-8"));
                deliver("photo-settings", result);
                write(new File(cache, "photo-settings.json"), bytes);
                success = true;
            } catch (Exception ignored) { /* Keep current settings until the server confirms the save. */ }
            final boolean saved = success;
            post(() -> callback.finished(saved));
        });
    }
    void photo(FrameData.Photo photo, PhotoCallback callback) {
        if (closed) return;
        Bitmap cached = bitmaps.get(photo.id);
        if (cached != null) { post(() -> callback.loaded(cached)); return; }
        images.execute(() -> {
            try {
                File file = new File(cache, "photo-" + photo.id + ".jpg");
                if (!file.exists()) write(file, request("/api/photos/" + photo.id, null, 20 * 1024 * 1024));
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inJustDecodeBounds = true;
                BitmapFactory.decodeFile(file.toString(), options);
                if (options.outWidth <= 0 || options.outHeight <= 0) { file.delete(); throw new IOException("Invalid image"); }
                options.inSampleSize = 1;
                while (options.outWidth / options.inSampleSize > 1600 || options.outHeight / options.inSampleSize > 1600) options.inSampleSize *= 2;
                options.inJustDecodeBounds = false;
                Bitmap bitmap = BitmapFactory.decodeFile(file.toString(), options);
                if (bitmap == null) throw new IOException("Image decode failed");
                bitmaps.put(photo.id, bitmap);
                post(() -> callback.loaded(bitmap));
                prunePhotos();
            } catch (Exception error) { post(() -> callback.loaded(null)); }
        });
    }
    private synchronized void prunePhotos() {
        File[] files = cache.listFiles((directory, name) -> name.startsWith("photo-") && name.endsWith(".jpg"));
        if (files == null) return;
        Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
        long total = 0;
        for (File file : files) { total += file.length(); if (total > 64 * 1024 * 1024) file.delete(); }
    }
    private byte[] request(String endpoint, String body, int limit) throws Exception {
        if (closed || !authorized) throw new IOException("Stopped");
        HttpURLConnection connection = (HttpURLConnection)new URL(address + endpoint).openConnection();
        connections.add(connection);
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(5000); connection.setReadTimeout(10000);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        try {
            if (body != null) {
                connection.setRequestMethod("POST"); connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                byte[] bytes = body.getBytes("UTF-8"); connection.setFixedLengthStreamingMode(bytes.length);
                try (java.io.OutputStream output = connection.getOutputStream()) { output.write(bytes); }
            }
            int status = connection.getResponseCode();
            if (status == 401) {
                authorized = false;
                main.post(() -> { if (!closed) listener.accessRequired(); });
                throw new IOException("Pairing required");
            }
            if (status != 200) throw new IOException("Frame server unavailable");
            return read(connection.getInputStream(), limit);
        } finally { connection.disconnect(); connections.remove(connection); }
    }
    private static byte[] read(InputStream input, int limit) throws IOException {
        try (InputStream source = input; ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16384]; int count;
            while ((count = source.read(buffer)) != -1) {
                if (bytes.size() + count > limit) throw new IOException("Response too large");
                bytes.write(buffer, 0, count);
            }
            return bytes.toByteArray();
        }
    }
    private static void write(File destination, byte[] bytes) throws IOException {
        File temporary = new File(destination + "." + Thread.currentThread().getId() + ".tmp");
        try (FileOutputStream output = new FileOutputStream(temporary)) { output.write(bytes); }
        if (!temporary.renameTo(destination)) temporary.delete();
    }
    private void post(Runnable work) { main.post(() -> { if (!closed && authorized) work.run(); }); }
    void close() {
        closed = true; network.shutdownNow(); images.shutdownNow(); bitmaps.evictAll();
        synchronized (connections) { for (HttpURLConnection connection : connections) connection.disconnect(); }
    }
}
