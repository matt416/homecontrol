package org.homecontrol.frame;

final class PairingCode {
    static String display(String input) {
        String digits = input.replaceAll("[^0-9]", "");
        if (digits.length() > 8) digits = digits.substring(0, 8);
        return digits.length() <= 4 ? digits : digits.substring(0, 4) + "-" + digits.substring(4);
    }
    static boolean valid(String input) { return input.matches("[0-9]{4}-[0-9]{4}"); }
}
