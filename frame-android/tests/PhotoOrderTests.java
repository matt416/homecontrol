package org.homecontrol.frame;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Random;

/** Host-side checks: no device, private album or Android dependencies required. */
public final class PhotoOrderTests {
    public static void main(String[] arguments) {
        List<String> album = Arrays.asList("a", "b", "c", "d", "e", "f", "g", "h");
        PhotoOrder order = new PhotoOrder(new Random(42));
        order.update(album);
        List<String> cycle = new ArrayList<>();
        for (int index = 0; index < album.size(); index++) { cycle.add(order.current()); order.move(1); }
        require(new HashSet<>(cycle).equals(new HashSet<>(album)), "Shuffle repeated or skipped a photo");
        require(!cycle.equals(album), "Album was not shuffled");
        require(cycle.get(0).equals(order.current()), "Cycle did not wrap");
        String first = order.current(), next = order.neighbor(1);
        require(order.move(1).equals(next), "Preview and next disagree");
        require(order.move(-1).equals(first), "Previous did not undo next");
        require(order.move(-1).equals(cycle.get(cycle.size() - 1)), "Previous did not wrap");
        order.move(1);
        order.update(Arrays.asList("h", "g", "f", "e", "d", "c", "b", "a"));
        require(order.current().equals(first) && order.neighbor(1).equals(next), "API refresh reshuffled browsing history");
        List<String> changed = new ArrayList<>(album); changed.add("new"); changed.add("new");
        order.update(changed);
        require(order.current().equals(first) && order.size() == 9, "Adding photos reset selection or added duplicates");
        order.shuffled(false);
        require(order.current().equals(first), "Changing order replaced the current photo");
        int fixedPosition = changed.indexOf(first);
        require(order.neighbor(1).equals(changed.get((fixedPosition + 1) % 9)), "Fixed order ignored album order");
        order.shuffled(true);
        require(order.current().equals(first), "Enabling shuffle replaced the current photo");
        changed.remove(first); order.update(changed);
        require(!order.current().equals(first) && order.size() == 8, "Removed photo remained selected");
        order.update(Arrays.asList("only"));
        require(order.move(-1).equals("only") && order.move(1).equals("only"), "Single-photo album failed");
        order.update(new ArrayList<>());
        require(order.current() == null && order.move(1) == null && order.neighbor(-1) == null, "Empty album failed");
        List<String> sharedAlbum = new ArrayList<>();
        for (int index = 0; index < 5000; index++) sharedAlbum.add("shared-" + index);
        order.update(sharedAlbum);
        HashSet<String> seen = new HashSet<>();
        for (int index = 0; index < sharedAlbum.size(); index++) {
            require(seen.add(order.current()), "Large album repeated before visiting every photo");
            order.move(1);
        }
        require(seen.equals(new HashSet<>(sharedAlbum)), "Large album omitted older shared photos");
        System.out.println("PASS: shuffled cycles, reversible navigation, refresh stability, album changes and empty/single albums");
    }
    private static void require(boolean value, String message) { if (!value) throw new AssertionError(message); }
}
