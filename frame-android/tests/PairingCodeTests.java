package org.homecontrol.frame;
public final class PairingCodeTests {
    public static void main(String[] arguments) {
        check(PairingCode.display("00123456").equals("0012-3456"), "Leading zero or separator lost");
        check(PairingCode.display("0012-3456").equals("0012-3456"), "Formatted paste changed");
        check(PairingCode.valid("0012-3456"), "Valid code rejected");
        check(!PairingCode.valid("12-345678") && !PairingCode.valid("abcdefgh") && !PairingCode.valid("1234-567"), "Malformed code accepted");
        System.out.println("PASS: pairing display, leading zeroes and validation");
    }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
}
