package com.arvydas.fivethreeone;

import android.app.Application;

/** Installs the crash recorder for every process start (services and receivers included), not just the activity. */
public class App extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        try {
            CrashLogPlugin.install(this);
        } catch (Throwable ignored) {
            // recorder is optional
        }
    }
}
