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
    fun ignoresOlderStableGitHubReleaseWhilePrimaryManifestsAgree() {
        val public = UpdateManifestRecord("public", 7_004_009, 0, 
            "https://github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v7.4.9-build.492/Stagepulse-Personel-v7.4.9.apk",
            "a".repeat(64))
        val database = public.copy(source = "supabase", minimumVersion = 7_000_000)
        val oldStable = UpdateManifestRecord("github", 2_003_004, 0,
            "https://github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v2.3.4-build.12/Stagepulse-Personel-v2.3.4.apk",
            "b".repeat(64))

        val result = UpdateManifestPolicy.agreedWithOptional(listOf(public, database), oldStable)
        assertEquals(7_004_009, result?.version)
        assertEquals(7_000_000, result?.minimumVersion)
    }

    @Test
    fun sameVersionButDifferentGitHubApkIdentityFailsClosed() {
        val public = UpdateManifestRecord("public", 2_003_001, 2_000_000, url, sha)
        val database = public.copy(source = "supabase", minimumVersion = 2_001_000)
        val mismatchedGitHub = public.copy(source = "github", sha256 = "b".repeat(64))

        assertNull(UpdateManifestPolicy.agreedWithOptional(listOf(public, database), mismatchedGitHub))
    }

    @Test
    fun matchingGitHubReleaseCanBeUsedAsExtraCorroboration() {
        val public = UpdateManifestRecord("public", 2_003_001, 2_000_000, url, sha)
        val database = public.copy(source = "supabase", minimumVersion = 2_001_000)
        val github = public.copy(source = "github", minimumVersion = 0)

        val result = UpdateManifestPolicy.agreedWithOptional(listOf(public, database), github)
        assertEquals(2_003_001, result?.version)
        assertEquals(2_001_000, result?.minimumVersion)
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