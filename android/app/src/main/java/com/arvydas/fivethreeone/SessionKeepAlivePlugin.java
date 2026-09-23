package com.arvydas.fivethreeone;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * SessionKeepAlive (SPEC.md §13): a foreground service that keeps the process, and therefore the
 * Bluetooth heart-rate connection, alive while a session is open. The notification text is the
 * current BPM.
 */
@CapacitorPlugin(name = "SessionKeepAlive")
public class SessionKeepAlivePlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        startService(call.getString("text", "Session in progress"));
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        startService(call.getString("text", "Session in progress"));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        ctx.stopService(new Intent(ctx, SessionKeepAliveService.class));
        call.resolve();
    }

    private void startService(String text) {
        Context ctx = getContext();
        Intent i = new Intent(ctx, SessionKeepAliveService.class).putExtra(SessionKeepAliveService.EXTRA_TEXT, text);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i);
        else ctx.startService(i);
    }
}
