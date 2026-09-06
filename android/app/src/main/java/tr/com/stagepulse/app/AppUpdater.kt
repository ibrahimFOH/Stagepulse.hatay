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
        private const val GITHUB_RELEASE_API = "https://api.github.com/repos/ibrahimFOH/Stagepulse.hatay/releases?per_page=20"
        private const val MIME = "application/vnd.android.package-archive"
        private const val PREFS = "stagepulse"
        private const val LAST_CHECK = "apk_update_last_check_ms"
        private const val PENDING_VERSION = "apk_pending_version"
        private const val PENDING_URL = "apk_pending_url"
        private const val PENDING_SHA = "apk_pending_sha256"
        private const val LAST_SUCCESS = "apk_last_successful_install_version"
        private const val INSTALLING = "apk_installing_version"
        private const val INSTALLING_SESSION = "apk_installing_session_id"
        private const val INTERVAL = 60L * 1000L
        const val INSTALL_SESSION_ID = "stagepulse_install_session_id"
        const val INSTALL_APK_PATH = "stagepulse_install_apk_path"
        const val INSTALL_VERSION = "stagepulse_install_version"
        private const val MAX_REDIRECTS = 5
        private val SHA256 = Regex("^[0-9a-f]{64}$")
    }

    private data class UpdateInfo(val source: String, val version: Int, val minimumVersion: Int, val url: String, val sha: String, val notes: String, val displayVersion: String)
    private val checking = AtomicBoolean(false)
    private val installing = AtomicBoolean(false)
    private fun prefs() = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun checkOnStartup() {
        reconcileInstallState()
        activity.window.decorView.postDelayed({ check(true) }, 500L)
    }
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
                val agreement = UpdateManifestPolicy.agreed(candidates.map {
                    UpdateManifestRecord(it.source, it.version, it.minimumVersion, it.url, it.sha)
                }) ?: throw SecurityException("Güncelleme kaynakları sürüm ve APK özeti üzerinde anlaşmıyor")
                val matching = candidates.first { it.source == agreement.source }
                val info = matching.copy(minimumVersion = agreement.minimumVersion)
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
            if (code !in 200..299 || body.isBlank()) null else org.json.JSONArray(body).optJSONObject(0)?.let { parse("supabase", it) }
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
                if (root.optString("status") != "verified") return null
                val key = if (BuildConfig.APP_VARIANT.equals("admin", true)) "admin" else "staff"
                root.optJSONObject(key)?.let { parse("public", it) }
            }
        } catch (e: Exception) {
            android.util.Log.w("StagepulseUpdater", "Public manifest failed: ${e.message}")
            null
        }
    }

    private fun fetchGitHub(): UpdateInfo? {
        return try {
            val c = (URL(GITHUB_RELEASE_API + "&t=" + System.currentTimeMillis()).openConnection() as HttpURLConnection).apply {
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

            val releases = org.json.JSONArray(body)
            val prefix = if (BuildConfig.APP_VARIANT.equals("admin", true)) "Stagepulse-Admin-v" else "Stagepulse-Personel-v"
            for (r in 0 until releases.length()) {
                val release = releases.optJSONObject(r) ?: continue
                val tag = release.optString("tag_name").removePrefix("v")
                val version = releaseVersionCode(tag) ?: continue
                val assets = release.optJSONArray("assets") ?: continue
                for (i in 0 until assets.length()) {
                    val a = assets.optJSONObject(i) ?: continue
                    val name = a.optString("name")
                    if (!name.startsWith(prefix) || !name.endsWith(".apk", true)) continue
                    val url = a.optString("browser_download_url").trim()
                    val sha = a.optString("digest").removePrefix("sha256:").trim().lowercase()
                    if (AndroidUrlPolicy.isTrustedReleaseUrl(url) && SHA256.matches(sha)) {
                        return UpdateInfo("github", version, 0, url, sha, "GitHub Release $tag", tag)
                    }
                }
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

    private fun parse(source: String, o: org.json.JSONObject): UpdateInfo? {
        val v = o.optLong("apk_version", -1)
        val min = o.optLong("minimum_version", 0).toInt()
        val url = o.optString("apk_url").trim()
        val sha = o.optString("apk_sha256").trim().lowercase()
        val display = o.optString("web_version").trim().ifBlank { "Yeni sürüm" }
        if (v <= 0 || min < 0 || !AndroidUrlPolicy.isTrustedReleaseUrl(url) || !SHA256.matches(sha)) return null
        return UpdateInfo(source, v.toInt(), min, url, sha, o.optString("notes").trim(), display)
    }

    private fun currentVersionCode(): Int {
        return try {
            val i = activity.packageManager.getPackageInfo(activity.packageName, 0)
            if (Build.VERSION.SDK_INT >= 28) i.longVersionCode.toInt() else @Suppress("DEPRECATION") i.versionCode
        } catch (_: Exception) { 0 }
    }

    private fun reconcileInstallState() {
        val requested = prefs().getInt(INSTALLING, 0)
        if (requested <= 0) return
        if (currentVersionCode() >= requested) {
            prefs().edit()
                .putLong(LAST_SUCCESS, requested.toLong())
                .remove(PENDING_VERSION).remove(PENDING_URL).remove(PENDING_SHA)
                .remove(INSTALLING).remove(INSTALLING_SESSION)
                .apply()
            return
        }
        val sessionId = prefs().getInt(INSTALLING_SESSION, -1)
        val active = if (sessionId >= 0) try {
            activity.packageManager.packageInstaller.getSessionInfo(sessionId) != null
        } catch (_: Exception) {
            false
        } else false
        if (!active) clearInstallState()
    }

    private fun savePending(i: UpdateInfo) {
        prefs().edit().putInt(PENDING_VERSION, i.version).putString(PENDING_URL, i.url).putString(PENDING_SHA, i.sha).apply()
    }

    private fun clearPending() {
        prefs().edit().remove(PENDING_VERSION).remove(PENDING_URL).remove(PENDING_SHA).apply()
    }

    private fun pending(): Triple<Int, String, String>? {
        val p = prefs()
        val v = p.getInt(PENDING_VERSION, 0)
        val u = p.getString(PENDING_URL, "").orEmpty()
        val s = p.getString(PENDING_SHA, "").orEmpty()
        return if (v > currentVersionCode() && v > 0 && AndroidUrlPolicy.isTrustedReleaseUrl(u) && SHA256.matches(s)) Triple(v, u, s) else null
    }

    private fun resumePending(): Boolean {
        if (hasActiveInstall()) return true
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
        if (hasActiveInstall()) return
        pending()?.let { install(it) } ?: check(true)
    }

    private fun install(p: Triple<Int, String, String>) {
        if (hasActiveInstall()) return
        if (!installing.compareAndSet(false, true)) return
        thread {
            try {
                val (v, url, expected) = p
                val file = File(activity.cacheDir, "stagepulse-$v.apk")
                download(url, file)
                if (!sha256(file).equals(expected, true)) throw IllegalStateException("İndirilen APK doğrulanamadı")
                verifyDownloadedPackage(file, v)
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
        if (!AndroidUrlPolicy.isTrustedReleaseUrl(url)) throw SecurityException("Güvenilmeyen APK indirme adresi")
        try {
            var current = url
            var redirects = 0
            var completed = false
            while (!completed) {
                if (!AndroidUrlPolicy.isTrustedApkDownloadHop(current)) {
                    throw SecurityException("Güvenilmeyen APK indirme yönlendirmesi")
                }
                val c = (URL(current).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    instanceFollowRedirects = false
                    connectTimeout = 10000
                    readTimeout = 120000
                    useCaches = false
                    setRequestProperty("Cache-Control", "no-cache")
                }
                try {
                    val status = c.responseCode
                    if (status in 200..299) {
                        if (!AndroidUrlPolicy.isTrustedApkDownloadHop(c.url.toString())) {
                            throw SecurityException("Güvenilmeyen nihai APK indirme adresi")
                        }
                        c.inputStream.use { input -> file.outputStream().use { out -> input.copyTo(out, 65536) } }
                        completed = true
                        continue
                    }
                    if (status !in 300..399 || redirects >= MAX_REDIRECTS) {
                        throw IllegalStateException("Güncelleme sunucusu HTTP $status")
                    }
                    val location = c.getHeaderField("Location")?.trim().orEmpty()
                    if (location.isBlank()) throw SecurityException("APK yönlendirmesi adres içermiyor")
                    val next = URL(URL(current), location).toString()
                    if (!AndroidUrlPolicy.isAllowedApkRedirect(current, next)) {
                        throw SecurityException("Güvenilmeyen APK indirme yönlendirmesi")
                    }
                    current = next
                    redirects++
                } finally {
                    c.disconnect()
                }
            }
        } catch (e: Exception) {
            file.delete()
            throw e
        }
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

    private fun verifyDownloadedPackage(file: File, expectedVersion: Int) {
        val info = activity.packageManager.getPackageArchiveInfo(file.absolutePath, 0)
            ?: throw SecurityException("İndirilen dosya geçerli bir APK değil")
        val version = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode.toInt() else @Suppress("DEPRECATION") info.versionCode
        if (info.packageName != activity.packageName || version != expectedVersion) {
            throw SecurityException("APK paket kimliği veya sürümü güncelleme bildirimiyle eşleşmiyor")
        }
    }

    private fun packageInstall(file: File, version: Int) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !activity.packageManager.canRequestPackageInstalls()
        ) {
            clearInstallState()
            openUnknownSources()
            return
        }
        var installer: PackageInstaller? = null
        var sessionId = -1
        try {
            val pi = activity.packageManager.packageInstaller
            installer = pi
            val p = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
                setSize(file.length())
                if (Build.VERSION.SDK_INT >= 31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED)
            }
            sessionId = pi.createSession(p)
            prefs().edit().putInt(INSTALLING, version).putInt(INSTALLING_SESSION, sessionId).apply()
            pi.openSession(sessionId).use { session ->
                file.inputStream().use { input -> session.openWrite("stagepulse.apk", 0, file.length()).use { out -> input.copyTo(out, 65536); session.fsync(out) } }
                val intent = Intent(activity, AppUpdateReceiver::class.java).apply {
                    putExtra(INSTALL_SESSION_ID, sessionId)
                    putExtra(INSTALL_APK_PATH, file.absolutePath)
                    putExtra(INSTALL_VERSION, version)
                }
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
                session.commit(PendingIntent.getBroadcast(activity, sessionId, intent, flags).intentSender)
            }
        } catch (_: SecurityException) {
            abandonInstallSession(installer, sessionId)
            clearInstallState()
            openUnknownSources()
        } catch (_: Exception) {
            abandonInstallSession(installer, sessionId)
            clearInstallState()
            fallbackInstall(file)
        }
    }

    private fun hasActiveInstall(): Boolean =
        prefs().getInt(INSTALLING, 0) > 0 && prefs().getInt(INSTALLING_SESSION, -1) >= 0

    private fun clearInstallState() {
        prefs().edit().remove(INSTALLING).remove(INSTALLING_SESSION).apply()
    }

    private fun abandonInstallSession(installer: PackageInstaller?, sessionId: Int) {
        if (installer != null && sessionId >= 0) try {
            installer.abandonSession(sessionId)
        } catch (_: Exception) {
            // The session may already be committed or abandoned.
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
            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                data = Uri.parse("package:${activity.packageName}")
            }
            activity.startActivity(intent)
        } catch (_: Exception) {
            activity.startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS))
        }
    }
}

class AppUpdateReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        val s = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val v = i.getIntExtra(AppUpdater.INSTALL_VERSION, 0)
        val p = c.getSharedPreferences("stagepulse", Context.MODE_PRIVATE)
        if (s == PackageInstaller.STATUS_SUCCESS) {
            p.edit().putLong("apk_last_successful_install_version", v.toLong()).remove("apk_installing_version").remove("apk_installing_session_id").remove("apk_pending_version").remove("apk_pending_url").remove("apk_pending_sha256").apply()
        } else {
            p.edit().remove("apk_installing_version").remove("apk_installing_session_id").apply()
        }
    }
}
