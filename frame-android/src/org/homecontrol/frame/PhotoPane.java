package org.homecontrol.frame;

import android.content.Context;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.Handler;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.VelocityTracker;
import android.view.ViewConfiguration;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.animation.LinearInterpolator;
import android.view.animation.PathInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

/** Persistent native photo layers, with a shuffled album and direct touch navigation. */
final class PhotoPane extends FrameLayout {
    private static final long SWIPE_MILLIS = 220;
    private long photoMillis = 15000, fadeMillis = 220;
    private final Handler handler = new Handler();
    private final FrameLayout[] pages = new FrameLayout[2];
    private final ImageView[] layers = new ImageView[2];
    private final TextView empty;
    private final PhotoOrder order = new PhotoOrder();
    private final Map<String, FrameData.Photo> photos = new HashMap<>();
    private final int touchSlop;
    private FrameRepository repository;
    private FrameData.Photo current;
    private Bitmap currentBitmap, previewBitmap;
    private String loading, previewId;
    private int front, loadGeneration, previewGeneration;
    private long shownAt, motionStart, motionRemaining = photoMillis;
    private boolean active, paused, fullScreen, motionRunning, touching, dragging, moved, multiplePointers;
    private float downX, downY, dragX;
    private long downAt;
    private float[] end;
    private VelocityTracker velocity;
    private final Runnable longPress = () -> {
        if (!touching || moved || multiplePointers) return;
        moved = true; touching = false; resumeMotion(); scheduleNext(); performLongClick();
    };
    private final Runnable advance = () -> {
        if (active && !paused && !touching && order.size() > 1) navigate(1);
    };

    PhotoPane(Context context) {
        super(context); setBackgroundColor(0xff000000); setClipChildren(true); setClipToPadding(true);
        touchSlop = ViewConfiguration.get(context).getScaledTouchSlop();
        for (int index = 0; index < 2; index++) {
            FrameLayout page = new FrameLayout(context); pages[index] = page;
            page.setBackgroundColor(0xff000000);
            page.setClipChildren(true); page.setAlpha(0f); addView(page, new LayoutParams(-1, -1));
            ImageView image = new ImageView(context); layers[index] = image;
            image.setScaleType(ImageView.ScaleType.FIT_XY); image.setPivotX(0); image.setPivotY(0);
            page.addView(image, new LayoutParams(1, 1));
        }
        empty = new TextView(context); empty.setTextColor(0xffdddddd); empty.setTextSize(22);
        empty.setGravity(Gravity.CENTER); empty.setPadding(32, 32, 32, 32);
        empty.setText("Connecting to HomeControl…"); addView(empty, new LayoutParams(-1, -1));
        setContentDescription("Photo slideshow. Swipe for previous or next. Tap for full screen.");
        setClickable(true); setFocusable(true);
    }
    void repository(FrameRepository repository) { this.repository = repository; }
    void configure(long duration, long transition, boolean shuffled) {
        photoMillis = Math.max(1000, Math.min(3600000, duration));
        fadeMillis = Math.max(0, Math.min(5000, Math.min(photoMillis - 1, transition)));
        order.shuffled(shuffled); shownAt = SystemClock.uptimeMillis(); motionRemaining = photoMillis;
        applyGeometry(); resumeMotion(); scheduleNext();
    }
    void update(FrameData.Dashboard dashboard) {
        if (!"ready".equals(dashboard.photoState) && !"denied".equals(dashboard.photoState) && current != null) return;
        photos.clear(); ArrayList<String> ids = new ArrayList<>();
        for (FrameData.Photo photo : dashboard.photos) { photos.put(photo.id, photo); ids.add(photo.id); }
        order.update(ids);
        if (photos.isEmpty()) {
            clear(dashboard.photoMessage.isEmpty() ? "Add photos to your shared album." : dashboard.photoMessage); return;
        }
        if (current != null && photos.containsKey(current.id)) { scheduleNext(); return; }
        if (getWidth() > 0) load(order.current());
    }
    void clear(String message) {
        photos.clear(); order.update(new ArrayList<>()); current = null; loading = null; currentBitmap = null;
        loadGeneration++; previewGeneration++; previewId = null; previewBitmap = null;
        handler.removeCallbacksAndMessages(null); stopMotion();
        for (int index = 0; index < 2; index++) {
            pages[index].animate().cancel(); pages[index].setTranslationX(0); pages[index].setAlpha(0);
            layers[index].setImageDrawable(null);
        }
        empty.setText(message); empty.setVisibility(VISIBLE);
    }
    void navigate(int direction) {
        if (order.size() < 2) return;
        shownAt = SystemClock.uptimeMillis(); handler.removeCallbacks(advance);
        load(order.move(direction));
    }
    private void load(String id) {
        FrameData.Photo photo = photos.get(id);
        if (repository == null || photo == null || id.equals(loading)) return;
        int generation = ++loadGeneration; loading = id;
        if (current != null && id.equals(current.id)) {
            loading = null; dragging = false; dragX = 0; previewId = null; previewBitmap = null; previewGeneration++;
            settleLayers(); resumeMotion(); scheduleNext(); return;
        }
        if (id.equals(previewId) && previewBitmap != null) {
            complete(photo, previewBitmap, generation); return;
        }
        repository.photo(photo, bitmap -> complete(photo, bitmap, generation));
    }
    private void complete(FrameData.Photo photo, Bitmap bitmap, int generation) {
        if (generation != loadGeneration || !photos.containsKey(photo.id)) return;
        if (touching) { handler.postDelayed(() -> complete(photo, bitmap, generation), 32); return; }
        loading = null;
        if (bitmap == null) {
            if (current == null) empty.setText("Photo unavailable. Retrying…");
            handler.postDelayed(() -> {
                if (active && generation == loadGeneration) load(photo.id);
            }, 5000);
            scheduleNext(); return;
        }
        show(photo, bitmap);
    }
    private void show(FrameData.Photo photo, Bitmap bitmap) {
        boolean initial = current == null;
        boolean slide = dragging && photo.id.equals(previewId) && previewBitmap != null;
        float offset = dragX;
        stopMotion();
        if (!slide) settleLayers();
        int previous = front; front = 1 - front;
        pages[front].animate().cancel(); pages[previous].animate().cancel();
        setImage(front, photo, bitmap); pages[front].bringToFront();
        current = photo; currentBitmap = bitmap; shownAt = SystemClock.uptimeMillis(); motionRemaining = photoMillis;
        applyGeometry(); empty.setVisibility(GONE);
        int generation = loadGeneration;
        Runnable finished = () -> {
            if (generation != loadGeneration) return;
            settleLayers(); resumeMotion();
        };
        if (slide && !reducedMotion()) {
            float distance = offset < 0 ? getWidth() : -getWidth();
            pages[front].setAlpha(1); pages[front].setTranslationX(offset + distance);
            pages[previous].animate().translationX(-distance).setDuration(SWIPE_MILLIS)
                    .setInterpolator(new PathInterpolator(.2f, .8f, .2f, 1)).start();
            pages[front].animate().translationX(0).setDuration(SWIPE_MILLIS)
                    .setInterpolator(new PathInterpolator(.2f, .8f, .2f, 1)).withEndAction(finished).start();
        } else {
            pages[front].setTranslationX(0); pages[front].setAlpha(initial ? 1 : 0);
            pages[front].animate().alpha(1).setDuration(initial || reducedMotion() ? 0 : fadeMillis)
                    .setInterpolator(new PathInterpolator(.25f, .1f, .25f, 1)).withEndAction(finished).start();
        }
        dragging = false; dragX = 0; previewId = null; previewBitmap = null; previewGeneration++;
        scheduleNext();
        if (order.size() > 1) {
            repository.photo(photos.get(order.neighbor(1)), ignored -> {});
            if (order.size() > 2) repository.photo(photos.get(order.neighbor(-1)), ignored -> {});
        }
    }
    private void setImage(int index, FrameData.Photo photo, Bitmap bitmap) {
        ImageView image = layers[index]; image.animate().cancel(); image.setImageBitmap(bitmap);
        image.setContentDescription(photo.caption.isEmpty() ? "Shared album photo" : photo.caption);
        image.setLayoutParams(new LayoutParams(bitmap.getWidth(), bitmap.getHeight()));
        float[][] plan = photoPlan(photo, bitmap);
        image.setTranslationX(plan[0][0]); image.setTranslationY(plan[0][1]);
        image.setScaleX(plan[0][2]); image.setScaleY(plan[0][2]);
    }
    private void applyGeometry() {
        if (currentBitmap == null || getWidth() == 0 || getHeight() == 0) return;
        stopMotion(); setImage(front, current, currentBitmap);
        end = photoPlan(current, currentBitmap)[1];
    }
    private float[][] photoPlan(FrameData.Photo photo, Bitmap bitmap) {
        if (!fullScreen) return FrameData.photoPlan(bitmap.getWidth(), bitmap.getHeight(), getWidth(), getHeight(), photo.subject);
        float scale = Math.min(getWidth() / (float)bitmap.getWidth(), getHeight() / (float)bitmap.getHeight());
        float[] fit = {(getWidth() - bitmap.getWidth() * scale) / 2, (getHeight() - bitmap.getHeight() * scale) / 2, scale};
        return new float[][]{fit, fit};
    }
    void fullScreen(boolean value) {
        fullScreen = value; settleLayers(); applyGeometry(); resumeMotion();
    }
    private void settleLayers() {
        for (int index = 0; index < 2; index++) {
            pages[index].animate().cancel(); pages[index].setTranslationX(0);
            pages[index].setAlpha(index == front && current != null ? 1 : 0);
            if (index != front) { layers[index].animate().cancel(); layers[index].setImageDrawable(null); }
        }
    }
    private void stopMotion() {
        if (motionRunning) motionRemaining = Math.max(0, motionRemaining - (SystemClock.uptimeMillis() - motionStart));
        motionRunning = false; layers[front].animate().cancel();
    }
    private boolean reducedMotion() {
        return Settings.Global.getFloat(getContext().getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1) == 0;
    }
    private void resumeMotion() {
        if (!active || paused || touching || fullScreen || reducedMotion() || end == null || motionRunning) return;
        motionRunning = true; motionStart = SystemClock.uptimeMillis();
        layers[front].animate().translationX(end[0]).translationY(end[1]).scaleX(end[2]).scaleY(end[2])
                .setDuration(Math.max(0, motionRemaining)).setInterpolator(new LinearInterpolator()).withEndAction(null).start();
    }
    private void scheduleNext() {
        handler.removeCallbacks(advance);
        if (active && !paused && !touching && !reducedMotion() && order.size() > 1)
            handler.postDelayed(advance, Math.max(1000, photoMillis - (SystemClock.uptimeMillis() - shownAt)));
    }
    private void preview(int direction) {
        String id = order.neighbor(direction);
        if (id.equals(previewId)) return;
        previewId = id; previewBitmap = null; int generation = ++previewGeneration;
        layers[1 - front].setImageDrawable(null);
        FrameData.Photo photo = photos.get(id);
        repository.photo(photo, bitmap -> {
            if (!touching || generation != previewGeneration || bitmap == null || !photos.containsKey(id)) return;
            previewBitmap = bitmap; setImage(1 - front, photo, bitmap); positionDrag();
        });
    }
    private void positionDrag() {
        pages[front].setTranslationX(dragX);
        pages[1 - front].setAlpha(1);
        pages[1 - front].setTranslationX(dragX + (dragX < 0 ? getWidth() : -getWidth()));
    }
    private void cancelDrag() {
        previewGeneration++; previewId = null; previewBitmap = null; dragging = false;
        for (int index = 0; index < 2; index++) {
            final int page = index;
            float target = index == front ? 0 : (dragX < 0 ? getWidth() : -getWidth());
            pages[index].animate().translationX(target).setDuration(reducedMotion() ? 0 : 180)
                    .setInterpolator(new PathInterpolator(.2f, .8f, .2f, 1))
                    .withEndAction(page == front ? this::resumeMotion : null).start();
        }
        dragX = 0;
    }
    @Override public boolean onTouchEvent(MotionEvent event) {
        if (current == null) return super.onTouchEvent(event);
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                settleLayers(); stopMotion(); handler.removeCallbacks(advance);
                touching = true; dragging = false; moved = false; multiplePointers = false; dragX = 0;
                downX = event.getX(); downY = event.getY(); downAt = event.getEventTime();
                handler.postDelayed(longPress, 650);
                if (velocity != null) velocity.recycle();
                velocity = VelocityTracker.obtain(); velocity.addMovement(event); return true;
            case MotionEvent.ACTION_POINTER_DOWN:
                handler.removeCallbacks(longPress);
                multiplePointers = true; moved = true; cancelDrag(); return true;
            case MotionEvent.ACTION_MOVE:
                if (velocity != null) velocity.addMovement(event);
                if (multiplePointers) return true;
                float dx = event.getX() - downX, dy = event.getY() - downY;
                if (Math.hypot(dx, dy) > touchSlop) { moved = true; handler.removeCallbacks(longPress); }
                if (!dragging && order.size() > 1 && Math.abs(dx) > touchSlop && Math.abs(dx) > Math.abs(dy) * 1.2f) dragging = true;
                if (dragging) { dragX = Math.max(-getWidth(), Math.min(getWidth(), dx)); preview(dx < 0 ? 1 : -1); positionDrag(); }
                return true;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                handler.removeCallbacks(longPress);
                touching = false; shownAt = SystemClock.uptimeMillis();
                float speed = 0;
                if (velocity != null) { velocity.addMovement(event); velocity.computeCurrentVelocity(1000); speed = velocity.getXVelocity(); velocity.recycle(); velocity = null; }
                boolean released = event.getActionMasked() == MotionEvent.ACTION_UP;
                boolean commit = released && !multiplePointers && dragging &&
                        (Math.abs(dragX) > Math.max(48, getWidth() * .18f) || Math.abs(speed) > 500 && Math.abs(dragX) > touchSlop && speed * dragX > 0);
                if (commit) {
                    int direction = dragX < 0 ? 1 : -1;
                    if (previewBitmap == null) cancelDrag();
                    navigate(direction);
                } else if (dragging) cancelDrag();
                else {
                    resumeMotion();
                    if (released && !moved && !multiplePointers && event.getEventTime() - downAt < 500) performClick();
                }
                scheduleNext(); return true;
            default: return true;
        }
    }
    @Override public boolean performClick() { return super.performClick(); }
    @Override public void onInitializeAccessibilityNodeInfo(AccessibilityNodeInfo info) {
        super.onInitializeAccessibilityNodeInfo(info);
        if (order.size() > 1) { info.addAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD); info.addAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD); }
    }
    @Override public boolean performAccessibilityAction(int action, Bundle arguments) {
        if (action == AccessibilityNodeInfo.ACTION_SCROLL_FORWARD) { navigate(1); return true; }
        if (action == AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD) { navigate(-1); return true; }
        return super.performAccessibilityAction(action, arguments);
    }
    void active(boolean value) {
        if (!active && value) shownAt = SystemClock.uptimeMillis();
        active = value;
        if (!active || paused) { handler.removeCallbacks(advance); stopMotion(); }
        else { resumeMotion(); scheduleNext(); }
    }
    void paused(boolean value) { if (paused && !value) shownAt = SystemClock.uptimeMillis(); paused = value; active(active); }
    @Override protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        if (current == null && order.size() > 0) load(order.current());
        else if (current != null && (w != oldw || h != oldh)) { settleLayers(); applyGeometry(); resumeMotion(); }
    }
    @Override protected void onDetachedFromWindow() {
        active(false); handler.removeCallbacksAndMessages(null); loadGeneration++; previewGeneration++;
        if (velocity != null) { velocity.recycle(); velocity = null; }
        super.onDetachedFromWindow();
    }
    String currentId() { return current == null ? null : current.id; }
}
