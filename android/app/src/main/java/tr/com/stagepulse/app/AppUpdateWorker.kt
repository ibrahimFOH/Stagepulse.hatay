package tr.com.stagepulse.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.TimeUnit

class AppUpdateWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    companion object {
        private const val WORK_NAME = "stagepulse_apk_update_check"
        private const val CHANNEL_ID = "stagepulse_updates"
        private const val NOTIFIED_VERSION = "apk_notified_version"
        private const val MANIFEST = "https://raw.githubusercontent.com/ibrahimFOH/Stagepulse.hatay/main/latest.json"
        private const val SUPABASE_MANIFEST = "https://mtjcqqrogjqaxkagwkti.supabase.co/rest/v1/app_versions?platform=eq.%s&select=platform,web_version,apk_version,minimum_version,apk_url,apk_sha256,notes&limit=1"
        private val SHA256 = Regex("^[0-9a-f]{64}$")

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = PeriodicWorkRequestBuilder<AppUpdateWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }

    override suspend fun doWork(): Result {
        return try {
            val root = fetchJson(MANIFEST) as? JSONObject ?: return Result.retry()
            if (root.optString("status") != "verified") return Result.success()
            val key = if (BuildConfig.APP_VARIANT.equals("admin", true)) "admin" else "staff"
            val item = root.optJSONObject(key) ?: return Result.retry()
            val supabase = fetchJson(String.format(SUPABASE_MANIFEST, BuildConfig.APP_VARIANT), true) as? JSONArray
                ?: return Result.retry()
            val databaseItem = supabase.optJSONObject(0) ?: return Result.retry()
            val remoteVersion = item.optLong("apk_version", 0L).toInt()
            val apkUrl = item.optString("apk_url").trim()
            val apkSha256 = item.optString("apk_sha256").trim().lowercase(Locale.US)
            val records = listOfNotNull(
                manifestRecord("public", item),
                manifestRecord("supabase", databaseItem)
            )
            val agreement = UpdateManifestPolicy.agreed(records) ?: return Result.success()
            if (
                agreement.version != remoteVersion ||
                agreement.url != apkUrl ||
                agreement.sha256 != apkSha256 ||
                !AndroidUrlPolicy.isTrustedReleaseUrl(apkUrl) ||
                !SHA256.matches(apkSha256)
            ) return Result.success()
            val currentVersion = currentVersionCode()
            if (remoteVersion <= currentVersion) return Result.success()

            val notified = applicationContext.getSharedPreferences("stagepulse", Context.MODE_PRIVATE)
                .getInt(NOTIFIED_VERSION, 0)
            if (remoteVersion != notified) {
                showNotification(
                    remoteVersion,
                    item.optString("web_version").ifBlank { "Yeni sürüm" },
                    item.optString("notes")
                )
                applicationContext.getSharedPreferences("stagepulse", Context.MODE_PRIVATE)
                    .edit().putInt(NOTIFIED_VERSION, remoteVersion).apply()
            }
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    private fun fetchJson(url: String, authenticated: Boolean = false): Any? {
        val separator = if (url.contains('?')) "&" else "?"
        val c = (URL("$url${separator}t=${System.currentTimeMillis()}").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0")
            setRequestProperty("Accept", "application/json")
            if (authenticated) {
                setRequestProperty("apikey", BuildConfig.SUPABASE_ANON_KEY)
                setRequestProperty("Authorization", "Bearer ${BuildConfig.SUPABASE_ANON_KEY}")
            }
            connectTimeout = 8000
            readTimeout = 12000
            useCaches = false
        }
        return try {
            if (c.responseCode !in 200..299) return null
            val body = c.inputStream.bufferedReader().use { it.readText() }
            if (authenticated) JSONArray(body) else JSONObject(body)
        } finally {
            c.disconnect()
        }
    }

    private fun manifestRecord(source: String, item: JSONObject): UpdateManifestRecord? {
        val version = item.optLong("apk_version", 0L).toInt()
        val minimum = item.optLong("minimum_version", 0L).toInt()
        val url = item.optString("apk_url").trim()
        val sha = item.optString("apk_sha256").trim().lowercase(Locale.US)
        return if (version > 0 && minimum >= 0 && AndroidUrlPolicy.isTrustedReleaseUrl(url) && SHA256.matches(sha)) {
            UpdateManifestRecord(source, version, minimum, url, sha)
        } else null
    }

    private fun currentVersionCode(): Int {
        val info = applicationContext.packageManager.getPackageInfo(applicationContext.packageName, 0)
        return if (Build.VERSION.SDK_INT >= 28) info.longVersionCode.toInt() else @Suppress("DEPRECATION") info.versionCode
    }

    private fun showNotification(version: Int, displayVersion: String, notes: String) {
        if (Build.VERSION.SDK_INT >= 33 && applicationContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Stagepulse güncellemeleri", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Stagepulse APK güncelleme bildirimleri"
                    enableVibration(true)
                    setShowBadge(true)
                }
            )
        }
        val intent = android.content.Intent(applicationContext, MainActivity::class.java).apply {
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("update_notification", true)
            putExtra("update_version", version)
        }
        val pending = PendingIntent.getActivity(
            applicationContext,
            version,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val text = if (notes.isBlank()) "Stagepulse $displayVersion için yeni APK hazır." else notes
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stagepulse)
            .setContentTitle("Stagepulse güncellemesi hazır")
            .setContentText("Yeni sürüm: $displayVersion")
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        NotificationManagerCompat.from(applicationContext).notify(20000 + (version % 10000), notification)
    }
}
