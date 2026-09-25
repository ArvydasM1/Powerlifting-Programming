package com.arvydas.fivethreeone;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * RestAlert (SPEC.md §10.3): one-shot alarm that vibrates and/or sounds at the reference rest
 * time, screen on or off. Exact alarms need SCHEDULE_EXACT_ALARM, which Android 14+ denies by
 * default; without it we fall back to an inexact alarm and report exact=false so the UI can
 * offer the settings page. Every path catches, because Capacitor turns an uncaught exception
 * in a plugin method into a process crash.
 */
@CapacitorPlugin(name = "RestAlert")
public class RestAlertPlugin extends Plugin {

    static final String ACTION = "com.arvydas.fivethreeone.REST_ALERT";
    static final String EXTRA_KIND = "kind";
    private static final int REQUEST_CODE = 5311;

    private boolean canExact(AlarmManager am) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        try {
            Long at = call.getLong("atEpochMs");
            String kind = call.getString("kind", "vibrate");
            if (at == null) {
                call.reject("atEpochMs is required");
                return;
            }
            Context ctx = getContext();
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            PendingIntent pi = pendingIntent(ctx, kind);
            am.cancel(pi);
            JSObject ret = new JSObject();
            if (at <= System.currentTimeMillis()) {
                RestAlertReceiver.fire(ctx, kind);
                ret.put("exact", true);
                call.resolve(ret);
                return;
            }
            boolean exact = canExact(am);
            if (exact) {
                try {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                } catch (SecurityException e) {
                    exact = false;
                }
            }
            if (!exact) {
                // inexact but wakes the device; typically within a few seconds outside Doze
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            }
            ret.put("exact", exact);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("schedule failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            Context ctx = getContext();
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            am.cancel(pendingIntent(ctx, "vibrate"));
            call.resolve(new JSObject());
        } catch (Exception e) {
            call.reject("cancel failed: " + e.getMessage());
        }
    }

    /** Whether exact alarms are permitted (always true before Android 12). */
    @PluginMethod
    public void canScheduleExact(PluginCall call) {
        try {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            call.resolve(new JSObject().put("exact", canExact(am)));
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /** Opens the system page where the user can allow exact alarms for this app (Android 12+). */
    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    private static PendingIntent pendingIntent(Context ctx, String kind) {
        Intent i = new Intent(ctx, RestAlertReceiver.class).setAction(ACTION).putExtra(EXTRA_KIND, kind);
        return PendingIntent.getBroadcast(ctx, REQUEST_CODE, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
