package org.homecontrol.frame;

import android.app.Instrumentation;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.TextView;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.util.TimeZone;

/** Emulator-only checks against the real server's fictional demo. */
public final class FrameSmokeTests extends Instrumentation {
    private String server, code;
    @Override public void onCreate(Bundle args) { server = args.getString("server", "http://127.0.0.1:8798"); code = args.getString("code"); start(); }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            check(code != null, "Supply the demo pairing code");
            getTargetContext().getSharedPreferences("homeframe", 0).edit().clear().commit();
            Intent intent = new Intent(getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            MainActivity activity = (MainActivity)startActivitySync(intent);
            View decor = activity.getWindow().getDecorView();
            await(() -> find(decor, "Connect") != null && decor.getWidth() > 0, "Pairing form did not appear");
            waitForIdleSync(); SystemClock.sleep(1000); capture("android-pairing.png");
            runOnMainSync(() -> {
                find(decor, "Enter Mac address manually").performClick();
                ((EditText)find(decor, "Mac address")).setText(server);
                ((EditText)find(decor, "Pairing code")).setText(code.replace("-", ""));
                check(((EditText)find(decor, "Pairing code")).getText().toString().equals(PairingCode.display(code)), "Code did not format");
                find(decor, "Connect").performClick();
            });
            await(() -> activity.home != null && "demo-landscape".equals(activity.home.photoPane.currentId()), "Pairing or photo loading failed");
            await(() -> find(activity.home, "London") != null, "Weather location from Mac missing");
            await(() -> find(activity.home, "Recycling collection — Today") != null, "Trash schedule did not decode");
            check(!containsWebView(activity.home), "Android unexpectedly includes browser UI");
            Rect calendar = new Rect(), photo = new Rect();
            runOnMainSync(() -> { activity.home.calendar.getGlobalVisibleRect(calendar); activity.home.photoPane.getGlobalVisibleRect(photo); });
            check(calendar.width() > 0 && calendar.height() > 100 && photo.width() > 0, "Empty native layout");
            waitForIdleSync(); SystemClock.sleep(500); capture("android-frame.png");
            int calendarHeight = calendar.height();
            runOnMainSync(() -> activity.home.calendar.move(1));
            await(() -> activity.home.supplement.getVisibility() == View.INVISIBLE, "Weather/collection did not fade while browsing");
            check(activity.home.calendar.getHeight() == calendarHeight, "Calendar resized instead of extending behind details");
            waitForIdleSync(); capture("android-calendar.png");
            runOnMainSync(() -> activity.home.calendar.goToday());
            await(() -> activity.home.supplement.getVisibility() == View.VISIBLE && activity.home.supplement.getAlpha() > .99f, "Today did not restore weather/collection");
            final JSONObject fahrenheit = new JSONObject("{\"state\":\"ready\",\"unit\":\"fahrenheit\",\"label\":\"Sample city\",\"temperature\":72,\"weatherCode\":0,\"isDay\":true,\"forecast\":[]}");
            runOnMainSync(() -> activity.home.weather(fahrenheit));
            await(() -> find(activity.home, "Sample city") != null && find(activity.home, "Today: Clear skies, 72° F now") != null, "Weather location/units hardcoded");
            JSONObject settings = new JSONObject("{\"settings\":{\"bins\":{\"enabled\":true,\"collectionDay\":3,\"anchorDate\":\"2026-10-14\",\"weeks\":[[\"recycling\"],[\"trash\"]]}}}");
            TimeZone zone = TimeZone.getTimeZone("America/Toronto");
            check(FrameData.due(settings, FrameData.instant("2026-10-15T03:59:00Z"), zone).bins.get(0).equals("recycling"), "Collection changed before midnight");
            check(FrameData.due(settings, FrameData.instant("2026-10-15T04:00:00Z"), zone).bins.get(0).equals("trash"), "Collection did not rotate at midnight");
            check(FrameData.due(settings, FrameData.instant("2026-11-04T12:00:00Z"), zone).bins.get(0).equals("trash"), "DST changed collection rotation");
            runOnMainSync(activity::finish);
            result.putString("stream", "PASS: native pairing, formatted code, photo/calendar layout, collection decoding/rotation/DST, configurable weather, no WebView. Screenshots in cache.\n");
            finish(-1, result);
        } catch (Throwable failure) { result.putString("stream", "FAIL: " + failure + "\n"); finish(0, result); }
    }
    private void capture(String name) throws Exception {
        Bitmap bitmap = getUiAutomation().takeScreenshot();
        try (FileOutputStream output = new FileOutputStream(new File(getTargetContext().getCacheDir(), name))) { bitmap.compress(Bitmap.CompressFormat.PNG, 100, output); }
        bitmap.recycle();
    }
    private interface Check { boolean ready(); }
    private void await(Check check, String message) {
        long end = SystemClock.uptimeMillis() + 20000;
        while (SystemClock.uptimeMillis() < end) { final boolean[] ready = {false}; runOnMainSync(() -> ready[0] = check.ready()); if (ready[0]) return; SystemClock.sleep(100); }
        throw new AssertionError(message);
    }
    private static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
    private static View find(View view, String text) {
        if (text.contentEquals(view.getContentDescription() == null ? "" : view.getContentDescription()) || view instanceof TextView && text.contentEquals(((TextView)view).getText())) return view;
        if (view instanceof ViewGroup) for (int i = 0; i < ((ViewGroup)view).getChildCount(); i++) { View found = find(((ViewGroup)view).getChildAt(i), text); if (found != null) return found; }
        return null;
    }
    private static boolean containsWebView(View view) {
        if (view instanceof android.webkit.WebView) return true;
        if (view instanceof ViewGroup) for (int i = 0; i < ((ViewGroup)view).getChildCount(); i++) if (containsWebView(((ViewGroup)view).getChildAt(i))) return true;
        return false;
    }
}
