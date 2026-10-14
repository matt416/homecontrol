package org.homecontrol.frame;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

final class PairingClient {
    static String connect(String address, String code) throws Exception {
        if (!PairingCode.valid(code)) throw new IllegalArgumentException("Enter all eight numbers from your Mac.");
        HttpURLConnection connection = (HttpURLConnection)new URL(FrameRepository.validAddress(address) + "/api/pair").openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(5000); connection.setReadTimeout(10000);
        connection.setRequestMethod("POST"); connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        try {
            byte[] body = new JSONObject().put("code", code).toString().getBytes("UTF-8");
            connection.setFixedLengthStreamingMode(body.length);
            try (java.io.OutputStream output = connection.getOutputStream()) { output.write(body); }
            int status = connection.getResponseCode();
            if (status == 429) throw new IllegalArgumentException("Too many attempts. Wait a minute and try a new code.");
            if (status == 401) throw new IllegalArgumentException("That code expired or was used. Choose New Code on your Mac.");
            if (status != 200) throw new IllegalArgumentException("Could not connect. Check the Mac address and try again.");
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[1024]; int count;
                while ((count = input.read(buffer)) != -1) {
                    if (bytes.size() + count > 8192) throw new IllegalArgumentException("Unexpected server response.");
                    bytes.write(buffer, 0, count);
                }
            }
            String token = new JSONObject(bytes.toString("UTF-8")).getString("token");
            if (token.length() < 32 || token.length() > 1024 || token.contains("\n") || token.contains("\r"))
                throw new IllegalArgumentException("Unexpected server response.");
            return token;
        } finally { connection.disconnect(); }
    }
}
