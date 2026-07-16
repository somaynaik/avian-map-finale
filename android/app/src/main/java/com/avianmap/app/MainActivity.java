package com.avianmap.app;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.print.PrintManager;
import android.print.PrintDocumentAdapter;
import android.print.PrintAttributes;
import android.content.Context;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Allow media playback and audio without requiring user gesture
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);

            // Add native printing bridge
            this.bridge.getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void printPage() {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                            if (printManager != null && bridge != null && bridge.getWebView() != null) {
                                PrintDocumentAdapter printAdapter = bridge.getWebView().createPrintDocumentAdapter("AvianMap_Report");
                                String jobName = "Avian Map Sighting Report";
                                printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());
                            }
                        }
                    });
                }
            }, "AndroidPrintBridge");
        }
    }
}
