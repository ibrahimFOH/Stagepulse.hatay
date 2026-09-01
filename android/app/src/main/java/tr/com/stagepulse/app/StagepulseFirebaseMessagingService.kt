package tr.com.stagepulse.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

class StagepulseFirebaseMessagingService : FirebaseMessagingService() {
    companion object {
        const val CHANNEL_ID = "stagepulse_default"
        private val ids = AtomicInteger(1000)
    }

    override fun onNewToken(token: String) {
        val prefs = getSharedPreferences("stagepulse", MODE_PRIVATE)
        prefs.edit().putString("fcm_token", token).apply()
        registerTokenInBackground(token, prefs.getString("access_token", null))
    }

    private fun registerTokenInBackground(token: String, accessToken: String?) {
        if (accessToken.isNullOrBlank()) return
        thread {
            try {
                val variant = BuildConfig.APP_VARIANT
                val body = "{\"token\":\"${token.replace("\\", "\\\\").replace("\"", "\\\"")}\",\"app_variant\":\"$variant\"}"
                val conn = (URL("https://mtjcqqrogjqaxkagwkti.supabase.co/functions/v1/register-android-device").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Authorization", "Bearer $accessToken")
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("apikey", BuildConfig.SUPABASE_ANON_KEY)
                    connectTimeout = 15000
                    readTimeout = 15000
                }
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val status = conn.responseCode
                if (status in 200..299) {
                    android.util.Log.i("StagepulseFCM", "FCM token yenilendi ve Android cihaz kaydı güncellendi")
                } else {
                    android.util.Log.e("StagepulseFCM", "Token yenileme kaydı başarısız: HTTP $status")
                }
                conn.disconnect()
            } catch (e: Exception) {
                android.util.Log.e("StagepulseFCM", "Token yenileme kaydı hatası", e)
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: message.data["title"] ?: "Stagepulse"
        val body = message.notification?.body ?: message.data["body"] ?: "Yeni Stagepulse bildirimi"
        val url = message.data["url"] ?: BuildConfig.PORTAL_PATH
        createChannel()
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("notification_url", url)
        }
        val pending = PendingIntent.getActivity(this, ids.incrementAndGet(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stagepulse)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        NotificationManagerCompat.from(this).notify(ids.incrementAndGet(), notification)
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Stagepulse", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Stagepulse sistem bildirimleri"
                enableVibration(true)
                setShowBadge(true)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}
