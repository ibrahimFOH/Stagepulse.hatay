package tr.com.stagepulse.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidUrlPolicyTest {
    @Test
    fun acceptsOnlyExactGitHubReleaseOwnerAndPath() {
        assertTrue(AndroidUrlPolicy.isTrustedReleaseUrl(
            "https://github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v2.3.0/Stagepulse-Personel-v2.3.0.apk"
        ))
        assertFalse(AndroidUrlPolicy.isTrustedReleaseUrl(
            "https://evil.github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v2/app.apk"
        ))
        assertFalse(AndroidUrlPolicy.isTrustedReleaseUrl(
            "https://github.com/other/Stagepulse.hatay/releases/download/v2/app.apk"
        ))
        assertFalse(AndroidUrlPolicy.isTrustedReleaseUrl(
            "https://github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v2/nested/app.apk"
        ))
        assertFalse(AndroidUrlPolicy.isTrustedReleaseUrl(
            "https://github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v2/%2e%2e%2fapp.apk"
        ))
        assertFalse(AndroidUrlPolicy.isTrustedReleaseUrl(
            "https://github.com/ibrahimFOH/Stagepulse.hatay/%72eleases/download/v2/app.apk"
        ))
    }

    @Test
    fun acceptsOnlyCanonicalFlavorPortal() {
        assertTrue(AndroidUrlPolicy.isCanonicalPortalUrl("https://stagepulse.com.tr/portal/offers?id=1", "/portal/"))
        assertTrue(AndroidUrlPolicy.isCanonicalPortalUrl("https://stagepulse.com.tr/admin/", "/admin/"))
        assertFalse(AndroidUrlPolicy.isCanonicalPortalUrl("https://tenant.stagepulse.com.tr/portal/", "/portal/"))
        assertFalse(AndroidUrlPolicy.isCanonicalPortalUrl("https://stagepulse.com.tr/admin/", "/portal/"))
        assertFalse(AndroidUrlPolicy.isCanonicalPortalUrl("http://stagepulse.com.tr/portal/", "/portal/"))
        assertFalse(AndroidUrlPolicy.isCanonicalPortalUrl("https://stagepulse.com.tr:443/portal/", "/portal/"))
        assertFalse(AndroidUrlPolicy.isCanonicalPortalUrl("https://stagepulse.com.tr/portal/%2e./offers", "/portal/"))
        assertFalse(AndroidUrlPolicy.isCanonicalPortalUrl("https://stagepulse.com.tr/portal/.%2e/offers", "/portal/"))
        assertFalse(AndroidUrlPolicy.isCanonicalPortalUrl("https://stagepulse.com.tr/portal/%2E%2e/offers", "/portal/"))
    }
}