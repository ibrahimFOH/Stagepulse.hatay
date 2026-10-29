package com.stagepulse.licenseadmin
import android.app.Activity
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import android.graphics.Color
class MainActivity : Activity() {
 private lateinit var view: WebView
 override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); window.statusBarColor=Color.rgb(11,11,12); window.navigationBarColor=Color.rgb(11,11,12); view=WebView(this); view.setBackgroundColor(Color.rgb(11,11,12)); view.webViewClient=WebViewClient(); view.webChromeClient=WebChromeClient(); view.settings.javaScriptEnabled=true; view.settings.domStorageEnabled=true; view.settings.allowFileAccess=true; view.settings.allowContentAccess=false; view.settings.mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW; view.settings.javaScriptCanOpenWindowsAutomatically=false; view.settings.setSupportMultipleWindows(false); setContentView(view); view.loadUrl("file:///android_asset/index.html") }
 @Deprecated("Deprecated in Java") override fun onBackPressed(){ if(::view.isInitialized&&view.canGoBack())view.goBack() else super.onBackPressed() }
}
