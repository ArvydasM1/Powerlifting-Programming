package com.arvydas.fivethreeone;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Foreground service behind SessionKeepAlivePlugin. Type connectedDevice, which on Android 14+
 * may only start while BLUETOOTH_CONNECT is granted. Not sticky: a dead service must not be
 * restarted by the system without the app asking, and nothing here may throw.
 */
public class SessionKeepAliveService extends Service {

    static final String EXTRA_TEXT = "text";
    private static final String CHANNEL = "session";
    private static final int ID = 5312;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            // restarted by the system without a request: do nothing
            stopSelf();
            return START_NOT_STICKY;
        }
        try {
            String text = intent.getStringExtra(EXTRA_TEXT);
            Notification n = build(text != null ? text : "Session in progress");
            boolean btGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                    || ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && btGranted) {
                startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
            } else if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(ID, n);
            } else {
                // Android 14+ requires a type we are not allowed to use yet
                stopSelf();
            }
        } catch (Throwable t) {
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private Notification build(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Session", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_menu_recent_history)
                .setContentTitle("5/3/1 Log")
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(pi)
                .build();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
