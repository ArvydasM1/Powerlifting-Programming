package com.arvydas.fivethreeone;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * RestAlert (SPEC.md §10.3): one-shot alarm that vibrates and/or sounds at the reference rest
 * time, screen on or off. Uses AlarmManager.setAlarmClock, which is exact and needs no
 * SCHEDULE_EXACT_ALARM permission. Only one alert is pending at a time.
 */
@CapacitorPlugin(name = "RestAlert")
public class RestAlertPlugin extends Plugin {

    static final String ACTION = "com.arvydas.fivethreeone.REST_ALERT";
    static final String EXTRA_KIND = "kind";
    private static final int REQUEST_CODE = 5311;

    @PluginMethod
    public void schedule(PluginCall call) {
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
        if (at <= System.currentTimeMillis()) {
            RestAlertReceiver.fire(ctx, kind);
            call.resolve();
            return;
        }
        AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(at, pi);
        am.setAlarmClock(info, pi);
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        am.cancel(pendingIntent(ctx, "vibrate"));
        call.resolve(new JSObject());
    }

    private static PendingIntent pendingIntent(Context ctx, String kind) {
        Intent i = new Intent(ctx, RestAlertReceiver.class).setAction(ACTION).putExtra(EXTRA_KIND, kind);
        return PendingIntent.getBroadcast(ctx, REQUEST_CODE, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
