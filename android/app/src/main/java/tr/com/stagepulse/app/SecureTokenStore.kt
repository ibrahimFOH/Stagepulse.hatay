package tr.com.stagepulse.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal class SecureTokenStore(private val context: Context) {
    companion object {
        private const val PREFS = "stagepulse"
        private const val LEGACY_TOKEN = "access_token"
        private const val ENCRYPTED_TOKEN = "access_token_ciphertext_v2"
        private const val TOKEN_IV = "access_token_iv_v2"
        private const val KEY_ALIAS = "stagepulse_access_token_v2"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
    }

    private val preferences get() = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun load(): String? {
        val encrypted = preferences.getString(ENCRYPTED_TOKEN, null)
        val iv = preferences.getString(TOKEN_IV, null)
        if (encrypted != null && iv != null) {
            return try {
                val cipher = Cipher.getInstance(TRANSFORMATION)
                cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
                String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), StandardCharsets.UTF_8)
                    .takeIf(::isUsable)
                    ?: run { clear(); null }
            } catch (e: Exception) {
                Log.e("StagepulseAuth", "Stored access token could not be decrypted", e)
                clear()
                null
            }
        }

        val legacy = preferences.getString(LEGACY_TOKEN, null)
        if (legacy.isNullOrBlank()) {
            clear()
            return null
        }
        return if (isUsable(legacy) && save(legacy)) legacy else {
            clear()
            null
        }
    }

    fun save(token: String?): Boolean {
        if (token.isNullOrBlank() || !isUsable(token)) {
            clear()
            return false
        }
        return try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, key())
            val ciphertext = cipher.doFinal(token.toByteArray(StandardCharsets.UTF_8))
            val committed = preferences.edit()
                .putString(ENCRYPTED_TOKEN, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                .putString(TOKEN_IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
                .remove(LEGACY_TOKEN)
                .commit()
            if (!committed) clear()
            committed
        } catch (e: Exception) {
            Log.e("StagepulseAuth", "Access token could not be encrypted", e)
            clear()
            false
        }
    }

    fun clear() {
        preferences.edit().remove(LEGACY_TOKEN).remove(ENCRYPTED_TOKEN).remove(TOKEN_IV).apply()
    }

    fun isUsable(token: String): Boolean {
        val parts = token.split('.')
        if (parts.size != 3) return false
        return try {
            val payload = String(Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING), StandardCharsets.UTF_8)
            val match = Regex("\"exp\"\\s*:\\s*(\\d+)").find(payload) ?: return false
            match.groupValues[1].toLong() > System.currentTimeMillis() / 1000L + 30L
        } catch (_: Exception) {
            false
        }
    }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }
}