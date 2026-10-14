package org.homecontrol.frame;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.os.Looper;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;

/** Android's Bonjour discovery. Resolves serially for older Android versions. */
final class ServerDiscovery {
    static final class Server {
        final String name, address;
        Server(String name, String address) { this.name = name; this.address = address; }
    }
    interface Listener { void changed(List<Server> servers); }
    private final Handler main = new Handler(Looper.getMainLooper());
    private final NsdManager manager;
    private final Listener listener;
    private final LinkedHashMap<String, Server> servers = new LinkedHashMap<>();
    private final java.util.HashSet<String> present = new java.util.HashSet<>();
    private final ArrayDeque<NsdServiceInfo> pending = new ArrayDeque<>();
    private WifiManager.MulticastLock multicast;
    private boolean closed, started, resolving;
    private final NsdManager.DiscoveryListener discovery = new NsdManager.DiscoveryListener() {
        public void onDiscoveryStarted(String type) { }
        public void onDiscoveryStopped(String type) { }
        public void onStartDiscoveryFailed(String type, int error) { main.post(() -> { started = false; publish(); }); }
        public void onStopDiscoveryFailed(String type, int error) { }
        public void onServiceFound(NsdServiceInfo info) { main.post(() -> {
            if (closed || !info.getServiceType().contains("_homecontrol._tcp") || !present.add(info.getServiceName())) return;
            pending.add(info); resolveNext();
        }); }
        public void onServiceLost(NsdServiceInfo info) { main.post(() -> {
            present.remove(info.getServiceName()); servers.remove(info.getServiceName()); publish();
        }); }
    };
    ServerDiscovery(Context context, Listener listener) {
        this.listener = listener;
        manager = (NsdManager)context.getSystemService(Context.NSD_SERVICE);
        try {
            WifiManager wifi = (WifiManager)context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifi != null) { multicast = wifi.createMulticastLock("homecontrol-discovery"); multicast.setReferenceCounted(false); multicast.acquire(); }
            manager.discoverServices("_homecontrol._tcp.", NsdManager.PROTOCOL_DNS_SD, discovery); started = true;
        } catch (RuntimeException error) { publish(); }
    }
    private void resolveNext() {
        if (closed || resolving || pending.isEmpty()) return;
        NsdServiceInfo info = pending.removeFirst();
        if (!present.contains(info.getServiceName())) { resolveNext(); return; }
        resolving = true;
        try {
            manager.resolveService(info, new NsdManager.ResolveListener() {
                public void onResolveFailed(NsdServiceInfo service, int error) { main.post(() -> { resolving = false; resolveNext(); }); }
                public void onServiceResolved(NsdServiceInfo service) { main.post(() -> {
                    resolving = false;
                    byte[] app = service.getAttributes().get("app");
                    boolean compatible = app != null && "homecontrol".equals(new String(app, java.nio.charset.StandardCharsets.UTF_8));
                    if (!closed && compatible && present.contains(info.getServiceName()) && service.getHost() != null && !service.getHost().isLoopbackAddress()) {
                        String host = service.getHost().getHostAddress();
                        if (host != null && !host.contains(":") && service.getPort() > 0) {
                            servers.put(info.getServiceName(), new Server(info.getServiceName(), "http://" + host + ":" + service.getPort())); publish();
                        }
                    }
                    resolveNext();
                }); }
            });
        } catch (RuntimeException error) { resolving = false; resolveNext(); }
    }
    private void publish() { if (!closed) listener.changed(new ArrayList<>(servers.values())); }
    void close() {
        closed = true; pending.clear(); main.removeCallbacksAndMessages(null);
        if (started) { try { manager.stopServiceDiscovery(discovery); } catch (RuntimeException ignored) {} }
        if (multicast != null && multicast.isHeld()) multicast.release();
    }
}
