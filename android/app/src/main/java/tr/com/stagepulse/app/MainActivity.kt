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
    private lateinit var webView: WebView
    private lateinit var appUpdater: AppUpdater
    private val supabaseUrl = "https://mtjcqqrogjqaxkagwkti.supabase.co"
    private var fcmToken: String? = null
    private var accessToken: String? = null
    private var nativeLoginBridgeInstalled = false
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserRequest = 4101
    private val portalPath: String get() = BuildConfig.PORTAL_PATH
    private val appVariant: String get() = BuildConfig.APP_VARIANT
    private val isAdminApp: Boolean get() = appVariant == "admin"
    private fun expectedUrl(): String = "https://stagepulse.com.tr$portalPath?apk=$appVariant-rbac-v10"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        appUpdater = AppUpdater(this)
        configureWebView()
        requestNotificationPermission()
        val prefs = getSharedPreferences("stagepulse", MODE_PRIVATE)
        fcmToken = prefs.getString("fcm_token", null)
        accessToken = prefs.getString("access_token", null)
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                fcmToken = task.result
                prefs.edit().putString("fcm_token", task.result).apply()
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
        return try {
            val parsed = Uri.parse(raw)
            val path = parsed.path ?: return expectedUrl()
            if (!path.startsWith(portalPath)) return expectedUrl()
            Uri.Builder().scheme("https").authority("stagepulse.com.tr").path(path)
                .encodedQuery(parsed.encodedQuery).fragment(parsed.fragment).build().toString()
        } catch (_: Exception) {
            expectedUrl()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.setSupportMultipleWindows(false)
        webView.settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
        webView.clearCache(true)
        webView.addJavascriptInterface(AndroidBridge(), "StagepulseAndroid")
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
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val host = request.url.host ?: return true
                if (host == "stagepulse.com.tr" || host.endsWith(".stagepulse.com.tr")) {
                    val path = request.url.path ?: "/"
                    val wrongPortal = (isAdminApp && path.startsWith("/portal/")) || (!isAdminApp && path.startsWith("/admin/"))
                    if (wrongPortal) { view.loadUrl(expectedUrl()); return true }
                    return false
                }
                startActivity(Intent(Intent.ACTION_VIEW, request.url)); return true
            }
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                val path = try { Uri.parse(url).path ?: "/" } catch (_: Exception) { "/" }
                val wrongPortal = (isAdminApp && path.startsWith("/portal/")) || (!isAdminApp && path.startsWith("/admin/"))
                if (wrongPortal) { view.loadUrl(expectedUrl()); return }
                installNativeLoginBridge(); readSupabaseSession()
            }
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 2001)
        }
    }

    private fun installNativeLoginBridge() {
        if (nativeLoginBridgeInstalled) return
        nativeLoginBridgeInstalled = true
        webView.evaluateJavascript("""
            (function(){if(window.__stagepulseNativeLogin)return;window.__stagepulseNativeLogin=true;const originalFetch=window.fetch.bind(window);window.fetch=function(input,init){const url=typeof input==='string'?input:(input&&input.url)||'';if(/\\/functions\\/v1\\/(admin-login|portal-login)(?:\\?|$)/.test(url)&&window.StagepulseAndroid){let body={};try{body=JSON.parse((init&&init.body)||'{}')}catch(e){}try{const packet=JSON.parse(StagepulseAndroid.portalLogin(String(body.username||''),String(body.password||'')));return Promise.resolve(new Response(packet.body||'',{status:Number(packet.status)||500,headers:{'Content-Type':'application/json'}}));}catch(e){return Promise.reject(e);}}return originalFetch(input,init);};})();
        """.trimIndent(), null)
    }

    private fun readSupabaseSession() {
        webView.evaluateJavascript("""
            (function(){try{for(const store of [localStorage,sessionStorage])for(let i=0;i<store.length;i++){const k=store.key(i)||'';if(k.startsWith('sb-')&&k.endsWith('-auth-token')){const v=JSON.parse(store.getItem(k)||'{}');if(v.access_token)return v.access_token;}}}catch(e){}return '';})();
        """.trimIndent()) { value ->
            val token = value.trim('"').replace("\\\"", "\"")
            if (token.isNotBlank() && token != accessToken) {
                accessToken = token
                getSharedPreferences("stagepulse", MODE_PRIVATE).edit().putString("access_token", token).apply()
                registerDeviceIfReady()
            }
        }
    }

    private fun registerDeviceIfReady() {
        val token = fcmToken ?: return
        val auth = accessToken ?: return
        thread {
            try {
                val c = (java.net.URL("$supabaseUrl/functions/v1/register-android-device").openConnection() as java.net.HttpURLConnection).apply {
                    requestMethod = "POST"; doOutput = true; connectTimeout = 15000; readTimeout = 15000
                    setRequestProperty("Authorization", "Bearer $auth"); setRequestProperty("apikey", BuildConfig.SUPABASE_ANON_KEY); setRequestProperty("Content-Type", "application/json")
                }
                c.outputStream.use { it.write("{\"token\":\"${token.replace("\\", "\\\\").replace("\"", "\\\"")}\",\"app_variant\":\"$appVariant\"}".toByteArray()) }
                c.inputStream?.close(); c.disconnect()
            } catch (e: Exception) { Log.w("StagepulseFCM", "register failed: ${e.message}") }
        }
    }

    inner class AndroidBridge {
        @JavascriptInterface fun refreshSession() { runOnUiThread { readSupabaseSession() } }
        @JavascriptInterface fun setAccessToken(token: String?) { runOnUiThread { accessToken = token; getSharedPreferences("stagepulse", MODE_PRIVATE).edit().putString("access_token", token.orEmpty()).apply(); registerDeviceIfReady() } }
        @JavascriptInterface fun portalLogin(username: String?, password: String?): String {
            val u = username?.trim()?.lowercase().orEmpty(); val p = password.orEmpty()
            if (u.isBlank() || p.isBlank()) return packet(400, "{\"error\":\"Kullanıcı adı ve şifre zorunludur.\"}")
            val functionName = if (isAdminApp) "admin-login" else "portal-login"
            return try {
                val c = (java.net.URL("$supabaseUrl/functions/v1/$functionName").openConnection() as java.net.HttpURLConnection).apply {
                    requestMethod = "POST"; doOutput = true; connectTimeout = 15000; readTimeout = 15000
                    setRequestProperty("Content-Type", "application/json"); setRequestProperty("apikey", BuildConfig.SUPABASE_ANON_KEY); setRequestProperty("Accept", "application/json")
                }
                c.outputStream.use { it.write("{\"username\":${json(u)},\"password\":${json(p)}}".toByteArray()) }
                val status = c.responseCode; val stream = if (status in 200..299) c.inputStream else c.errorStream; val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty(); c.disconnect(); packet(status, body)
            } catch (e: Exception) { packet(0, "{\"error\":${json(e.message ?: "Bağlantı hatası")} }") }
        }
    }

    private fun packet(status: Int, body: String) = "{\"status\":$status,\"body\":${json(body)}}"
    private fun json(v: String) = "\"" + v.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\""

    @Deprecated("Deprecated in Android API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data); if (requestCode != fileChooserRequest) return
        val callback = filePathCallback; filePathCallback = null
        if (resultCode != RESULT_OK || callback == null) { callback?.onReceiveValue(null); return }
        val uris = mutableListOf<Uri>(); data?.clipData?.let { clip -> for (i in 0 until clip.itemCount) uris.add(clip.getItemAt(i).uri) }; if (uris.isEmpty()) data?.data?.let { uris.add(it) }; callback.onReceiveValue(uris.toTypedArray())
    }

    override fun onResume() { super.onResume(); if (::webView.isInitialized) { readSupabaseSession(); appUpdater.checkOnResume(); AppUpdateWorker.schedule(this) } }
}
