package com.arvydas.fivethreeone;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Counts process starts that never reached a healthy web app. After two in a row the web layer
 * opens in recovery mode (export/reset only) instead of the normal screens, so data can be
 * rescued even when the normal UI crashes at startup.
 */
@CapacitorPlugin(name = "SafeMode")
public class SafeModePlugin extends Plugin {

    private static final String PREFS = "safemode";
    private static final String KEY = "failedStarts";

    static void onProcessStart(Context ctx) {
        try {
            SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            p.edit().putInt(KEY, p.getInt(KEY, 0) + 1).apply();
        } catch (Throwable ignored) {
            // optional
        }
    }

    @PluginMethod
    public void getStartInfo(PluginCall call) {
        try {
            SharedPreferences p = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            call.resolve(new JSObject().put("failedStarts", p.getInt(KEY, 0)));
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void markHealthy(PluginCall call) {
        try {
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt(KEY, 0).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
