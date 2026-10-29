package tr.com.stagepulse.licenseadmin

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

class LicenseAdminActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var errorPanel: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = FrameLayout(this)
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    return !(uri.scheme == "https" &&
                        uri.host.equals("stagepulse.com.tr", ignoreCase = true) &&
                        (uri.path == "/lisans" || uri.path == "/lisans/" || (uri.path?.startsWith("/lisans/") == true)))
                }
                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    if (::errorPanel.isInitialized) errorPanel.visibility = View.GONE
                }
                override fun onReceivedError(view: WebView, request: WebResourceRequest, error: android.webkit.WebResourceError) {
                    super.onReceivedError(view, request, error)
                    if (request.isForMainFrame && ::errorPanel.isInitialized) errorPanel.visibility = View.VISIBLE
                }
            }
        }
        errorPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(32, 32, 32, 32)
            setBackgroundColor(Color.rgb(12, 12, 12))
            visibility = View.GONE
            addView(TextView(this@LicenseAdminActivity).apply {
                text = "STAGEPULSE · LİSANS YÖNETİMİ"
                setTextColor(Color.rgb(214, 177, 93))
                textSize = 22f
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
            })
            addView(TextView(this@LicenseAdminActivity).apply {
                text = "Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene."
                setTextColor(Color.WHITE)
                textSize = 16f
                gravity = Gravity.CENTER
                setPadding(0, 18, 0, 18)
            })
            addView(Button(this@LicenseAdminActivity).apply {
                text = "Yeniden dene"
                setOnClickListener { visibility = View.GONE; webView.loadUrl(PANEL_URL) }
            })
        }
        root.addView(webView, FrameLayout.LayoutParams(-1, -1))
        root.addView(errorPanel, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)
        if (savedInstanceState == null) webView.loadUrl(PANEL_URL) else webView.restoreState(savedInstanceState)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    companion object {
        private const val PANEL_URL = "https://stagepulse.com.tr/lisans/"
    }
}
