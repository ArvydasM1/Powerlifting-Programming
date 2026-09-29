package com.arvydas.fivethreeone;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-house plugins (SPEC.md §10.3) must be registered before the bridge starts.
        registerPlugin(CrashLogPlugin.class);
        registerPlugin(SafeModePlugin.class);
        registerPlugin(RestAlertPlugin.class);
        registerPlugin(SessionKeepAlivePlugin.class);
        registerPlugin(HealthConnectPlugin.class);
        super.onCreate(savedInstanceState);
        clearWebCacheOnUpdate();
    }

    /** After an update the WebView must not serve the previous build's cached files. Only the HTTP cache is cleared; IndexedDB is kept. */
    private void clearWebCacheOnUpdate() {
        try {
            long code = getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode();
            long installed = getPreferences(MODE_PRIVATE).getLong("webCacheVersion", -1);
            String lastUpdate = String.valueOf(getPackageManager().getPackageInfo(getPackageName(), 0).lastUpdateTime);
            String seen = getPreferences(MODE_PRIVATE).getString("webCacheUpdate", "");
            if (installed != code || !seen.equals(lastUpdate)) {
                getBridge().getWebView().clearCache(true);
                getPreferences(MODE_PRIVATE).edit().putLong("webCacheVersion", code).putString("webCacheUpdate", lastUpdate).apply();
            }
        } catch (Exception ignored) {
            // best effort only
        }
    }
}
