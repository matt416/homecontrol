package org.homecontrol.frame;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

final class FrameStyle {
    static final int BACKGROUND = 0xff050505, WHITE = 0xffffffff, MUTED = 0xffb4b4b9, ACCENT = 0xffe4ff73;
    static final int[] TONES = {0xff95d9ff, 0xffc7e98b, 0xfff8b0d2};
    final Context context;
    int accent = ACCENT;
    final float scale;
    FrameStyle(Context context, float scale) { this.context = context; this.scale = scale; }
    int px(float value) { return Math.round(value * scale); }
    TextView text(String value, float size, boolean bold, int color) {
        return text(value, size, bold ? 700 : 400, color);
    }
    TextView text(String value, float size, int weight, int color) {
        TextView view = new TextView(context);
        view.setText(value); view.setTextColor(color);
        view.setTextSize(TypedValue.COMPLEX_UNIT_PX, size * scale);
        Typeface family = Typeface.create("sans-serif", weight >= 600 ? Typeface.BOLD : Typeface.NORMAL);
        view.setTypeface(android.os.Build.VERSION.SDK_INT >= 28 ? Typeface.create(family, weight, false) : family);
        view.setIncludeFontPadding(false); view.setPadding(0, 0, 0, 0);
        view.setGravity(Gravity.CENTER_VERTICAL);
        view.setBreakStrategy(0); view.setHyphenationFrequency(0);
        return view;
    }
    void lineBox(TextView view, float height) {
        android.graphics.Paint.FontMetrics metrics = view.getPaint().getFontMetrics();
        // CSS centers even negative leading; TextView otherwise clips a short line box.
        view.setTranslationY(Math.min(0, (px(height) - (metrics.descent - metrics.ascent)) / 2f));
    }
    LinearLayout column() { LinearLayout view = new LinearLayout(context); view.setOrientation(LinearLayout.VERTICAL); return view; }
    LinearLayout row() { LinearLayout view = new LinearLayout(context); view.setOrientation(LinearLayout.HORIZONTAL); view.setGravity(Gravity.CENTER_VERTICAL); return view; }
    ImageView icon(int resource, int color, float size, String description) {
        ImageView view = new ImageView(context);
        view.setImageResource(resource); view.setImageTintList(ColorStateList.valueOf(color));
        view.setScaleType(ImageView.ScaleType.FIT_CENTER); view.setContentDescription(description);
        view.setLayoutParams(new LinearLayout.LayoutParams(px(size), px(size)));
        if (description == null) view.setImportantForAccessibility(ImageView.IMPORTANT_FOR_ACCESSIBILITY_NO);
        return view;
    }
    static GradientDrawable background(int fill, int stroke, float radius) {
        GradientDrawable drawable = new GradientDrawable(); drawable.setColor(fill); drawable.setCornerRadius(radius);
        if (stroke != 0) drawable.setStroke(1, stroke);
        return drawable;
    }
    static RippleDrawable feedback() { return new RippleDrawable(ColorStateList.valueOf(0x24ffffff), background(0, 0, 8), null); }
    static int weatherIcon(int code, boolean day) {
        if (code == 0) return day ? R.drawable.icon_sun : R.drawable.icon_moon;
        if (code == 1 || code == 2) return R.drawable.icon_cloudsun;
        if (code == 3) return R.drawable.icon_cloud;
        if (code == 45 || code == 48) return R.drawable.icon_cloudfog;
        if (code >= 51 && code <= 57) return R.drawable.icon_clouddrizzle;
        if ((code >= 71 && code <= 77) || code == 85 || code == 86) return R.drawable.icon_cloudsnow;
        if (code >= 95) return R.drawable.icon_cloudlightning;
        if (code >= 61) return R.drawable.icon_cloudrain;
        return R.drawable.icon_cloud;
    }
    static String weatherLabel(int code, boolean day) {
        if (code == 0) return day ? "Clear skies" : "Clear night";
        if (code == 1 || code == 2) return "Partly cloudy";
        if (code == 3) return "Overcast";
        if (code == 45 || code == 48) return "Foggy";
        if (code >= 51 && code <= 57) return "Drizzle";
        if ((code >= 71 && code <= 77) || code == 85 || code == 86) return "Snow";
        if (code >= 95) return "Thunderstorms";
        if (code >= 61) return "Rain";
        return "Weather unavailable";
    }
}
