package com.arvydas.fivethreeone;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

/** Fires the rest alert scheduled by RestAlertPlugin. Runs with the screen off. */
public class RestAlertReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !RestAlertPlugin.ACTION.equals(intent.getAction())) return;
        fire(context, intent.getStringExtra(RestAlertPlugin.EXTRA_KIND));
    }

    static void fire(Context ctx, String kind) {
        if (kind == null) kind = "vibrate";
        boolean vibrate = kind.equals("vibrate") || kind.equals("both");
        boolean sound = kind.equals("sound") || kind.equals("both");
        if (vibrate) vibrate(ctx);
        if (sound) sound(ctx);
    }

    private static void vibrate(Context ctx) {
        Vibrator v;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            v = vm.getDefaultVibrator();
        } else {
            v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
        }
        if (v == null || !v.hasVibrator()) return;
        long[] pattern = {0, 250, 120, 250, 120, 400};
        v.vibrate(VibrationEffect.createWaveform(pattern, -1));
    }

    private static void sound(Context ctx) {
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            Ringtone r = RingtoneManager.getRingtone(ctx, uri);
            if (r == null) return;
            r.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            r.play();
        } catch (Exception ignored) {
            // no sound available
        }
    }
}
