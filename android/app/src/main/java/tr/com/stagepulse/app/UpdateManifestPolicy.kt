package tr.com.stagepulse.app

internal data class UpdateManifestRecord(
    val source: String,
    val version: Int,
    val minimumVersion: Int,
    val url: String,
    val sha256: String
)

internal object UpdateManifestPolicy {
    private val sha256Pattern = Regex("^[0-9a-f]{64}$")

    /**
     * Update metadata is accepted only when at least two independent sources
     * report the exact same APK identity. Any available disagreement fails closed.
     */
    fun agreed(records: List<UpdateManifestRecord>): UpdateManifestRecord? {
        if (records.size < 2 || records.map { it.source }.distinct().size != records.size) return null
        if (records.any {
                it.version <= 0 ||
                    it.minimumVersion < 0 ||
                    !sha256Pattern.matches(it.sha256) ||
                    !AndroidUrlPolicy.isTrustedReleaseUrl(it.url)
            }
        ) return null
        val first = records.first()
        if (records.any {
                it.version != first.version ||
                    it.sha256 != first.sha256 ||
                    it.url != first.url
            }
        ) return null
        return first.copy(minimumVersion = records.maxOf { it.minimumVersion })
    }

    /**
     * Public manifest and Supabase are the authoritative pair. GitHub Release API
     * is only an optional corroboration: its "latest stable" can legitimately be
     * older while a newer verified release is staged. Ignore version-stale assets,
     * but fail closed if GitHub advertises the same version with a different APK.
     */
    fun agreedWithOptional(
        records: List<UpdateManifestRecord>,
        optional: UpdateManifestRecord?
    ): UpdateManifestRecord? {
        val primary = agreed(records) ?: return null
        if (optional == null) return primary
        if (optional.source in records.map { it.source }) return null
        if (optional.version != primary.version) return primary
        if (optional.url != primary.url || optional.sha256 != primary.sha256) return null
        return agreed(records + optional)
    }
}