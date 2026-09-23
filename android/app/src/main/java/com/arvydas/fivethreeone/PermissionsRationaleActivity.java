package com.arvydas.fivethreeone;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;

/** Health Connect opens this from its permission screen; it shows the app's privacy policy (SPEC.md §12.2). */
public class PermissionsRationaleActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView view = new WebView(this);
        view.loadUrl("file:///android_asset/public/privacy.html");
        setContentView(view);
    }
}
