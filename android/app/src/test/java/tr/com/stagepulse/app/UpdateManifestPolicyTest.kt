package tr.com.stagepulse.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class UpdateManifestPolicyTest {
    private val url = "https://github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v2.3.1-build.10/Stagepulse-Personel-v2.3.1.apk"
    private val sha = "a".repeat(64)

    @Test
    fun requiresTwoIndependentAgreeingSources() {
        val public = UpdateManifestRecord("public", 2_003_001, 2_000_000, url, sha)
        val database = UpdateManifestRecord("supabase", 2_003_001, 2_001_000, url, sha)

        assertNull(UpdateManifestPolicy.agreed(listOf(public)))
        assertNull(UpdateManifestPolicy.agreed(listOf(public, public)))
        assertEquals(2_003_001, UpdateManifestPolicy.agreed(listOf(public, database))?.version)
        assertEquals(2_001_000, UpdateManifestPolicy.agreed(listOf(public, database))?.minimumVersion)
    }

    @Test
    fun failsClosedOnAnyVersionHashOrUrlDisagreement() {
        val public = UpdateManifestRecord("public", 2_003_001, 2_000_000, url, sha)
        assertNull(UpdateManifestPolicy.agreed(listOf(
            public,
            public.copy(source = "supabase", version = 2_003_002)
        )))
        assertNull(UpdateManifestPolicy.agreed(listOf(
            public,
            public.copy(source = "supabase", sha256 = "b".repeat(64))
        )))
        assertNull(UpdateManifestPolicy.agreed(listOf(
            public,
            public.copy(source = "supabase", url = url.replace("Personel", "Admin"))
        )))
    }

    @Test
    fun rejectsMalformedOrUntrustedRecords() {
        val public = UpdateManifestRecord("public", 2_003_001, 2_000_000, url, sha)
        assertNull(UpdateManifestPolicy.agreed(listOf(
            public,
            public.copy(source = "supabase", sha256 = "not-a-sha")
        )))
        assertNull(UpdateManifestPolicy.agreed(listOf(
            public,
            public.copy(source = "supabase", url = "https://evil.example/app.apk")
        )))
    }
}