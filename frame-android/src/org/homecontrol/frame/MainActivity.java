package org.homecontrol.frame;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.text.InputType;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Spinner;
import android.widget.ArrayAdapter;

/** Native Android frame, independently built from the browser client. */
public class MainActivity extends Activity {
    private final Handler handler = new Handler();
    private FrameRepository repository;
    private FrameUpdater updater;
    private PairingView pairing;
    NativeHomeView home;
    private SharedPreferences preferences;
    private AlertDialog dialog;
    private boolean foreground, holdArmed;
    private final float[] holdX = new float[2], holdY = new float[2];
    private final int[] holdIds = new int[2];
    private final Runnable hold = () -> { holdArmed = false; showSettings(); };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        preferences = getSharedPreferences("homeframe", MODE_PRIVATE);
        connect();
    }
    private void connect() {
        if (updater != null) { updater.close(); updater = null; }
        if (pairing != null) { pairing.close(); pairing = null; }
        if (repository != null) repository.close();
        if (home != null) home.active(false);
        String token = preferences.getString("nativeToken", "");
        if (token.isEmpty()) {
            home = null; showPairing(); return;
        }
        home = new NativeHomeView(this, () -> {
            if (repository != null) repository.close();
            preferences.edit().remove("nativeToken").apply(); connect();
        }, settings -> { settings.save(preferences); applyPhotoSettings(); });
        setContentView(home);
        home.photoPane.setOnLongClickListener(view -> { showPhotoSettings(); return true; });
        applyPhotoSettings();
        try {
            repository = new FrameRepository(this, preferences.getString("url", ""), token, home);
            home.repository(repository); repository.start(); home.photoPane.paused(preferences.getBoolean("photosPaused", false)); home.active(foreground);
            try { updater = new FrameUpdater(this, preferences); updater.active(foreground); }
            catch (Exception error) { android.widget.Toast.makeText(this, "Frame updates could not start. Reconnect to try again.", android.widget.Toast.LENGTH_LONG).show(); }

        } catch (IllegalArgumentException error) { showPairing(); }
    }
    private void showPairing() {
        if (isFinishing()) return;
        if (updater != null) { updater.close(); updater = null; }
        if (repository != null) { repository.close(); repository = null; }
        if (home != null) { home.active(false); home = null; }
        if (pairing != null) pairing.close();
        pairing = new PairingView(this, preferences.getString("url", ""), (url, token) -> {
            preferences.edit().putString("url", url).putString("nativeToken", token).apply(); connect();
        });
        setContentView(pairing);
    }
    private void showSettings() {
        if (isFinishing() || dialog != null && dialog.isShowing() || home == null) return;
        boolean paused = preferences.getBoolean("photosPaused", false);
        dialog = new AlertDialog.Builder(this).setTitle("HomeControl")
                .setItems(new String[]{"Refresh", "Photo settings", paused ? "Play slideshow" : "Pause slideshow", "Disconnect", "Open-source licences", "Check for update", "Exit frame"}, (selected, choice) -> {
                    if (choice == 0 && repository != null) repository.refresh();
                    else if (choice == 1) handler.post(this::showPhotoSettings);
                    else if (choice == 2) { preferences.edit().putBoolean("photosPaused", !paused).apply(); if (home != null) home.photoPane.paused(!paused); }
                    else if (choice == 3) { preferences.edit().remove("nativeToken").apply(); handler.post(this::connect); }
                    else if (choice == 4) handler.post(this::showLicences);
                    else if (choice == 5 && updater != null) updater.checkNow();
                    else if (choice == 6) moveTaskToBack(true);
                }).setNegativeButton("Close", null).create(); dialog.show();
    }
    private void showLicences() {
        try {
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            try (java.io.InputStream input = getAssets().open("NOTICE.txt")) {
                byte[] buffer = new byte[4096]; int count;
                while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
            }
            TextView text = new TextView(this); text.setText(bytes.toString("UTF-8")); text.setPadding(24, 24, 24, 24);
            android.widget.ScrollView scroll = new android.widget.ScrollView(this); scroll.addView(text);
            dialog = new AlertDialog.Builder(this).setTitle("Open-source licences").setView(scroll).setPositiveButton("Close", null).create(); dialog.show();
        } catch (java.io.IOException ignored) { }
    }
    private void applyPhotoSettings() {
        if (home != null) home.photoPane.configure(preferences.getLong("photoDurationMillis", 15000),
                preferences.getLong("photoTransitionMillis", 220), preferences.getBoolean("photoShuffle", true));
    }
    private EditText photoNumber(LinearLayout form, String label, long value) {
        TextView title = new TextView(this); title.setText(label); title.setPadding(0, 12, 0, 0); form.addView(title);
        EditText input = new EditText(this); input.setSingleLine(true); input.setContentDescription(label);
        input.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        input.setText(String.valueOf(value / 1000.0)); form.addView(input); return input;
    }
    private void showPhotoSettings() {
        if (isFinishing() || dialog != null && dialog.isShowing()) return;
        LinearLayout form = new LinearLayout(this); form.setOrientation(LinearLayout.VERTICAL); form.setPadding(32, 8, 32, 8);
        EditText duration = photoNumber(form, "Time per photo (seconds)", preferences.getLong("photoDurationMillis", 15000));
        EditText transition = photoNumber(form, "Transition duration (seconds)", preferences.getLong("photoTransitionMillis", 220));
        TextView label = new TextView(this); label.setText("Photo order"); label.setPadding(0, 12, 0, 0); form.addView(label);
        Spinner order = new Spinner(this); order.setContentDescription("Photo order");
        ArrayAdapter<String> choices = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, new String[]{"Random", "Custom order (set on Mac)"});
        choices.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item); order.setAdapter(choices);
        order.setSelection(preferences.getBoolean("photoShuffle", true) ? 0 : 1); form.addView(order);
        form.setFocusableInTouchMode(true); form.requestFocus();
        dialog = new AlertDialog.Builder(this).setTitle("Photo settings").setMessage("Shared with HomeControl on your Mac. Time per photo includes its transition.").setView(form)
                .setNegativeButton("Cancel", null).setPositiveButton("Save", null).create();
        dialog.setOnShowListener(unused -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            double seconds, fade;
            try { seconds = Double.parseDouble(duration.getText().toString()); } catch (NumberFormatException error) { seconds = Double.NaN; }
            try { fade = Double.parseDouble(transition.getText().toString()); } catch (NumberFormatException error) { fade = Double.NaN; }
            if (!(seconds >= 1 && seconds <= 3600)) { duration.setError("Enter 1 to 3600 seconds."); return; }
            if (!(fade >= 0 && fade <= 5 && fade < seconds)) { transition.setError("Enter 0 to 5 seconds, shorter than the photo duration."); return; }
            if (repository == null) return;
            final AlertDialog settingsDialog = dialog;
            settingsDialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
            repository.savePhotoSettings(new PhotoSettings(seconds, fade, order.getSelectedItemPosition() == 0 ? "random" : "custom"), success -> {
                if (isFinishing()) return;
                settingsDialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
                if (success) settingsDialog.dismiss();
                else android.widget.Toast.makeText(this, "Could not save to your Mac. Check the connection and try again.", android.widget.Toast.LENGTH_LONG).show();
            });
        }));
        dialog.show();
    }
    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_POINTER_DOWN:
                if (event.getPointerCount() == 2) {
                    for (int index = 0; index < 2; index++) { holdIds[index] = event.getPointerId(index); holdX[index] = event.getX(index); holdY[index] = event.getY(index); }
                    holdArmed = true; handler.removeCallbacks(hold); handler.postDelayed(hold, 1500);
                } else cancelHold();
                break;
            case MotionEvent.ACTION_MOVE:
                if (holdArmed) for (int index = 0; index < 2; index++) {
                    int pointer = event.findPointerIndex(holdIds[index]);
                    if (pointer < 0 || Math.hypot(event.getX(pointer) - holdX[index], event.getY(pointer) - holdY[index]) > 60) cancelHold();
                }
                break;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_POINTER_UP:
            case MotionEvent.ACTION_CANCEL: cancelHold(); break;
        }
        return super.dispatchTouchEvent(event);
    }
    private void cancelHold() { holdArmed = false; handler.removeCallbacks(hold); }
    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
    @Override protected void onResume() { super.onResume(); foreground = true; if (updater != null) updater.active(true); if (home != null) home.active(true); }
    @Override protected void onPause() { foreground = false; if (updater != null) updater.active(false); cancelHold(); if (home != null) home.active(false); super.onPause(); }
    @Override protected void onDestroy() { handler.removeCallbacksAndMessages(null); if (updater != null) updater.close(); if (pairing != null) pairing.close(); if (repository != null) repository.close(); super.onDestroy(); }
    @Override public void onBackPressed() { if (home == null || !home.closeFullScreenPhoto()) showSettings(); }
}
