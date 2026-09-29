package com.arvydas.fivethreeone;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;

/**
 * Records uncaught native exceptions (a) to app-private storage, shown by the web layer on the
 * next launch, and (b) to the phone's Downloads folder as 531log-crash.txt, readable from the
 * Files app even when the app cannot start. The phone has no adb access.
 */
@CapacitorPlugin(name = "CrashLog")
public class CrashLogPlugin extends Plugin {

    private static final String FILE = "last-crash.txt";
    private static boolean installed = false;

    static synchronized void install(Context appContext) {
        if (installed) return;
        installed = true;
        final Context ctx = appContext.getApplicationContext();
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread thread, Throwable throwable) {
                String text = "unknown";
                try {
                    StringWriter sw = new StringWriter();
                    throwable.printStackTrace(new PrintWriter(sw));
                    text = "time: " + new java.util.Date() + "\nthread: " + thread.getName() + "\n" + sw;
                } catch (Throwable ignored) {
                    // keep going with whatever we have
                }
                try (FileWriter w = new FileWriter(new File(ctx.getFilesDir(), FILE), false)) {
                    w.write(text);
                } catch (Throwable ignored) {
                    // private copy failed
                }
                try {
                    writeToDownloads(ctx, text);
                } catch (Throwable ignored) {
                    // downloads copy failed
                }
                if (previous != null) previous.uncaughtException(thread, throwable);
            }
        });
    }

    /** Scoped-storage friendly: MediaStore.Downloads needs no permission on Android 10+. */
    private static void writeToDownloads(Context ctx, String text) throws Exception {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        ContentResolver cr = ctx.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, "531log-crash-" + System.currentTimeMillis() + ".txt");
        values.put(MediaStore.Downloads.MIME_TYPE, "text/plain");
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) return;
        try (OutputStream os = cr.openOutputStream(uri)) {
            if (os != null) os.write(text.getBytes(StandardCharsets.UTF_8));
        }
    }

    private static String readAll(File f) throws Exception {
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[(int) Math.min(f.length(), 512 * 1024)];
            int n = in.read(buf);
            return new String(buf, 0, Math.max(0, n), StandardCharsets.UTF_8);
        }
    }

    @PluginMethod
    public void read(PluginCall call) {
        try {
            File f = new File(getContext().getFilesDir(), FILE);
            JSObject ret = new JSObject();
            ret.put("text", f.exists() ? readAll(f) : null);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        try {
            File f = new File(getContext().getFilesDir(), FILE);
            if (f.exists()) f.delete();
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
