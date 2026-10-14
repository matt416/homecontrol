package org.homecontrol.frame;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Small Wi-Fi updater: authenticated requests, bounded downloads, and same-signer verification. */
final class FrameUpdater {
    private final Activity activity;
    private final SharedPreferences preferences;
    private final String address, token, deviceId;
    private final PackageInfo installed;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ScheduledExecutorService worker = Executors.newSingleThreadScheduledExecutor();
    private volatile boolean closed;
    private volatile HttpURLConnection connection;
    private volatile String status = "idle";
    private boolean foreground, ready, awaitingPermission;

    FrameUpdater(Activity activity, SharedPreferences preferences) throws Exception {
        this.activity = activity; this.preferences = preferences;
        address = FrameRepository.validAddress(preferences.getString("url", ""));
        token = preferences.getString("nativeToken", "");
        String saved = preferences.getString("updateDeviceId", "");
        if (saved.isEmpty()) { saved = UUID.randomUUID().toString(); preferences.edit().putString("updateDeviceId", saved).apply(); }
        deviceId = saved;
        installed = activity.getPackageManager().getPackageInfo(activity.getPackageName(), PackageManager.GET_SIGNATURES);
        worker.scheduleWithFixedDelay(() -> check(false), 2, 30, TimeUnit.SECONDS);
    }
    void checkNow() { if (!closed) { message("Checking for a frame update…"); worker.execute(() -> check(true)); } }
    void active(boolean value) {
        foreground = value;
        if (value && ready && (!awaitingPermission || Build.VERSION.SDK_INT < 26 || activity.getPackageManager().canRequestPackageInstalls())) install();
    }
    void close() {
        closed = true; worker.shutdownNow(); main.removeCallbacksAndMessages(null);
        HttpURLConnection current = connection; if (current != null) current.disconnect();
    }
    private JSONObject report() throws Exception {
        JSONObject body = new JSONObject().put("deviceId", deviceId).put("versionCode", installed.versionCode)
                .put("versionName", installed.versionName).put("status", status);
        HttpURLConnection request = open("/api/frame-update/check");
        try {
            request.setRequestMethod("POST"); request.setDoOutput(true); request.setRequestProperty("Content-Type", "application/json");
            byte[] data = body.toString().getBytes("UTF-8"); request.setFixedLengthStreamingMode(data.length);
            try (java.io.OutputStream output = request.getOutputStream()) { output.write(data); }
            if (request.getResponseCode() != 200) throw new java.io.IOException("Update status unavailable");
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (InputStream input = request.getInputStream()) {
                byte[] buffer = new byte[4096]; int count;
                while ((count = input.read(buffer)) != -1) { if (output.size() + count > 16384) throw new java.io.IOException("Status too large"); output.write(buffer, 0, count); }
            }
            return new JSONObject(output.toString("UTF-8"));
        } finally { request.disconnect(); connection = null; }
    }
    private HttpURLConnection open(String path) throws Exception {
        if (closed) throw new java.io.IOException("Closed");
        HttpURLConnection request = (HttpURLConnection) new URL(address + path).openConnection();
        connection = request; request.setConnectTimeout(6000); request.setReadTimeout(15000);
        request.setInstanceFollowRedirects(false); request.setRequestProperty("Authorization", "Bearer " + token);
        return request;
    }
    private void check(boolean manual) {
        if (closed) return;
        try {
            JSONObject response = report(); JSONObject release = response.optJSONObject("release");
            if (release == null) { if (manual) message("No frame update has been published on your Mac yet."); return; }
            int version = release.getInt("versionCode");
            if (version <= installed.versionCode) { if (manual) message("HomeControl " + installed.versionName + " is up to date."); return; }
            JSONObject request = response.optJSONObject("request");
            String requestId = request == null ? "" : request.optString("id", "");
            boolean requested = !requestId.isEmpty() && !requestId.equals(preferences.getString("handledUpdateRequest", ""));
            if (!manual && !requested) return;
            if (requested) preferences.edit().putString("handledUpdateRequest", requestId).commit();
            status = "downloading"; report();
            message("Downloading HomeControl " + release.getString("versionName") + "…");
            download(release);
            status = "ready"; report();
            main.post(() -> { if (!closed) { ready = true; if (foreground) install(); } });
        } catch (Exception error) {
            if (closed) return;
            // A failed explicit update stays retryable from either Settings or a new Mac request.
            boolean failedUpdate = "downloading".equals(status) || "ready".equals(status);
            if (failedUpdate) { status = "error"; try { report(); } catch (Exception ignored) {} }
            if (manual || failedUpdate) message("Update could not finish. Keep the frame on Wi-Fi and try Send Update again on the Mac.");
        }
    }
    private void download(JSONObject release) throws Exception {
        long size = release.getLong("size"); String expectedHash = release.getString("sha256");
        if (size < 1 || size > 32 * 1024 * 1024 || !expectedHash.matches("[a-f0-9]{64}")) throw new java.io.IOException("Invalid release");
        File temporary = new File(activity.getCacheDir(), "frame-update.part");
        HttpURLConnection request = open("/api/frame-update/apk");
        try {
            if (request.getResponseCode() != 200) throw new java.io.IOException("Download unavailable");
            MessageDigest digest = MessageDigest.getInstance("SHA-256"); long total = 0;
            try (InputStream input = request.getInputStream(); FileOutputStream output = new FileOutputStream(temporary)) {
                byte[] buffer = new byte[16384]; int count;
                while ((count = input.read(buffer)) != -1) {
                    total += count; if (closed || total > size) throw new java.io.IOException("Incomplete download");
                    output.write(buffer, 0, count); digest.update(buffer, 0, count);
                }
                output.getFD().sync();
            }
            StringBuilder hash = new StringBuilder(); for (byte value : digest.digest()) hash.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
            if (total != size || !expectedHash.equals(hash.toString())) throw new java.io.IOException("Update checksum mismatch");
            verifyPackage(temporary, release.getInt("versionCode"));
            File target = UpdatePackageProvider.apk(activity);
            if (!temporary.renameTo(target)) throw new java.io.IOException("Cannot stage update");
        } finally { temporary.delete(); request.disconnect(); connection = null; }
    }
    void verifyPackage(File file, int expectedVersion) throws Exception {
        PackageInfo update = activity.getPackageManager().getPackageArchiveInfo(file.getPath(), PackageManager.GET_SIGNATURES);
        if (update == null || !activity.getPackageName().equals(update.packageName) || update.versionCode != expectedVersion
                || update.versionCode <= installed.versionCode || signatures(installed).isEmpty() || !signatures(installed).equals(signatures(update)))
            throw new SecurityException("This is not a newer HomeControl update from the same signer");
    }
    private static Set<Signature> signatures(PackageInfo info) {
        Set<Signature> result = new HashSet<>();
        if (info.signatures != null) java.util.Collections.addAll(result, info.signatures);
        return result;
    }
    private void install() {
        if (closed || !foreground || !ready) return;
        try {
            if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
                awaitingPermission = true;
                message("Allow HomeControl to install updates, then return here.");
                activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName())));
                return;
            }
            awaitingPermission = false; ready = false;
            Uri packageUri = UpdatePackageProvider.URI;
            // Android 6's system installer only accepts file: URLs. Keep the
            // verified, public binary in the app's external cache for that path.
            if (Build.VERSION.SDK_INT < 24) {
                File directory = activity.getExternalCacheDir();
                if (directory == null) throw new java.io.IOException("Update storage unavailable");
                File legacy = new File(directory, "frame-update.apk");
                try (InputStream input = new java.io.FileInputStream(UpdatePackageProvider.apk(activity));
                     FileOutputStream output = new FileOutputStream(legacy)) {
                    byte[] buffer = new byte[16384]; int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    output.getFD().sync();
                }
                packageUri = Uri.fromFile(legacy);
            }
            Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE).setDataAndType(packageUri, "application/vnd.android.package-archive");
            intent.setClipData(ClipData.newRawUri("HomeControl update", packageUri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(intent); status = "installing";
            worker.execute(() -> { try { report(); } catch (Exception ignored) {} });
        } catch (Exception error) { android.util.Log.w("FrameUpdater", "Could not open the package installer", error); status = "error"; message("Could not open Android’s installer. Open frame settings and try Check for update again."); }
    }
    private void message(String text) { main.post(() -> { if (!closed) Toast.makeText(activity, text, Toast.LENGTH_LONG).show(); }); }
}
