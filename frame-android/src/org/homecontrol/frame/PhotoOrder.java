package org.homecontrol.frame;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Random;

/** A shuffled album with reversible navigation and stable order across API refreshes. */
final class PhotoOrder {
    private final List<String> ids = new ArrayList<>();
    private final List<String> album = new ArrayList<>();
    private final Random random;
    private int position;
    private boolean shuffled = true;

    PhotoOrder() { this(new Random()); }
    PhotoOrder(Random random) { this.random = random; }

    void update(List<String> available) {
        String selected = current();
        album.clear();
        HashSet<String> availableIds = new HashSet<>();
        for (String id : available) if (availableIds.add(id)) album.add(id);
        if (!shuffled) {
            ids.clear(); ids.addAll(album); position = Math.max(0, ids.indexOf(selected)); return;
        }
        ids.retainAll(availableIds);
        HashSet<String> known = new HashSet<>(ids);
        List<String> added = new ArrayList<>();
        for (String id : album) if (known.add(id)) added.add(id);
        Collections.shuffle(added, random);
        ids.addAll(added);
        position = Math.max(0, ids.indexOf(selected));
    }
    void shuffled(boolean value) {
        if (shuffled == value) return;
        String selected = current(); shuffled = value; ids.clear();
        update(new ArrayList<>(album)); position = Math.max(0, ids.indexOf(selected));
    }
    String current() { return ids.isEmpty() ? null : ids.get(position); }
    String neighbor(int direction) {
        return ids.isEmpty() ? null : ids.get((position + direction + ids.size()) % ids.size());
    }
    String move(int direction) {
        if (!ids.isEmpty()) position = (position + direction + ids.size()) % ids.size();
        return current();
    }
    int size() { return ids.size(); }
}
