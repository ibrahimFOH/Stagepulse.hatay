package tr.com.stagepulse.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {
    companion object {
        private const val PREFS = "stagepulse"
        private const val FCM_TOKEN = "fcm_token"
        private const val FCM_PENDING_TOKEN = "fcm_pending_token"
        private const val NOTIFICATION_REQUEST = 2001
        private const val FILE_CHOOSER_REQUEST = 4101
    }

    private lateinit var webView: WebView
    private lateinit var root: FrameLayout
    private lateinit var appUpdater: AppUpdater
    private lateinit var secureTokenStore: SecureTokenStore
    private var pendingWebAudioRequest: PermissionRequest? = null
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var fcmToken: String? = null
    private var accessToken: String? = null
    @Volatile private var bridgeAllowed = false
    private var bridgeInstalled = false
    private val supabaseUrl = "https://mtjcqqrogjqaxkagwkti.supabase.co"
    private val portalPath: String get() = BuildConfig.PORTAL_PATH
    private val appVariant: String get() = BuildConfig.APP_VARIANT

    private fun expectedUrl(): String = "https://stagepulse.com.tr$portalPath?apk=$appVariant-rbac-v10"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = FrameLayout(this)
        webView = WebView(this)
        root.addView(webView, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)
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
                prefs.edit().putString(FCM_TOKEN, task.result).apply()
                if (previous != task.result) prefs.edit().putString(FCM_PENDING_TOKEN, task.result).apply()
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) webView.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_YES

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val wantsAudio = request.resources?.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) == true
                    if (!wantsAudio) { request.deny(); return@runOnUiThread }
                    if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                    } else {
                        pendingWebAudioRequest?.deny()
                        pendingWebAudioRequest = request
                        ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.RECORD_AUDIO), 2002)
                    }
                }
            }
            override fun onPermissionRequestCanceled(request: PermissionRequest) { if (pendingWebAudioRequest === request) pendingWebAudioRequest = null }
            override fun onShowFileChooser(view: WebView?, callback: ValueCallback<Array<Uri>>?, params: FileChooserParams?): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                return try {
                    val chooser = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                        putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif", "application/pdf"))
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST)
                    true
                } catch (e: Exception) { filePathCallback = null; false }
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
                val url = request.url.toString()
                if (AndroidUrlPolicy.isTrustedPortalNavigation(url, portalPath, appVariant)) return false
                bridgeAllowed = false
                try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) } catch (e: Exception) { Log.w("StagepulseWebView", "Harici bağlantı açılamadı", e) }
                return true
            }
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (!AndroidUrlPolicy.isTrustedPortalNavigation(url, portalPath, appVariant)) { bridgeAllowed = false; return }
                bridgeAllowed = true
                installMinimalBridge()
                readSupabaseSession()
            }
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIFICATION_REQUEST)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != 2002) return
        val request = pendingWebAudioRequest
        pendingWebAudioRequest = null
        if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) request?.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) else request?.deny()
    }

    private fun installMinimalBridge() {
        if (bridgeInstalled) return
        webView.addJavascriptInterface(AndroidBridge(), "StagepulseAndroid")
        bridgeInstalled = true
    }

    private fun removeMinimalBridge() {
        if (bridgeInstalled) {
            webView.removeJavascriptInterface("StagepulseAndroid")
            bridgeInstalled = false
        }
    }

    private fun readSupabaseSession() {
        webView.evaluateJavascript("""(function(){try{for(const store of [localStorage,sessionStorage])for(let i=0;i<store.length;i++){const k=store.key(i)||'';if(k.startsWith('sb-')&&k.endsWith('-auth-token')){const v=JSON.parse(store.getItem(k)||'{}');if(v.access_token)return v.access_token;}}}catch(e){}return '';})();""".trimIndent()) { value ->
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
        val auth = accessToken?.takeIf { secureTokenStore.isUsable(it) } ?: return
        thread {
            var connection: HttpURLConnection? = null
            try {
                connection = (URL("$supabaseUrl/functions/v1/register-android-device").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    connectTimeout = 15000
                    readTimeout = 15000
                    setRequestProperty("Authorization", "Bearer $auth")
                    setRequestProperty("apikey", BuildConfig.SUPABASE_ANON_KEY)
                    setRequestProperty("Content-Type", "application/json")
                }
                val safeToken = token.replace("\\", "\\\\").replace("\"", "\\\"")
                connection.outputStream.use { it.write("{\"token\":\"$safeToken\",\"app_variant\":\"$appVariant\"}".toByteArray()) }
                val status = connection.responseCode
                (if (status in 200..299) connection.inputStream else connection.errorStream)?.close()
                if (status in 200..299 && prefs.getString(FCM_PENDING_TOKEN, null) == token) prefs.edit().remove(FCM_PENDING_TOKEN).apply()
                else if (status == HttpURLConnection.HTTP_UNAUTHORIZED) { accessToken = null; secureTokenStore.clear() }
            } catch (e: Exception) {
                Log.w("StagepulseFCM", "register failed: ${e.message}")
            } finally {
                connection?.disconnect()
            }
        }
    }

    inner class AndroidBridge {
        @JavascriptInterface fun refreshSession() { runOnUiThread { if (bridgeAllowed) readSupabaseSession() } }
        @JavascriptInterface fun setAccessToken(token: String?) { runOnUiThread { if (!bridgeAllowed) return@runOnUiThread; accessToken = if (secureTokenStore.save(token)) token else null; if (accessToken != null) registerDeviceIfReady() } }
    }

    @Deprecated("Deprecated in Android API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != FILE_CHOOSER_REQUEST) return
        val callback = filePathCallback
        filePathCallback = null
        if (resultCode != RESULT_OK || callback == null) { callback?.onReceiveValue(null); return }
        val uris = mutableListOf<Uri>()
        data?.clipData?.let { clip -> for (i in 0 until clip.itemCount) uris.add(clip.getItemAt(i).uri) }
        if (uris.isEmpty()) data?.data?.let { uris.add(it) }
        callback.onReceiveValue(uris.toTypedArray())
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            if (bridgeAllowed) readSupabaseSession()
            registerDeviceIfReady()
            appUpdater.checkOnResume()
            AppUpdateWorker.schedule(this)
        }
    }

    override fun onPause() { super.onPause() }

    override fun onDestroy() {
        pendingWebAudioRequest?.deny()
        pendingWebAudioRequest = null
        removeMinimalBridge()
        super.onDestroy()
    }
}
