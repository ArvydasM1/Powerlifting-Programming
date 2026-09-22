package com.arvydas.fivethreeone;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-house plugins (SPEC.md §10.3) must be registered before the bridge starts.
        registerPlugin(RestAlertPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
