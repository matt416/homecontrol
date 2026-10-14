package org.homecontrol.frame;

import android.content.Context;
import android.os.Handler;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.AbsoluteSizeSpan;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Set;
import java.util.TimeZone;

/** Native translation of the existing frame stylesheet; no WebView or JavaScript. */
final class NativeHomeView extends FrameLayout implements FrameRepository.Listener {
    interface Actions { void accessRequired(); }
    private final FrameStyle style;
    final PhotoPane photoPane;
    final CalendarPane calendar;
    private final TextView clock, date, todayButton, connection;
    private final LinearLayout reminders, weather, details;
    final LinearLayout supplement;
    private boolean calendarBrowsing;
    private boolean showingToday;
    private final Handler handler = new Handler();
    private FrameRepository repository;
    private final Actions actions;
    private final PhotoSettings.Listener photoSettingsChanged;
    private JSONObject reminderData, weatherData;
    private TimeZone zone = TimeZone.getDefault();
    private String reminderKey = "", weatherKey = "";
    private boolean active, fullScreenPhoto, online = true;
    private Set<String> pendingMonths;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            updateClock(); calendar.tick(System.currentTimeMillis()); updateReminders(); updateWeather();
            if (active) handler.postDelayed(this, 60000 - System.currentTimeMillis() % 60000);
        }
    };

    NativeHomeView(Context context, Actions actions, PhotoSettings.Listener photoSettingsChanged) {
        super(context); this.actions = actions; this.photoSettingsChanged = photoSettingsChanged; setBackgroundColor(FrameStyle.BACKGROUND);
        int screenWidth = Math.max(getResources().getDisplayMetrics().widthPixels, getResources().getDisplayMetrics().heightPixels);
        style = new FrameStyle(context, screenWidth / 1280f);
        LinearLayout halves = style.row(); halves.setGravity(Gravity.TOP); addView(halves, new LayoutParams(-1, -1));
        photoPane = new PhotoPane(context); halves.addView(photoPane, new LinearLayout.LayoutParams(0, -1, 1));
        LinearLayout right = style.column(); right.setPadding(style.px(38.4f), style.px(36), style.px(38.4f), style.px(18));
        details = right;
        halves.addView(right, new LinearLayout.LayoutParams(0, -1, 1));
        photoPane.setOnClickListener(view -> {
            if (photoPane.currentId() != null) fullScreenPhoto(!fullScreenPhoto);
        });
        clock = style.text("", 72, 800, FrameStyle.WHITE); clock.setLetterSpacing(-.065f); clock.setFontFeatureSettings("tnum");
        clock.setSingleLine(true); clock.setIncludeFontPadding(true);
        LinearLayout clockRow = style.row(); right.addView(clockRow, new LinearLayout.LayoutParams(-1, -2));
        clockRow.addView(clock, new LinearLayout.LayoutParams(0, -2, 1));
        reminders = style.row(); reminders.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        clockRow.addView(reminders, new LinearLayout.LayoutParams(-2, style.px(48))); reminders.setVisibility(GONE);
        LinearLayout toolbar = style.row(); LinearLayout.LayoutParams toolbarParams = new LinearLayout.LayoutParams(-1, style.px(44));
        toolbarParams.topMargin = style.px(6); toolbarParams.bottomMargin = style.px(12); right.addView(toolbar, toolbarParams);
        date = style.text("", 19, true, FrameStyle.WHITE); date.setSingleLine(true); toolbar.addView(date, new LinearLayout.LayoutParams(0, -1, 1));
        ImageView back = arrow(R.drawable.icon_chevronleft, "Previous three days"); toolbar.addView(back);
        todayButton = style.text("Today", 14, true, FrameStyle.WHITE); todayButton.setGravity(Gravity.CENTER); todayButton.setPadding(style.px(12), 0, style.px(12), 0);
        todayButton.setBackground(FrameStyle.feedback()); todayButton.setAlpha(0); todayButton.setEnabled(false); todayButton.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO); toolbar.addView(todayButton, new LinearLayout.LayoutParams(-2, -1));
        ImageView next = arrow(R.drawable.icon_chevronright, "Next three days"); toolbar.addView(next);
        supplement = style.column();
        View fade = new View(context);
        fade.setBackground(new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM, new int[]{0x00050505, FrameStyle.BACKGROUND}));
        supplement.addView(fade, new LinearLayout.LayoutParams(-1, style.px(40)));
        calendar = new CalendarPane(context, style, (atToday, browsing, months) -> {
            showTodayButton(!atToday || browsing); pendingMonths = months;
            browseCalendar(browsing);
            if (repository != null) repository.months(months);
        });
        FrameLayout agenda = new FrameLayout(context);
        right.addView(agenda, new LinearLayout.LayoutParams(-1, 0, 1));
        agenda.addView(calendar, new LayoutParams(-1, -1));
        agenda.addView(supplement, new LayoutParams(-1, -2, Gravity.BOTTOM));
        back.setOnClickListener(view -> calendar.move(-1)); next.setOnClickListener(view -> calendar.move(1));
        todayButton.setOnClickListener(view -> calendar.goToday());
        weather = style.column(); weather.setBackgroundColor(FrameStyle.BACKGROUND);
        LinearLayout.LayoutParams weatherParams = new LinearLayout.LayoutParams(-1, style.px(168));
        supplement.addView(weather, weatherParams);
        connection = style.text("Connection lost. Showing the last update; trying again shortly.", 14, true, 0xff16100a);
        connection.setPadding(style.px(24), style.px(12), style.px(24), style.px(12)); connection.setBackgroundColor(0xffffc566);
        LayoutParams alert = new LayoutParams(-1, -2, Gravity.BOTTOM); addView(connection, alert); connection.setVisibility(GONE);
        updateClock(); updateWeather();
    }
    private void browseCalendar(boolean browsing) {
        if (calendarBrowsing == browsing) return;
        calendarBrowsing = browsing;
        supplement.animate().cancel();
        supplement.setVisibility(VISIBLE);
        supplement.setImportantForAccessibility(browsing ? IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS : IMPORTANT_FOR_ACCESSIBILITY_AUTO);
        float scale = android.provider.Settings.Global.getFloat(getContext().getContentResolver(), android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, 1f);
        supplement.animate().alpha(browsing ? 0f : 1f).setDuration(scale == 0 ? 0 : 240).withLayer()
                .setInterpolator(new android.view.animation.PathInterpolator(.22f, 1f, .36f, 1f))
                .withEndAction(() -> { if (calendarBrowsing) supplement.setVisibility(INVISIBLE); }).start();
        reminders.animate().cancel();
        reminders.animate().alpha(browsing ? 0f : 1f).setDuration(scale == 0 ? 0 : 240).start();
        reminders.setImportantForAccessibility(browsing ? IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS : IMPORTANT_FOR_ACCESSIBILITY_AUTO);
    }
    private void showTodayButton(boolean visible) {
        if (showingToday == visible) return;
        showingToday = visible;
        todayButton.setEnabled(visible);
        todayButton.setImportantForAccessibility(visible ? IMPORTANT_FOR_ACCESSIBILITY_AUTO : IMPORTANT_FOR_ACCESSIBILITY_NO);
        todayButton.animate().cancel();
        todayButton.animate().alpha(visible ? 1f : 0f).setDuration(160).start();
    }
    private ImageView arrow(int resource, String label) {
        ImageView image = style.icon(resource, FrameStyle.WHITE, 44, label); int padding = style.px(12);
        image.setPadding(padding, padding, padding, padding); image.setBackground(FrameStyle.feedback()); image.setFocusable(true); return image;
    }
    void repository(FrameRepository value) {
        repository = value; photoPane.repository(value); if (pendingMonths != null) value.months(pendingMonths);
    }
    void active(boolean value) {
        active = value; photoPane.active(value); handler.removeCallbacks(tick); if (value) tick.run();
    }
    private void updateClock() {
        long now = System.currentTimeMillis();
        String time = FrameData.format("h:mm", now, zone), day = FrameData.format("EEEE, MMMM d", now, zone);
        if (!clock.getText().toString().equals(time)) clock.setText(time);
        if (!date.getText().toString().equals(day)) date.setText(day);
    }
    @Override public void dashboard(FrameData.Dashboard value) {
        if (style.accent != value.accentColor) { style.accent = value.accentColor; weatherKey = ""; }
        zone = value.zone; photoPane.update(value); calendar.dashboard(value); updateClock(); updateReminders(); updateWeather();
    }
    @Override public void month(FrameData.Month value) { calendar.month(value); }
    @Override public void weather(JSONObject value) { weatherData = value; updateWeather(); }
    @Override public void photoSettings(PhotoSettings value) { photoSettingsChanged.changed(value); }
    @Override public void reminders(JSONObject value) { reminderData = value; updateReminders(); }
    @Override public void connection(boolean online) {
        this.online = online; connection.setVisibility(online || fullScreenPhoto ? GONE : VISIBLE);
    }
    private void fullScreenPhoto(boolean value) {
        fullScreenPhoto = value;
        photoPane.fullScreen(value);
        details.setVisibility(value ? GONE : VISIBLE);
        connection.setVisibility(online || value ? GONE : VISIBLE);
        photoPane.setContentDescription(value
                ? "Full screen photo. Swipe for previous or next. Tap to return to the dashboard."
                : "Photo slideshow. Swipe for previous or next. Tap for full screen.");
    }
    boolean closeFullScreenPhoto() {
        if (!fullScreenPhoto) return false;
        fullScreenPhoto(false); return true;
    }
    @Override public void accessRequired() { photoPane.clear("Pair this frame with HomeControl."); actions.accessRequired(); }
    private void updateReminders() {
        if (reminderData == null) return;
        try {
            FrameData.Due due = FrameData.due(reminderData, System.currentTimeMillis(), zone);
            String key = due.bins.toString() + due.timing;
            if (key.equals(reminderKey)) return; reminderKey = key;
            reminders.removeAllViews(); reminders.setVisibility(due.bins.isEmpty() ? GONE : VISIBLE);
            if (!due.bins.isEmpty()) {
                TextView timing = style.text(due.timing, 14, false, FrameStyle.MUTED); LinearLayout.LayoutParams time = new LinearLayout.LayoutParams(-2, -2); time.rightMargin = style.px(12); reminders.addView(timing, time);
                for (int index = 0; index < due.bins.size(); index++) {
                    String bin = due.bins.get(index);
                    int icon = R.drawable.icon_shoppingbag, color = 0xffd5ab77; String label = "Brown bags";
                    if (bin.equals("recycling")) { icon = R.drawable.icon_recycle; color = 0xff84c9ff; label = "Recycling"; }
                    if (bin.equals("trash")) { icon = R.drawable.icon_trash2; color = 0xffdddddd; label = "Trash"; }
                    if (bin.equals("green")) { icon = R.drawable.icon_leaf; color = 0xffa9d790; label = "Green bin"; }
                    ImageView image = style.icon(icon, color, 30, label + " collection — " + due.timing);
                    image.setPadding(style.px(4), style.px(7), style.px(4), style.px(7));
                    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(style.px(38), style.px(44)); if (index > 0) params.leftMargin = style.px(10); reminders.addView(image, params);
                }
            }
        } catch (Exception ignored) { /* Keep the last valid reminder state. */ }
    }
    private void updateWeather() {
        String today = FrameData.today(System.currentTimeMillis(), zone);
        String key = today + (weatherData == null ? "" : weatherData.toString());
        if (key.equals(weatherKey)) return; weatherKey = key;
        weather.setVisibility(weatherData == null || "disabled".equals(weatherData.optString("state")) ? GONE : VISIBLE);
        weather.removeAllViews(); View border = new View(getContext()); border.setBackgroundColor(0xff333333); weather.addView(border, new LinearLayout.LayoutParams(-1, style.px(1)));
        int code = weatherData == null || weatherData.isNull("weatherCode") ? -1 : weatherData.optInt("weatherCode", -1);
        boolean isDay = weatherData == null || weatherData.optBoolean("isDay", true);
        LinearLayout current = style.row(); LinearLayout.LayoutParams currentParams = new LinearLayout.LayoutParams(-1, style.px(41)); currentParams.topMargin = style.px(16); currentParams.bottomMargin = style.px(16); weather.addView(current, currentParams);
        current.setContentDescription("Weather by Open-Meteo, CC BY 4.0. Tap for attribution.");
        current.setOnClickListener(view -> {
            try { getContext().startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("https://open-meteo.com/en/terms"))); }
            catch (Exception ignored) { android.widget.Toast.makeText(getContext(), "Weather by Open-Meteo · CC BY 4.0", android.widget.Toast.LENGTH_LONG).show(); }
        });
        String label = weatherData != null && "stale".equals(weatherData.optString("state")) ? "Last known weather" : FrameStyle.weatherLabel(code, isDay);
        TextView condition = style.text("Now · " + label, 16, true, FrameStyle.WHITE);
        current.addView(condition, new LinearLayout.LayoutParams(0, -1, 1));
        TextView location = style.text(weatherData == null ? "" : weatherData.optString("label"), 17, true, 0xffbbbbbb); current.addView(location, new LinearLayout.LayoutParams(-2, -1));
        LinearLayout forecast = style.row(); forecast.setGravity(Gravity.TOP); weather.addView(forecast, new LinearLayout.LayoutParams(-1, -1));
        String number = weatherData == null || weatherData.isNull("temperature") ? "—" : Math.round(weatherData.optDouble("temperature")) + "°";
        LinearLayout todayColumn = weatherColumn(forecast, "Today", code, isDay, style.accent, false);
        String unit = weatherData != null && "fahrenheit".equals(weatherData.optString("unit")) ? "F" : "C";
        todayColumn.setContentDescription("Today: " + label + ", " + number + " " + unit + " now");
        SpannableString temperature = new SpannableString(number + "\u2009" + unit);
        temperature.setSpan(new AbsoluteSizeSpan(style.px(14)), number.length(), temperature.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        TextView degrees = style.text("", 21, true, FrameStyle.WHITE); degrees.setText(temperature);
        LinearLayout.LayoutParams degreesParams = new LinearLayout.LayoutParams(-2, style.px(24)); degreesParams.topMargin = style.px(10); todayColumn.addView(degrees, degreesParams);
        JSONArray days = weatherData == null ? null : weatherData.optJSONArray("forecast"); int added = 0;
        if (days != null) for (int index = 0; index < days.length() && added < 5; index++) {
            JSONObject day = days.optJSONObject(index); if (day == null || day.optString("date").compareTo(today) <= 0) continue;
            LinearLayout column = weatherColumn(forecast,
                    FrameData.format("EEE", FrameData.date(day.optString("date")), FrameData.UTC),
                    day.optInt("weatherCode"), true, FrameStyle.WHITE, true);
            added++;
            LinearLayout temperatures = style.row(); LinearLayout.LayoutParams values = new LinearLayout.LayoutParams(-2, style.px(24)); values.topMargin = style.px(10); column.addView(temperatures, values);
            temperatures.addView(style.text(Math.round(day.optDouble("high")) + "°", 21, true, FrameStyle.WHITE));
            LinearLayout.LayoutParams low = new LinearLayout.LayoutParams(-2, -1); low.leftMargin = style.px(8); temperatures.addView(style.text(Math.round(day.optDouble("low")) + "°", 21, false, 0xffaaaaaa), low);
        }
        for (int missing = added; missing < 5; missing++) {
            LinearLayout.LayoutParams space = new LinearLayout.LayoutParams(0, -1, 1); space.leftMargin = style.px(10);
            forecast.addView(new View(getContext()), space);
        }
    }
    private LinearLayout weatherColumn(LinearLayout forecast, String day, int code, boolean isDay, int labelColor, boolean separated) {
        LinearLayout column = style.column(); column.setGravity(Gravity.CENTER_HORIZONTAL);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, -1, 1); if (separated) params.leftMargin = style.px(10); forecast.addView(column, params);
        TextView weekday = style.text(day, 17, true, labelColor); column.addView(weekday, new LinearLayout.LayoutParams(-2, style.px(20)));
        ImageView icon = style.icon(FrameStyle.weatherIcon(code, isDay), style.accent, 30, FrameStyle.weatherLabel(code, isDay));
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(style.px(30), style.px(30)); iconParams.topMargin = style.px(10); column.addView(icon, iconParams);
        return column;
    }
    @Override protected void onDetachedFromWindow() { active(false); super.onDetachedFromWindow(); }
}
