package org.homecontrol.frame;

import android.content.Context;
import android.graphics.Typeface;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class PairingView extends ScrollView {
    interface Connected { void accept(String address, String token); }
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile boolean closed;
    private ServerDiscovery discovery;
    PairingView(Context context, String savedAddress, Connected connected) {
        super(context); setFillViewport(true); setBackgroundColor(0xff0d1119);
        LinearLayout center = new LinearLayout(context); center.setOrientation(LinearLayout.VERTICAL); center.setGravity(Gravity.CENTER);
        center.setPadding(dp(24), dp(24), dp(24), dp(24)); addView(center, new LayoutParams(-1, -1));
        LinearLayout form = new LinearLayout(context); form.setOrientation(LinearLayout.VERTICAL); form.setGravity(Gravity.CENTER_HORIZONTAL);
        center.addView(form, new LinearLayout.LayoutParams(Math.min(dp(380), getResources().getDisplayMetrics().widthPixels - dp(48)), -2));
        ImageView logo = new ImageView(context); logo.setImageResource(R.drawable.homecontrol); logo.setContentDescription("HomeControl");
        form.addView(logo, new LinearLayout.LayoutParams(dp(82), dp(82)));
        TextView title = text("Connect your frame", 27, 0xffffffff); title.setTypeface(null, Typeface.BOLD); title.setPadding(0, dp(20), 0, dp(8)); form.addView(title);
        TextView instructions = text("Choose your Mac, then enter the code shown in its Settings.", 15, 0xffaab4c5); instructions.setPadding(0, 0, 0, dp(20)); form.addView(instructions);
        TextView nearby = text("Looking for your Mac on Wi-Fi…", 15, 0xffaab4c5); form.addView(nearby);
        LinearLayout choices = new LinearLayout(context); choices.setOrientation(LinearLayout.VERTICAL); form.addView(choices, new LinearLayout.LayoutParams(-1, -2));
        EditText address = new EditText(context); address.setSingleLine(true); address.setTextColor(0xffffffff); address.setHintTextColor(0xff9ba9bd);
        address.setHint("http://your-mac.local:8797"); address.setContentDescription("Mac address"); address.setTextSize(16);
        address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI); address.setText(savedAddress); form.addView(address, new LinearLayout.LayoutParams(-1, dp(52)));
        address.setVisibility(GONE);
        Button manual = new Button(context); manual.setText("Enter Mac address manually"); manual.setAllCaps(false); manual.setTextColor(0xff95d9ff); manual.setBackgroundColor(android.graphics.Color.TRANSPARENT); form.addView(manual);
        manual.setOnClickListener(view -> { address.setVisibility(address.getVisibility() == VISIBLE ? GONE : VISIBLE); manual.setText(address.getVisibility() == VISIBLE ? "Hide address" : "Enter Mac address manually"); });
        discovery = new ServerDiscovery(context, servers -> {
            choices.removeAllViews();
            nearby.setText(servers.isEmpty() ? "Looking for your Mac on Wi-Fi…" : "Macs on your Wi-Fi");
            if (servers.size() == 1 && address.getText().length() == 0) address.setText(servers.get(0).address);
            for (ServerDiscovery.Server server : servers) {
                Button choice = new Button(context); choice.setAllCaps(false); choice.setTextColor(0xffffffff);
                choice.setText(server.name); choice.setContentDescription("Use " + server.name);
                choice.setBackground(FrameStyle.background(server.address.equals(address.getText().toString()) ? 0xff194d83 : 0xff202b3b, 0, dp(8)));
                LinearLayout.LayoutParams row = new LinearLayout.LayoutParams(-1, dp(46)); row.topMargin = dp(6); choices.addView(choice, row);
                choice.setOnClickListener(view -> { address.setText(server.address); nearby.setText("Selected: " + server.name); address.setVisibility(GONE); manual.setText("Enter Mac address manually"); });
            }
        });
        postDelayed(() -> { if (!closed && choices.getChildCount() == 0) nearby.setText("No Mac found yet. Keep HomeControl open on the same Wi-Fi, or enter its address below."); }, 8000);
        EditText code = new EditText(context); code.setSingleLine(true); code.setTextColor(0xffffffff); code.setHintTextColor(0xff8290a6);
        code.setHint("0000-0000"); code.setContentDescription("Pairing code"); code.setTextSize(32); code.setTypeface(Typeface.MONOSPACE); code.setGravity(Gravity.CENTER);
        code.setKeyListener(android.text.method.DigitsKeyListener.getInstance("0123456789-")); code.setRawInputType(InputType.TYPE_CLASS_NUMBER); form.addView(code, new LinearLayout.LayoutParams(-1, dp(72)));
        code.addTextChangedListener(new TextWatcher() {
            boolean formatting;
            public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
            public void onTextChanged(CharSequence s, int start, int before, int count) { }
            public void afterTextChanged(Editable value) {
                if (formatting) return;
                String formatted = PairingCode.display(value.toString());
                if (formatted.equals(value.toString())) return;
                formatting = true; value.replace(0, value.length(), formatted); code.setSelection(value.length()); formatting = false;
            }
        });
        TextView error = text("", 14, 0xffffb4ab); error.setAccessibilityLiveRegion(ACCESSIBILITY_LIVE_REGION_POLITE); form.addView(error);
        Button button = new Button(context); button.setText("Connect"); button.setTextColor(0xffffffff); button.setAllCaps(false);
        button.setBackground(FrameStyle.background(0xff2879e8, 0, dp(12)));
        LinearLayout.LayoutParams action = new LinearLayout.LayoutParams(-1, dp(50)); action.topMargin = dp(16); form.addView(button, action);
        button.setOnClickListener(view -> {
            final String url;
            try { url = FrameRepository.validAddress(address.getText().toString()); }
            catch (IllegalArgumentException failure) { error.setText("Choose a Mac above or enter its address manually."); address.setVisibility(VISIBLE); return; }
            String value = code.getText().toString();
            if (!PairingCode.valid(value)) { error.setText("Enter all eight numbers from your Mac."); return; }
            button.setEnabled(false); button.setText("Connecting…"); error.setText("");
            worker.execute(() -> {
                try {
                    String token = PairingClient.connect(url, value);
                    post(() -> { if (!closed) connected.accept(url, token); });
                } catch (Exception failure) {
                    String message = failure instanceof IllegalArgumentException ? failure.getMessage() : "Could not reach your Mac. Check the address and Wi-Fi.";
                    post(() -> { if (!closed) { error.setText(message); button.setEnabled(true); button.setText("Connect"); } });
                }
            });
        });
        center.setFocusableInTouchMode(true); center.requestFocus();
    }
    private int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView text(String value, int size, int color) {
        TextView view = new TextView(getContext()); view.setText(value); view.setTextSize(size); view.setTextColor(color); view.setGravity(Gravity.CENTER); return view;
    }
    void close() { closed = true; if (discovery != null) discovery.close(); worker.shutdownNow(); }
}
