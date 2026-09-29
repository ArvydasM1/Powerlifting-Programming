package com.arvydas.fivethreeone;

import android.app.Application;
import android.content.Context;
import java.io.File;

/** Process-start hooks: crash recorder and the failed-start counter behind recovery mode. */
public class App extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        try {
            CrashLogPlugin.install(this);
        } catch (Throwable ignored) {
            // recorder is optional
        }
        SafeModePlugin.onProcessStart(this);
        dropServiceWorkerStorage(this);
    }

    /**
     * The web bundle used to register a PWA service worker inside the WebView, which then served the
     * bundle cached at install time after every update. The app no longer registers one on Android, and
     * this removes any leftover registration and its caches before the WebView starts. Only the
     * "Service Worker" folder is touched; IndexedDB (all logged sessions) lives in its own folder.
     */
    private static void dropServiceWorkerStorage(Context ctx) {
        try {
            File[] dirs = ctx.getDataDir().listFiles((d, name) -> name.startsWith("app_webview"));
            if (dirs == null) return;
            for (File d : dirs) {
                File profile = new File(d, "Default");
                File base = profile.isDirectory() ? profile : d;
                deleteTree(new File(base, "Service Worker"));
            }
        } catch (Throwable ignored) {
            // best effort only
        }
    }

    private static void deleteTree(File f) {
        if (!f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
