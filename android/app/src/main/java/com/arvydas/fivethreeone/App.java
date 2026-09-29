package com.arvydas.fivethreeone;

import android.app.Application;

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
    }
}
