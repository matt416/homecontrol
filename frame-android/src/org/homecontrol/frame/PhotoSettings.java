package org.homecontrol.frame;

import android.content.SharedPreferences;
import org.json.JSONException;
import org.json.JSONObject;

/** Shared slideshow settings, with the last successful value retained offline. */
final class PhotoSettings {
    interface Listener { void changed(PhotoSettings settings); }
    interface Saved { void finished(boolean success); }
    final long durationMillis, transitionMillis;
    final boolean shuffled;

    PhotoSettings(double durationSeconds, double transitionSeconds, String order) {
        if (!(durationSeconds >= 1 && durationSeconds <= 3600)
                || !(transitionSeconds >= 0 && transitionSeconds <= 5 && transitionSeconds < durationSeconds)
                || !("random".equals(order) || "custom".equals(order))) {
            throw new IllegalArgumentException("Invalid slideshow settings");
        }
        durationMillis = Math.round(durationSeconds * 1000);
        transitionMillis = Math.round(transitionSeconds * 1000);
        shuffled = "random".equals(order);
    }
    PhotoSettings(JSONObject json) throws JSONException {
        this(json.getDouble("durationSeconds"), json.getDouble("transitionSeconds"), json.getString("order"));
    }
    JSONObject json() throws JSONException {
        return new JSONObject().put("durationSeconds", durationMillis / 1000.0)
                .put("transitionSeconds", transitionMillis / 1000.0).put("order", shuffled ? "random" : "custom");
    }
    void save(SharedPreferences preferences) {
        preferences.edit().putLong("photoDurationMillis", durationMillis)
                .putLong("photoTransitionMillis", transitionMillis).putBoolean("photoShuffle", shuffled).apply();
    }
}
