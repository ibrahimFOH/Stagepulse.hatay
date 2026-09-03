package tr.com.stagepulse.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {
    companion object {
        private const val PREFS = "stagepulse"
        private const val FCM_TOKEN = "fcm_token"
        private const val FCM_PENDING_TOKEN = "fcm_pending_token"
    }

    private lateinit var webView: WebView
    private lateinit var appUpdater: AppUpdater
    private lateinit var secureTokenStore: SecureTokenStore
    private val supabaseUrl = "https://mtjcqqrogjqaxkagwkti.supabase.co"
    private var fcmToken: String? = null
    private var accessToken: String? = null
    @Volatile private var bridgeAllowed = false
    private var bridgeInstalled = false
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserRequest = 4101
    private val portalPath: String get() = BuildConfig.PORTAL_PATH
    private val appVariant: String get() = BuildConfig.APP_VARIANT
    private fun expectedUrl(): String = "https://stagepulse.com.tr$portalPath?apk=$appVariant-rbac-v10"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        appUpdater = AppUpdater(this)
        secureTokenStore = SecureTokenStore(this)
        configureWebView()
        requestNotificationPermission()
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        fcmToken = prefs.getString(FCM_PENDING_TOKEN, null) ?: prefs.getString(FCM_TOKEN, null)
        accessToken = secureTokenStore.load()
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val previous = prefs.getString(FCM_TOKEN, null)
                fcmToken = task.result
                val edit = prefs.edit().putString(FCM_TOKEN, task.result)
                if (previous != task.result) edit.putString(FCM_PENDING_TOKEN, task.result)
                edit.apply()
                registerDeviceIfReady()
            }
        }
        webView.loadUrl(notificationUrl(intent))
        appUpdater.checkOnStartup()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (::webView.isInitialized) webView.loadUrl(notificationUrl(intent))
    }

    private fun notificationUrl(source: Intent?): String {
        val raw = source?.getStringExtra("notification_url")?.trim().orEmpty()
        if (raw.isBlank()) return expectedUrl()
        return AndroidUrlPolicy.canonicalNotificationUrl(raw, portalPath) ?: expectedUrl()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.setSupportMultipleWindows(false)
        webView.settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
        webView.settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
        webView.clearCache(true)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(webView: WebView?, filePath: ValueCallback<Array<Uri>>?, fileChooserParams: FileChooserParams?): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePath
                return try {
                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                        putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"))
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }
                    startActivityForResult(intent, fileChooserRequest)
                    true
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback = null
                    false
                }
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                bridgeAllowed = false
                removeMinimalBridge()
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                if (AndroidUrlPolicy.isCanonicalPortalUrl(request.url.toString(), portalPath)) return false
                bridgeAllowed = false
                if (request.url.host.equals("stagepulse.com.tr", true)) {
                    Log.w("StagepulseWebView", "Portal dışı ana-frame URL engellendi: ${request.url}")
                    view.stopLoading()
                    view.loadUrl(expectedUrl())
                } else {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, request.url))
                    } catch (e: Exception) {
                        Log.w("StagepulseWebView", "Harici bağlantı açılamadı", e)
                    }
                }
                return true
            }
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (!AndroidUrlPolicy.isCanonicalPortalUrl(url, portalPath)) {
                    bridgeAllowed = false
                    Log.w("StagepulseWebView", "Kanonik portal URL değil; yeniden yükleme yapılmadı: $url")
                    return
                }
                bridgeAllowed = true
                installMinimalBridge(); readSupabaseSession()
            }
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 2001)
        }
    }

    private fun installMinimalBridge() {
        if (bridgeInstalled) return
        webView.addJavascriptInterface(AndroidBridge(), "StagepulseAndroid")
        bridgeInstalled = true
    }

    private fun removeMinimalBridge() {
        if (!bridgeInstalled) return
        webView.removeJavascriptInterface("StagepulseAndroid")
        bridgeInstalled = false
    }

    private fun readSupabaseSession() {
        webView.evaluateJavascript("""
            (function(){try{for(const store of [localStorage,sessionStorage])for(let i=0;i<store.length;i++){const k=store.key(i)||'';if(k.startsWith('sb-')&&k.endsWith('-auth-token')){const v=JSON.parse(store.getItem(k)||'{}');if(v.access_token)return v.access_token;}}}catch(e){}return '';})();
        """.trimIndent()) { value ->
            val token = value.trim('"').replace("\\\"", "\"")
            if (token.isNotBlank() && secureTokenStore.isUsable(token)) {
                if (token != accessToken && secureTokenStore.save(token)) accessToken = token
                registerDeviceIfReady()
            } else {
                accessToken = null
                secureTokenStore.clear()
            }
        }
    }

    private fun registerDeviceIfReady() {
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        val token = prefs.getString(FCM_PENDING_TOKEN, null) ?: fcmToken ?: return
        val auth = accessToken?.takeIf { secureTokenStore.isUsable(it) } ?: run {
            accessToken = null
            secureTokenStore.clear()
            return
        }
        thread {
            var c: java.net.HttpURLConnection? = null
            try {
                val connection = (java.net.URL("$supabaseUrl/functions/v1/register-android-device").openConnection() as java.net.HttpURLConnection).apply {
                    requestMethod = "POST"; doOutput = true; connectTimeout = 15000; readTimeout = 15000
                    setRequestProperty("Authorization", "Bearer $auth"); setRequestProperty("apikey", BuildConfig.SUPABASE_ANON_KEY); setRequestProperty("Content-Type", "application/json")
                }
                c = connection
                connection.outputStream.use { it.write("{\"token\":\"${token.replace("\\", "\\\\").replace("\"", "\\\"")}\",\"app_variant\":\"$appVariant\"}".toByteArray()) }
                val status = connection.responseCode
                (if (status in 200..299) connection.inputStream else connection.errorStream)?.close()
                if (status in 200..299) {
                    if (prefs.getString(FCM_PENDING_TOKEN, null) == token) prefs.edit().remove(FCM_PENDING_TOKEN).apply()
                } else {
                    if (status == java.net.HttpURLConnection.HTTP_UNAUTHORIZED) {
                        accessToken = null
                        secureTokenStore.clear()
                    }
                    Log.w("StagepulseFCM", "register failed: HTTP $status")
                }
            } catch (e: Exception) { Log.w("StagepulseFCM", "register failed: ${e.message}") }
            finally { c?.disconnect() }
        }
    }

    private fun isBridgeAllowed(): Boolean {
        return bridgeAllowed
    }

    inner class AndroidBridge {
        @JavascriptInterface fun refreshSession() { runOnUiThread { if (isBridgeAllowed()) readSupabaseSession() } }
        @JavascriptInterface fun setAccessToken(token: String?) {
            runOnUiThread {
                if (!isBridgeAllowed()) return@runOnUiThread
                accessToken = if (secureTokenStore.save(token)) token else null
                if (accessToken != null) registerDeviceIfReady()
            }
        }
    }

    @Deprecated("Deprecated in Android API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data); if (requestCode != fileChooserRequest) return
        val callback = filePathCallback; filePathCallback = null
        if (resultCode != RESULT_OK || callback == null) { callback?.onReceiveValue(null); return }
        val uris = mutableListOf<Uri>(); data?.clipData?.let { clip -> for (i in 0 until clip.itemCount) uris.add(clip.getItemAt(i).uri) }; if (uris.isEmpty()) data?.data?.let { uris.add(it) }; callback.onReceiveValue(uris.toTypedArray())
    }

    override fun onResume() { super.onResume(); if (::webView.isInitialized) { if (isBridgeAllowed()) readSupabaseSession(); registerDeviceIfReady(); appUpdater.checkOnResume(); AppUpdateWorker.schedule(this) } }
}
