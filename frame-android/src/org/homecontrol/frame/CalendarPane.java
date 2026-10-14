package org.homecontrol.frame;

import android.content.Context;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AbsListView;
import android.widget.BaseAdapter;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;

/** Recycles native day rows and keeps the first visible day anchored across updates. */
final class CalendarPane extends ListView {
    interface Navigation { void changed(boolean atToday, boolean browsing, Set<String> months); }
    private final FrameStyle style;
    private final Navigation navigation;
    private final DayAdapter adapter = new DayAdapter();
    private final Map<String, FrameData.Month> months = new LinkedHashMap<>();
    private FrameData.Dashboard dashboard;
    private TimeZone zone = TimeZone.getDefault();
    private long now = System.currentTimeMillis();
    private static final long FIRST = FrameData.date("1900-01-01");
    private static final int COUNT = (int)((FrameData.date("2200-01-01") - FIRST) / FrameData.DAY);
    private boolean scrolling, pending, browsing, initial = true;
    private Integer selectionTarget;
    private int selectionOffset;
    private final Map<String, List<FrameData.Event>> dayEvents = new LinkedHashMap<String, List<FrameData.Event>>() {
        @Override protected boolean removeEldestEntry(Map.Entry<String, List<FrameData.Event>> entry) { return size() > 120; }
    };

    CalendarPane(Context context, FrameStyle style, Navigation navigation) {
        super(context); this.style = style; this.navigation = navigation;
        setDivider(null); setDividerHeight(0); setCacheColorHint(FrameStyle.BACKGROUND);
        setSelector(android.R.color.transparent); setVerticalScrollBarEnabled(false);
        setOverScrollMode(OVER_SCROLL_NEVER); setClipToPadding(true); setAdapter(adapter);
        setContentDescription("Calendar days"); setVisibility(INVISIBLE);
        setOnScrollListener(new OnScrollListener() {
            @Override public void onScrollStateChanged(AbsListView view, int state) {
                scrolling = state != SCROLL_STATE_IDLE;
                if (scrolling) browsing = true;
                if (!scrolling && pending) refreshRows();
            }
            @Override public void onScroll(AbsListView view, int first, int visible, int total) {
                if (visible == 0) return;
                View leading = getChildAt(0);
                if (selectionTarget != null && first == selectionTarget && leading != null && selectionTarget.equals(leading.getTag()) && leading.getTop() == selectionOffset) {
                    selectionTarget = null; initial = false; setVisibility(VISIBLE);
                }
                if (initial) return;
                Set<String> required = new HashSet<>();
                for (int index = Math.max(0, first - 3); index <= Math.min(COUNT - 1, first + visible + 3); index++) required.add(day(index).substring(0, 7));
                navigation.changed(first == todayIndex() && getChildAt(0) != null && Math.abs(getChildAt(0).getTop()) < 2, browsing, required);
            }
        });
        post(this::goToday);
    }
    @Override protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        super.onLayout(changed, left, top, right, bottom);
        if (selectionTarget != null) post(() -> {
            // ListView's stable-ID sync can consume the first layout after a data
            // refresh. Apply navigation once that sync has finished.
            if (selectionTarget != null) setSelectionFromTop(selectionTarget, selectionOffset);
        });
    }
    private int todayIndex() { return (int)((FrameData.date(FrameData.today(now, zone)) - FIRST) / FrameData.DAY); }
    private String day(int index) { return FrameData.today(FIRST + index * FrameData.DAY, FrameData.UTC); }
    private void selectDay(int index, int offset) {
        selectionTarget = index; selectionOffset = offset; setSelectionFromTop(index, offset);
    }
    void goToday() { browsing = false; selectDay(todayIndex(), 0); }
    void move(int direction) { browsing = true; selectDay(Math.max(0, Math.min(COUNT - 1, getFirstVisiblePosition() + direction * 3)), 0); }
    void dashboard(FrameData.Dashboard value) {
        boolean zoneChanged = !zone.getID().equals(value.zone.getID());
        dashboard = value; zone = value.zone;
        if ("denied".equals(value.calendarState)) months.clear();
        dayEvents.clear(); refreshRows();
        if (zoneChanged) goToday();
    }
    void month(FrameData.Month value) {
        FrameData.Month previous = months.get(value.month);
        if (!"ready".equals(value.state) && !"denied".equals(value.state) && previous != null && "ready".equals(previous.state)) return;
        months.put(value.month, value);
        while (months.size() > 24) months.remove(months.keySet().iterator().next());
        dayEvents.clear(); refreshRows();
    }
    void tick(long value) {
        String previous = FrameData.today(now, zone);
        boolean atToday = getFirstVisiblePosition() == todayIndex();
        now = value;
        if (!previous.equals(FrameData.today(now, zone))) { dayEvents.clear(); refreshRows(); if (atToday) goToday(); }
        else refreshRows();
    }
    private void refreshRows() {
        if (scrolling) { pending = true; return; }
        pending = false;
        int first = getFirstVisiblePosition(); View child = getChildAt(0); int offset = child == null ? 0 : child.getTop();
        adapter.notifyDataSetChanged();
        // A cached API response can arrive before a requested selection is laid out.
        // Preserve that requested day rather than anchoring the still-visible old row.
        if (selectionTarget != null) setSelectionFromTop(selectionTarget, selectionOffset);
        else if (child != null) setSelectionFromTop(first, offset);
    }
    private List<FrameData.Event> events(String day) {
        List<FrameData.Event> cached = dayEvents.get(day);
        if (cached != null) return cached;
        FrameData.Month page = months.get(day.substring(0, 7));
        List<FrameData.Event> source = page != null && "ready".equals(page.state) ? page.events
                : dashboard != null && "ready".equals(dashboard.calendarState) ? dashboard.events : new ArrayList<>();
        List<FrameData.Event> result = new ArrayList<>();
        for (FrameData.Event event : source) if (event.onDay(day, zone)) result.add(event);
        dayEvents.put(day, result); return result;
    }
    private final class DayAdapter extends BaseAdapter {
        @Override public int getCount() { return COUNT; }
        @Override public Object getItem(int position) { return day(position); }
        @Override public long getItemId(int position) { return position; }
        @Override public boolean hasStableIds() { return true; }
        @Override public boolean isEnabled(int position) { return true; }
        @Override public View getView(int position, View recycled, ViewGroup parent) {
            LinearLayout row = recycled instanceof LinearLayout ? (LinearLayout)recycled : style.column();
            row.removeAllViews(); row.setMinimumHeight(style.px(108));
            row.setTag(position);
            String day = day(position), today = FrameData.today(now, zone);
            row.setContentDescription(FrameData.format("EEEE, MMMM d, yyyy", FrameData.date(day), FrameData.UTC));
            View border = new View(getContext()); border.setBackgroundColor(0xff333333); row.addView(border, new LinearLayout.LayoutParams(-1, style.px(1)));
            LinearLayout contents = style.row(); contents.setGravity(Gravity.TOP); contents.setPadding(0, style.px(16), 0, style.px(16));
            row.addView(contents, new LinearLayout.LayoutParams(-1, -2));
            LinearLayout date = style.column(); contents.addView(date, new LinearLayout.LayoutParams(style.px(84), -2));
            int dateColor = day.equals(today) ? style.accent : FrameStyle.WHITE;
            TextView number = style.text(Integer.toString(Integer.parseInt(day.substring(8))), 40, 800, dateColor);
            number.setLetterSpacing(-.055f); style.lineBox(number, 40); date.addView(number, new LinearLayout.LayoutParams(-1, style.px(40)));
            String label = day.equals(today) ? "Today" : day.equals(FrameData.addDays(today, 1)) ? "Tomorrow" : FrameData.format("EEE", FrameData.date(day), FrameData.UTC);
            addDateLabel(date, label, day.equals(today) ? style.accent : 0xffbbbbbb);
            if (!day.substring(0, 7).equals(today.substring(0, 7)) || day.endsWith("-01")) addDateLabel(date, FrameData.format("MMM", FrameData.date(day), FrameData.UTC), 0xffbbbbbb);
            if (!day.substring(0, 4).equals(today.substring(0, 4))) addDateLabel(date, day.substring(0, 4), 0xffbbbbbb);
            LinearLayout items = style.column(); LinearLayout.LayoutParams itemParams = new LinearLayout.LayoutParams(0, -2, 1); itemParams.leftMargin = style.px(18); contents.addView(items, itemParams);
            List<FrameData.Event> events = events(day);
            for (int index = 0; index < events.size(); index++) {
                FrameData.Event event = events.get(index);
                LinearLayout card = style.row(); card.setGravity(Gravity.TOP);
                LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(-1, -2); if (index > 0) cardParams.topMargin = style.px(18); items.addView(card, cardParams);
                View accent = new View(getContext()); accent.setBackgroundColor(event.color()); card.addView(accent, new LinearLayout.LayoutParams(style.px(3), -1));
                LinearLayout text = style.column(); LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(0, -2, 1); textParams.leftMargin = style.px(16); card.addView(text, textParams);
                TextView time = style.text(event.label(day, zone), 16, true, event.color()); text.addView(time, new LinearLayout.LayoutParams(-1, -2));
                TextView title = style.text(event.title, 23, 750, FrameStyle.WHITE); title.setLetterSpacing(-.025f);
                title.setLineSpacing(style.px(23 * 1.14f) - (title.getPaint().getFontMetrics().descent - title.getPaint().getFontMetrics().ascent), 1);
                LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(-1, -2); titleParams.topMargin = style.px(7); text.addView(title, titleParams);
                card.setAlpha(event.past(now, zone) ? .35f : 1);
            }
            if (events.isEmpty() && dashboard != null && !"ready".equals(dashboard.calendarState)) {
                items.addView(style.text(dashboard.calendarMessage, 16, false, FrameStyle.MUTED));
            } else if (events.isEmpty() && !months.containsKey(day.substring(0, 7)) && dashboard == null) {
                items.addView(style.text("Loading…", 16, false, FrameStyle.MUTED));
            }
            return row;
        }
        private void addDateLabel(LinearLayout date, String value, int color) {
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2); params.topMargin = style.px(7);
            date.addView(style.text(value, 14, true, color), params);
        }
    }
}
