package com.stagepulse.licenseadmin

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader

class MainActivity : Activity() {
    private lateinit var view: WebView
    private lateinit var assetLoader: WebViewAssetLoader

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(11, 11, 12)
        window.navigationBarColor = Color.rgb(11, 11, 12)

        view = WebView(this)
        view.setBackgroundColor(Color.rgb(11, 11, 12))
        view.settings.javaScriptEnabled = true
        view.settings.domStorageEnabled = true
        view.settings.allowFileAccess = false
        view.settings.allowContentAccess = false
        view.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        view.settings.javaScriptCanOpenWindowsAutomatically = false
        view.settings.setSupportMultipleWindows(false)

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        view.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                webView: WebView,
                request: WebResourceRequest
            ) = assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(
                webView: WebView,
                request: WebResourceRequest
            ): Boolean {
                val uri = request.url
                return uri.scheme != "https" || uri.host != "appassets.androidplatform.net"
            }
        }
        view.webChromeClient = WebChromeClient()
        setContentView(view)

        if (savedInstanceState == null) {
            view.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        } else {
            view.restoreState(savedInstanceState)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        view.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::view.isInitialized && view.canGoBack()) view.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        if (::view.isInitialized) view.destroy()
        super.onDestroy()
    }
}
