package com.arvydas.fivethreeone;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Records uncaught native exceptions to app-private storage so the web layer can show them on
 * the next launch. The phone has no adb access, so this is the only crash visibility we have.
 */
@CapacitorPlugin(name = "CrashLog")
public class CrashLogPlugin extends Plugin {

    private static final String FILE = "last-crash.txt";

    static void install(Context ctx) {
        Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                StringWriter sw = new StringWriter();
                throwable.printStackTrace(new PrintWriter(sw));
                try (FileWriter w = new FileWriter(new File(ctx.getFilesDir(), FILE), false)) {
                    w.write("thread: " + thread.getName() + "\n" + sw);
                }
            } catch (Exception ignored) {
                // nothing else we can do
            }
            if (previous != null) previous.uncaughtException(thread, throwable);
        });
    }

    @PluginMethod
    public void read(PluginCall call) {
        try {
            File f = new File(getContext().getFilesDir(), FILE);
            JSObject ret = new JSObject();
            ret.put("text", f.exists() ? new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8) : null);
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
