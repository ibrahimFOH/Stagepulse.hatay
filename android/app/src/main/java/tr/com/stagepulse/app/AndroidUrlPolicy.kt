package tr.com.stagepulse.app

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

internal object AndroidUrlPolicy {
    private const val PORTAL_HOST = "stagepulse.com.tr"
    private const val RELEASE_HOST = "github.com"
    private const val RELEASE_ASSET_HOST = "release-assets.githubusercontent.com"

    fun isTrustedReleaseUrl(value: String): Boolean {
        return parseHttps(value)?.let { uri ->
            if (!uri.host.equals(RELEASE_HOST, ignoreCase = true)) return false
            if (uri.rawQuery != null || uri.rawFragment != null) return false
            val path = uri.rawPath ?: return false
            val parts = safePathSegments(path) ?: return false
            // GitHub's canonical release URLs never need encoded path components.
            if (path.contains('%')) return false
            parts.size == 7 &&
                parts[1] == "ibrahimFOH" &&
                parts[2] == "Stagepulse.hatay" &&
                parts[3] == "releases" &&
                parts[4] == "download" &&
                parts[5].isNotBlank() &&
                parts[6].isNotBlank() &&
                parts[6].endsWith(".apk", ignoreCase = true)
        } ?: false
    }

    fun isTrustedApkDownloadHop(value: String): Boolean {
        if (isTrustedReleaseUrl(value)) return true
        return parseHttps(value)?.let { uri ->
            if (!uri.host.equals(RELEASE_ASSET_HOST, ignoreCase = true) || uri.rawFragment != null) return false
            val path = uri.rawPath ?: return false
            val parts = safePathSegments(path) ?: return false
            path.startsWith("/github-production-release-asset/") &&
                !path.contains('%') &&
                parts.size >= 3 &&
                parts.drop(1).all { it.isNotBlank() } &&
                isSafeQuery(uri.rawQuery)
        } ?: false
    }

    fun isAllowedApkRedirect(from: String, to: String): Boolean =
        isTrustedApkDownloadHop(from) && isTrustedApkDownloadHop(to)

    fun isCanonicalPortalUrl(value: String, portalPath: String): Boolean {
        return parseHttps(value)?.let { uri ->
            if (!uri.host.equals(PORTAL_HOST, ignoreCase = true)) return false
            if (uri.rawFragment != null || !isSafeQuery(uri.rawQuery)) return false
            val path = uri.rawPath ?: "/"
            if (path.contains('%') || path.contains("//") || path.contains('\\')) return false
            val parts = safePathSegments(path) ?: return false
            val normalizedPath = "/" + parts.drop(1).joinToString("/")
            val root = portalPath.removeSuffix("/")
            normalizedPath == root || normalizedPath.startsWith("$root/")
        } ?: false
    }

    fun canonicalNotificationUrl(value: String, portalPath: String): String? {
        val trimmed = value.trim()
        if (!isCanonicalPortalUrl(trimmed, portalPath)) return null
        val uri = parseHttps(trimmed) ?: return null
        val query = uri.rawQuery?.let { "?$it" }.orEmpty()
        return "https://$PORTAL_HOST${uri.rawPath ?: "/"}$query"
    }

    private fun parseHttps(value: String): URI? {
        return try {
            val uri = URI(value)
            if (
                !uri.scheme.equals("https", ignoreCase = true) ||
                uri.host.isNullOrBlank() ||
                uri.userInfo != null ||
                uri.port != -1
            ) null else uri
        } catch (_: Exception) {
            null
        }
    }

    private fun safePathSegments(rawPath: String): List<String>? {
        if (!rawPath.startsWith('/')) return null
        return rawPath.split('/').map { raw ->
            var decoded = raw
            repeat(8) {
                val next = try {
                    URLDecoder.decode(decoded, StandardCharsets.UTF_8.name())
                } catch (_: Exception) {
                    return null
                }
                if (next == decoded) return@repeat
                decoded = next
            }
            if (
                decoded == "." ||
                decoded == ".." ||
                decoded.contains('%') ||
                decoded.contains('/') ||
                decoded.contains('\\') ||
                decoded.contains('\u0000')
            ) return null
            decoded
        }
    }

    private fun isSafeQuery(rawQuery: String?): Boolean {
        if (rawQuery == null) return true
        if (rawQuery.length > 4096) return false
        var decoded = rawQuery
        repeat(3) {
            decoded = try {
                URLDecoder.decode(decoded, StandardCharsets.UTF_8.name())
            } catch (_: Exception) {
                return false
            }
        }
        return decoded.none { it == '\u0000' || it == '\r' || it == '\n' || it.code < 0x20 }
    }
}