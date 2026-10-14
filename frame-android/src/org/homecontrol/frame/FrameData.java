package org.homecontrol.frame;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/** API contracts and calendar arithmetic, compatible with the frame's Android 6. */
final class FrameData {
    static final TimeZone UTC = TimeZone.getTimeZone("UTC");
    static final long DAY = 86_400_000L;

    static String format(String pattern, long instant, TimeZone zone) {
        SimpleDateFormat formatter = new SimpleDateFormat(pattern, Locale.US);
        formatter.setTimeZone(zone);
        return formatter.format(new Date(instant));
    }
    static String today(long now, TimeZone zone) { return format("yyyy-MM-dd", now, zone); }
    static long date(String day) {
        try {
            SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            formatter.setTimeZone(UTC);
            formatter.setLenient(false);
            return formatter.parse(day).getTime();
        } catch (ParseException error) { throw new IllegalArgumentException("Invalid calendar date", error); }
    }
    static String addDays(String day, int amount) { return today(date(day) + amount * DAY, UTC); }
    static int weekday(String day) {
        Calendar calendar = Calendar.getInstance(UTC);
        calendar.setTimeInMillis(date(day));
        return calendar.get(Calendar.DAY_OF_WEEK) - 1;
    }
    static long instant(String value) {
        // RFC 3339 offset and fractional seconds from EventKit exports.
        String normalized = value.replaceFirst("\\.\\d+(?=Z|[+-]\\d\\d:\\d\\d$)", "")
                .replace("Z", "+0000").replaceFirst("([+-]\\d\\d):(\\d\\d)$", "$1$2");
        try { return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ", Locale.US).parse(normalized).getTime(); }
        catch (ParseException error) { throw new IllegalArgumentException("Invalid event time", error); }
    }
    static String state(JSONObject object, String name) {
        JSONObject source = object.optJSONObject(name);
        return source == null ? "unavailable" : source.optString("state", "unavailable");
    }

    static final class Event {
        final String id, title, calendar, startDay, endDay, displayName, colorHex;
        final long start, end;
        final boolean allDay;
        Event(JSONObject json) throws JSONException {
            id = json.getString("id"); title = json.getString("title"); calendar = json.getString("calendar");
            displayName = json.isNull("calendarDisplayName") ? "" : json.optString("calendarDisplayName", "").trim();
            colorHex = json.optString("calendarColor", "");
            startDay = json.getString("startDay"); endDay = json.getString("endDay");
            start = instant(json.getString("start")); end = instant(json.getString("end")); allDay = json.getBoolean("allDay");
        }
        boolean onDay(String day, TimeZone zone) {
            return allDay ? startDay.compareTo(day) <= 0 && endDay.compareTo(day) > 0
                    : today(start, zone).compareTo(day) <= 0 && today(end - 1, zone).compareTo(day) >= 0;
        }
        String time(String day, TimeZone zone) {
            if (allDay) return "All day";
            if (today(start, zone).compareTo(day) < 0) return "Continues";
            return format("h:mma", start, zone).toLowerCase(Locale.ROOT);
        }
        String label(String day, TimeZone zone) { return time(day, zone) + (displayName.isEmpty() ? "" : " – " + displayName); }
        int color() { return colorHex.matches("#[0-9a-fA-F]{6}") ? android.graphics.Color.parseColor(colorHex) : FrameStyle.TONES[tone()]; }
        int tone() {
            int sum = 0;
            for (int index = 0; index < calendar.length();) {
                int point = calendar.codePointAt(index);
                sum += Character.isSupplementaryCodePoint(point) ? Character.highSurrogate(point) : point;
                index += Character.charCount(point);
            }
            return sum % 3;
        }
        boolean past(long now, TimeZone zone) { return allDay ? endDay.compareTo(today(now, zone)) <= 0 : end <= now; }
    }
    static List<Event> events(JSONArray json) throws JSONException {
        List<Event> events = new ArrayList<>();
        if (json != null) for (int index = 0; index < json.length(); index++) events.add(new Event(json.getJSONObject(index)));
        Collections.sort(events, (a, b) -> a.allDay != b.allDay ? (a.allDay ? -1 : 1) : Long.compare(a.start, b.start));
        return Collections.unmodifiableList(events);
    }
    static final class Photo {
        final String id, caption;
        final double[] subject;
        Photo(JSONObject json) throws JSONException {
            id = json.getString("id"); caption = json.optString("caption", json.optString("album"));
            if (!id.matches("[a-zA-Z0-9-]{1,80}")) throw new JSONException("Invalid photo identifier");
            JSONObject box = json.optJSONObject("subject");
            subject = box == null ? null : new double[]{box.getDouble("x"), box.getDouble("y"), box.getDouble("width"), box.getDouble("height")};
        }
    }
    static final class Dashboard {
        final int accentColor;
        final TimeZone zone;
        final String revision, calendarState, photoState, calendarMessage, photoMessage;
        final List<Event> events;
        final List<Photo> photos;
        Dashboard(JSONObject json) throws JSONException {
            String accent = json.optString("accentColor", "#E4FF73");
            accentColor = accent.matches("#[0-9a-fA-F]{6}") ? android.graphics.Color.parseColor(accent) : FrameStyle.ACCENT;
            zone = TimeZone.getTimeZone(json.getString("timezone"));
            revision = json.optString("calendarRevision");
            calendarState = state(json, "calendarStatus"); photoState = state(json, "photoStatus");
            calendarMessage = json.getJSONObject("calendarStatus").optString("message");
            photoMessage = json.getJSONObject("photoStatus").optString("message");
            events = events(json.optJSONArray("events"));
            List<Photo> parsed = new ArrayList<>();
            JSONArray images = json.getJSONArray("photos");
            for (int index = 0; index < images.length(); index++) parsed.add(new Photo(images.getJSONObject(index)));
            photos = Collections.unmodifiableList(parsed);
        }
    }
    static final class Month {
        final String month, revision, state, message;
        final List<Event> events;
        Month(JSONObject json) throws JSONException {
            month = json.getString("month"); revision = json.optString("revision");
            state = state(json, "status"); message = json.getJSONObject("status").optString("message");
            events = events(json.optJSONArray("events"));
        }
    }
    static final class Due {
        final List<String> bins = new ArrayList<>();
        String timing;
    }
    static Due due(JSONObject reminders, long now, TimeZone zone) throws JSONException {
        Due due = new Due();
        JSONObject settings = reminders.getJSONObject("settings");
        JSONObject bins = settings.getJSONObject("bins");
        String day = today(now, zone);
        int weekday = weekday(day);
        int daysUntil = (bins.getInt("collectionDay") - weekday + 7) % 7;
        String collection = addDays(day, daysUntil);
        JSONArray weeks = bins.getJSONArray("weeks");
        if (bins.getBoolean("enabled") && weeks.length() > 0) {
            long offset = Math.round((date(collection) - date(bins.getString("anchorDate"))) / (double)(7 * DAY));
            int index = (int)((offset % weeks.length() + weeks.length()) % weeks.length());
            JSONArray selected = weeks.getJSONArray(index);
            for (int item = 0; item < selected.length(); item++) due.bins.add(selected.getString(item));
        }
        due.timing = daysUntil == 0 ? "Today" : daysUntil == 1 ? "Tomorrow" : format("EEE, MMM d", date(collection), UTC);
        return due;
    }
    /** CSS subject-aware cover geometry, applied as native render-thread transforms. */
    static float[][] photoPlan(int width, int height, int viewportWidth, int viewportHeight, double[] subject) {
        float scale = Math.max(viewportWidth / (float)width, viewportHeight / (float)height);
        double[] focus = subject == null ? new double[]{0, 0, 1, 1} : subject;
        double safe = subject == null ? 0 : Math.min(viewportWidth / (width * focus[2]), viewportHeight / (height * focus[3]));
        boolean preserve = safe >= scale * 1.015;
        float end = (float)(preserve ? Math.min(scale * 1.07, safe * .995) : scale * 1.07);
        float[][] points = new float[2][3];
        for (int index = 0; index < 2; index++) {
            float at = index == 0 ? scale : end, w = width * at, h = height * at;
            double drift = index == 0 ? -.012 : .012;
            double minX = preserve ? Math.max(viewportWidth - w, -focus[0] * w) : viewportWidth - w;
            double maxX = preserve ? Math.min(0, viewportWidth - (focus[0] + focus[2]) * w) : 0;
            double minY = preserve ? Math.max(viewportHeight - h, -focus[1] * h) : viewportHeight - h;
            double maxY = preserve ? Math.min(0, viewportHeight - (focus[1] + focus[3]) * h) : 0;
            points[index] = new float[]{(float)Math.min(maxX, Math.max(minX, viewportWidth / 2.0 - (focus[0] + focus[2] / 2) * w + drift * viewportWidth)),
                    (float)Math.min(maxY, Math.max(minY, viewportHeight / 2.0 - (focus[1] + focus[3] / 2) * h + drift * viewportHeight)), at};
        }
        return points;
    }
}
