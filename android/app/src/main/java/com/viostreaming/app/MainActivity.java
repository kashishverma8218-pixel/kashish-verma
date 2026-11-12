package com.viostreaming.app;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.nativead.NativeAd;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    
    // Google official sample Native Ad Unit ID for testing (replace with your production ID in release)
    private static final String AD_UNIT_ID = "ca-app-pub-3940256099942544/2247696110";
    
    private NativeAd loadedNativeAd;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Initialize Google Mobile Ads SDK
        MobileAds.initialize(this, initializationStatus -> {
            Log.d(TAG, "Google Mobile Ads initialized successfully.");
        });

        // 2. Build AdLoader for Native Ads with error handling and ad request
        AdLoader adLoader = new AdLoader.Builder(this, AD_UNIT_ID)
            .forNativeAd(nativeAd -> {
                // Prevent memory leaks if activity was destroyed while loading
                if (isDestroyed()) {
                    nativeAd.destroy();
                    return;
                }
                
                Log.d(TAG, "Native ad loaded successfully: " + nativeAd.getHeadline());
                
                // Clean up previous native ad instance if any
                if (loadedNativeAd != null) {
                    loadedNativeAd.destroy();
                }
                loadedNativeAd = nativeAd;
            })
            .withAdListener(new AdListener() {
                @Override
                public void onAdFailedToLoad(LoadAdError adError) {
                    // Error handling for native ad load failure
                    Log.e(TAG, "Native ad failed to load: " + adError.getMessage() 
                            + " (Code: " + adError.getCode() + ", Domain: " + adError.getDomain() + ")");
                }

                @Override
                public void onAdClicked() {
                    Log.d(TAG, "Native ad clicked by user.");
                }

                @Override
                public void onAdOpened() {
                    Log.d(TAG, "Native ad opened.");
                }

                @Override
                public void onAdClosed() {
                    Log.d(TAG, "Native ad closed.");
                }

                @Override
                public void onAdImpression() {
                    Log.d(TAG, "Native ad impression recorded.");
                }
            })
            .build();

        // 3. Load the native ad
        adLoader.loadAd(new AdRequest.Builder().build());
    }

    @Override
    protected void onDestroy() {
        if (loadedNativeAd != null) {
            loadedNativeAd.destroy();
            loadedNativeAd = null;
        }
        super.onDestroy();
    }
}
