package tr.com.stagepulse.app

import android.app.AlertDialog
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

class AppUpdater(private val activity: MainActivity) {
    companion object {
        private const val SUPABASE_MANIFEST = "https://mtjcqqrogjqaxkagwkti.supabase.co/rest/v1/app_versions?platform=eq.%s&select=platform,web_version,apk_version,minimum_version,apk_url,apk_sha256,notes&limit=1"
        private const val PUBLIC_MANIFEST = "https://raw.githubusercontent.com/ibrahimFOH/Stagepulse.hatay/main/latest.json"
        private const val GITHUB_RELEASE_API = "https://api.github.com/repos/ibrahimFOH/Stagepulse.hatay/releases/latest"
        private const val MIME = "application/vnd.android.package-archive"
        private const val PREFS = "stagepulse"
        private const val LAST_CHECK = "apk_update_last_check_ms"
        private const val PENDING_VERSION = "apk_pending_version"
        private const val PENDING_URL = "apk_pending_url"
        private const val PENDING_SHA = "apk_pending_sha256"
        private const val LAST_SUCCESS = "apk_last_successful_install_version"
        private const val INSTALLING = "apk_installing_version"
        private const val INTERVAL = 60L * 1000L
        const val INSTALL_SESSION_ID = "stagepulse_install_session_id"
        const val INSTALL_APK_PATH = "stagepulse_install_apk_path"
        const val INSTALL_VERSION = "stagepulse_install_version"
    }

    private data class UpdateInfo(val version: Int, val minimumVersion: Int, val url: String, val sha: String, val notes: String, val displayVersion: String)
    private val checking = AtomicBoolean(false)
    private val installing = AtomicBoolean(false)
    private fun prefs() = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun checkOnStartup() { activity.window.decorView.postDelayed({ check(true) }, 500L) }
    fun checkOnResume() { activity.window.decorView.postDelayed({ if (!resumePending()) check(false) }, 250L) }
    fun manualCheck() { check(true) }

    private fun check(force: Boolean) {
        if (activity.isFinishing || (Build.VERSION.SDK_INT >= 17 && activity.isDestroyed)) return
        val now = System.currentTimeMillis()
        if (!force && now - prefs().getLong(LAST_CHECK, 0L) < INTERVAL) return
        if (!checking.compareAndSet(false, true)) return
        thread {
            try {
                val candidates = listOfNotNull(fetchSupabase(), fetchPublicManifest(), fetchGitHub())
                val info = candidates.maxByOrNull { it.version } ?: throw IllegalStateException("Güncelleme bilgisi alınamadı")
                prefs().edit().putLong(LAST_CHECK, now).apply()
                val current = currentVersionCode()
                val last = prefs().getLong(LAST_SUCCESS, 0L).toInt()
                val mustUpdate = current < info.minimumVersion
                val newer = info.version > maxOf(current, last)
                if (mustUpdate || newer) {
                    savePending(info)
                    activity.runOnUiThread { showUpdate(info, mustUpdate) }
                } else {
                    clearPending()
                }
            } catch (e: Exception) {
                prefs().edit().remove(LAST_CHECK).apply()
                android.util.Log.e("StagepulseUpdater", "Update check failed", e)
            } finally {
                checking.set(false)
            }
        }
    }

    private fun fetchSupabase(): UpdateInfo? {
        return try {
            val u = String.format(SUPABASE_MANIFEST, BuildConfig.APP_VARIANT) + "&t=" + System.currentTimeMillis()
            val c = (URL(u).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("apikey", BuildConfig.SUPABASE_ANON_KEY)
                setRequestProperty("Authorization", "Bearer ${BuildConfig.SUPABASE_ANON_KEY}")
                setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0")
                setRequestProperty("Accept", "application/json")
                connectTimeout = 5000
                readTimeout = 7000
                useCaches = false
            }
            val code = c.responseCode
            val body = if (code in 200..299) c.inputStream.bufferedReader().use { it.readText() } else ""
            c.disconnect()
            if (code !in 200..299 || body.isBlank()) null else org.json.JSONArray(body).optJSONObject(0)?.let { parse(it) }
        } catch (e: Exception) {
            android.util.Log.w("StagepulseUpdater", "Supabase failed: ${e.message}")
            null
        }
    }

    private fun fetchPublicManifest(): UpdateInfo? {
        return try {
            val u = "$PUBLIC_MANIFEST?t=${System.currentTimeMillis()}"
            val c = (URL(u).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0")
                setRequestProperty("Accept", "application/json")
                connectTimeout = 5000
                readTimeout = 7000
                useCaches = false
            }
            val code = c.responseCode
            val body = if (code in 200..299) c.inputStream.bufferedReader().use { it.readText() } else ""
            c.disconnect()
            if (code !in 200..299 || body.isBlank()) null else {
                val root = org.json.JSONObject(body)
                val key = if (BuildConfig.APP_VARIANT.equals("admin", true)) "admin" else "staff"
                root.optJSONObject(key)?.let { parse(it) }
            }
        } catch (e: Exception) {
            android.util.Log.w("StagepulseUpdater", "Public manifest failed: ${e.message}")
            null
        }
    }

    private fun fetchGitHub(): UpdateInfo? {
        return try {
            val c = (URL(GITHUB_RELEASE_API + "?t=" + System.currentTimeMillis()).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("Accept", "application/vnd.github+json")
                setRequestProperty("X-GitHub-Api-Version", "2022-11-28")
                setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0")
                connectTimeout = 5000
                readTimeout = 7000
                useCaches = false
            }
            val code = c.responseCode
            val body = if (code in 200..299) c.inputStream.bufferedReader().use { it.readText() } else ""
            c.disconnect()
            if (code !in 200..299 || body.isBlank()) return null
            val release = org.json.JSONObject(body)
            val tag = release.optString("tag_name").removePrefix("v")
            val version = releaseVersionCode(tag) ?: return null
            val prefix = if (BuildConfig.APP_VARIANT.equals("admin", true)) "Stagepulse-Admin-v" else "Stagepulse-Personel-v"
            val assets = release.optJSONArray("assets") ?: return null
            for (i in 0 until assets.length()) {
                val a = assets.optJSONObject(i) ?: continue
                val name = a.optString("name")
                if (!name.startsWith(prefix) || !name.endsWith(".apk")) continue
                val url = a.optString("browser_download_url").trim()
                val sha = a.optString("digest").removePrefix("sha256:").trim().lowercase()
                if (url.startsWith("https://") && sha.length == 64) return UpdateInfo(version, version, url, sha, "GitHub Release $tag", tag)
            }
            null
        } catch (e: Exception) {
            android.util.Log.w("StagepulseUpdater", "GitHub release failed: ${e.message}")
            null
        }
    }

    private fun releaseVersionCode(tag: String): Int? {
        return try {
            val p = tag.substringBefore("-build.").split('.')
            if (p.size != 3) null else p[0].toInt() * 1_000_000 + p[1].toInt() * 1_000 + p[2].toInt()
        } catch (_: Exception) { null }
    }

    private fun parse(o: org.json.JSONObject): UpdateInfo? {
        val v = o.optLong("apk_version", -1)
        val min = o.optLong("minimum_version", 0).toInt()
        val url = o.optString("apk_url").trim()
        val sha = o.optString("apk_sha256").trim().lowercase()
        val display = o.optString("web_version").trim().ifBlank { "Yeni sürüm" }
        if (v <= 0 || !url.startsWith("https://") || sha.length != 64) return null
        return UpdateInfo(v.toInt(), min, url, sha, o.optString("notes").trim(), display)
    }

    private fun currentVersionCode(): Int {
        return try {
            val i = activity.packageManager.getPackageInfo(activity.packageName, 0)
            if (Build.VERSION.SDK_INT >= 28) i.longVersionCode.toInt() else @Suppress("DEPRECATION") i.versionCode
        } catch (_: Exception) { 0 }
    }

    private fun savePending(i: UpdateInfo) {
        prefs().edit().putInt(PENDING_VERSION, i.version).putString(PENDING_URL, i.url).putString(PENDING_SHA, i.sha).apply()
    }

    private fun clearPending() {
        prefs().edit().remove(PENDING_VERSION).remove(PENDING_URL).remove(PENDING_SHA).remove(INSTALLING).apply()
    }

    private fun pending(): Triple<Int, String, String>? {
        val p = prefs()
        val v = p.getInt(PENDING_VERSION, 0)
        val u = p.getString(PENDING_URL, "").orEmpty()
        val s = p.getString(PENDING_SHA, "").orEmpty()
        return if (v > currentVersionCode() && v > 0 && u.startsWith("https://") && s.length == 64) Triple(v, u, s) else null
    }

    private fun resumePending(): Boolean {
        val p = pending() ?: return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.packageManager.canRequestPackageInstalls()) {
            openUnknownSources()
            return true
        }
        install(p)
        return true
    }

    private fun showUpdate(i: UpdateInfo, required: Boolean) {
        if (activity.isFinishing) return
        val title = if (required) "Zorunlu güncelleme" else "Yeni güncelleme mevcut"
        val message = buildString {
            append("Yüklü sürüm: ").append(BuildConfig.VERSION_NAME)
            append("\nYeni sürüm: ").append(i.displayVersion)
            if (i.notes.isNotBlank()) append("\n\n").append(i.notes)
        }
        val b = AlertDialog.Builder(activity).setTitle(title).setMessage(message).setPositiveButton("Güncelle") { _, _ -> startInstall() }
        if (!required) b.setNegativeButton("Daha Sonra", null)
        b.setCancelable(!required).show()
    }

    private fun startInstall() {
        pending()?.let { install(it) } ?: check(true)
    }

    private fun install(p: Triple<Int, String, String>) {
        if (!installing.compareAndSet(false, true)) return
        thread {
            try {
                val (v, url, expected) = p
                prefs().edit().putInt(INSTALLING, v).apply()
                val file = File(activity.cacheDir, "stagepulse-$v.apk")
                download(url, file)
                if (!sha256(file).equals(expected, true)) throw IllegalStateException("İndirilen APK doğrulanamadı")
                activity.runOnUiThread { packageInstall(file, v) }
            } catch (e: Exception) {
                prefs().edit().remove(INSTALLING).apply()
                activity.runOnUiThread {
                    AlertDialog.Builder(activity).setTitle("Güncelleme yüklenemedi")
                        .setMessage("Güncelleme indirilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.")
                        .setPositiveButton("Tekrar Dene") { _, _ -> startInstall() }.show()
                }
            } finally { installing.set(false) }
        }
    }

    private fun download(url: String, file: File) {
        val c = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            instanceFollowRedirects = true
            connectTimeout = 10000
            readTimeout = 120000
            useCaches = false
            setRequestProperty("Cache-Control", "no-cache")
        }
        try {
            if (c.responseCode !in 200..299) throw IllegalStateException("Güncelleme sunucusu HTTP ${c.responseCode}")
            c.inputStream.use { input -> file.outputStream().use { out -> input.copyTo(out, 65536) } }
        } finally { c.disconnect() }
        if (!file.exists() || file.length() < 1024 * 1024) throw IllegalStateException("Güncelleme dosyası geçersiz")
    }

    private fun sha256(f: File): String {
        val d = MessageDigest.getInstance("SHA-256")
        f.inputStream().use { input ->
            val b = ByteArray(65536)
            while (true) { val n = input.read(b); if (n < 0) break; d.update(b, 0, n) }
        }
        return d.digest().joinToString("") { "%02x".format(it) }
    }

    private fun packageInstall(file: File, version: Int) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !activity.packageManager.canRequestPackageInstalls()
        ) {
            openUnknownSources()
            return
        }
        try {
            val pi = activity.packageManager.packageInstaller
            val p = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
                setSize(file.length())
                if (Build.VERSION.SDK_INT >= 31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED)
            }
            val id = pi.createSession(p)
            val s = pi.openSession(id)
            file.inputStream().use { input -> s.openWrite("stagepulse.apk", 0, file.length()).use { out -> input.copyTo(out, 65536); s.fsync(out) } }
            val intent = Intent(activity, AppUpdateReceiver::class.java).apply {
                putExtra(INSTALL_SESSION_ID, id)
                putExtra(INSTALL_APK_PATH, file.absolutePath)
                putExtra(INSTALL_VERSION, version)
            }
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
            s.commit(PendingIntent.getBroadcast(activity, id, intent, flags).intentSender)
            s.close()
        } catch (_: SecurityException) {
            openUnknownSources()
        } catch (_: Exception) {
            fallbackInstall(file)
        }
    }

    private fun fallbackInstall(file: File) {
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, MIME)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            clipData = android.content.ClipData.newRawUri("Stagepulse APK", uri)
        }
        activity.startActivity(Intent.createChooser(intent, "Stagepulse güncellemesini yükle"))
    }

    private fun openUnknownSources() {
        try {
            activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")))
        } catch (_: SecurityException) {
            android.util.Log.w("StagepulseUpdater", "Bilinmeyen kaynak izni ekranı açılamadı")
        }
    }
}

class AppUpdateReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        val s = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val v = i.getIntExtra(AppUpdater.INSTALL_VERSION, 0)
        val p = c.getSharedPreferences("stagepulse", Context.MODE_PRIVATE)
        if (s == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            val pendingIntent = if (Build.VERSION.SDK_INT >= 33) i.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java) else @Suppress("DEPRECATION") i.getParcelableExtra(Intent.EXTRA_INTENT)
            pendingIntent?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                try {
                    c.startActivity(this)
                } catch (_: SecurityException) {
                    android.util.Log.w("StagepulseUpdater", "Paket yükleyici onay ekranı açılamadı")
                }
            }
        } else if (s == PackageInstaller.STATUS_SUCCESS) {
            p.edit().putLong("apk_last_successful_install_version", v.toLong()).remove("apk_pending_version").remove("apk_pending_url").remove("apk_pending_sha256").remove("apk_installing_version").apply()
            i.getStringExtra(AppUpdater.INSTALL_APK_PATH)?.let { File(it).delete() }
        }
    }
}
