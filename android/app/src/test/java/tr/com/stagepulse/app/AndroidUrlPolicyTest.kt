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
        assertFalse(AndroidUrlPolicy.isCanonicalPortalUrl("https://stagepulse.com.tr/portal//offers", "/portal/"))
        assertFalse(AndroidUrlPolicy.isCanonicalPortalUrl("https://stagepulse.com.tr/portal/offers#fragment", "/portal/"))
        assertFalse(AndroidUrlPolicy.isCanonicalPortalUrl("https://stagepulse.com.tr/portal/?next=%250d%250aHeader", "/portal/"))
    }

    @Test
    fun trustedNavigationIsScopedToTheInstalledFlavor() {
        assertTrue(AndroidUrlPolicy.isTrustedPortalNavigation("https://stagepulse.com.tr/portal/offers?id=42", "/portal/"))
        assertFalse(AndroidUrlPolicy.isTrustedPortalNavigation("https://stagepulse.com.tr/admin/", "/portal/"))
        assertTrue(AndroidUrlPolicy.isTrustedPortalNavigation("https://stagepulse.com.tr/admin/", "/admin/"))
        assertFalse(AndroidUrlPolicy.isTrustedPortalNavigation("https://stagepulse.com.tr/portal/", "/admin/"))
        assertFalse(AndroidUrlPolicy.isTrustedPortalNavigation("https://tenant.stagepulse.com.tr/admin/", "/admin/"))
        assertFalse(AndroidUrlPolicy.isTrustedPortalNavigation("https://stagepulse.com.tr/admin/%2e./", "/admin/"))
    }

    @Test
    fun notificationDeepLinksAreValidatedRatherThanRewritten() {
        assertTrue(
            AndroidUrlPolicy.canonicalNotificationUrl(
                "https://stagepulse.com.tr/portal/offers?id=42&tab=open",
                "/portal/"
            ) == "https://stagepulse.com.tr/portal/offers?id=42&tab=open"
        )
        assertTrue(
            AndroidUrlPolicy.canonicalNotificationUrl(
                "https://stagepulse.com.tr/admin/",
                "/admin/"
            ) == "https://stagepulse.com.tr/admin/"
        )
        assertTrue(AndroidUrlPolicy.canonicalNotificationUrl("https://evil.example/portal/offers?id=42", "/portal/") == null)
        assertTrue(AndroidUrlPolicy.canonicalNotificationUrl("http://stagepulse.com.tr/portal/", "/portal/") == null)
        assertTrue(AndroidUrlPolicy.canonicalNotificationUrl("https://stagepulse.com.tr/portal/%2e%2e/admin", "/portal/") == null)
        assertTrue(AndroidUrlPolicy.canonicalNotificationUrl("https://stagepulse.com.tr/portal/?x=%0d%0aInjected", "/portal/") == null)
        assertTrue(AndroidUrlPolicy.canonicalNotificationUrl("https://stagepulse.com.tr/portal/#session", "/portal/") == null)
    }

    @Test
    fun validatesEveryAllowedApkRedirectHop() {
        val release = "https://github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v2.3.1-build.10/Stagepulse-Personel-v2.3.1.apk"
        val asset = "https://release-assets.githubusercontent.com/github-production-release-asset/123/abcdef?sp=r&sig=a%2Fb%3D"
        assertTrue(AndroidUrlPolicy.isTrustedApkDownloadHop(release))
        assertTrue(AndroidUrlPolicy.isTrustedApkDownloadHop(asset))
        assertTrue(AndroidUrlPolicy.isAllowedApkRedirect(release, asset))
        assertFalse(AndroidUrlPolicy.isAllowedApkRedirect(release, "https://objects.githubusercontent.com/asset.apk"))
        assertFalse(AndroidUrlPolicy.isAllowedApkRedirect(release, "https://release-assets.githubusercontent.com.evil.example/github-production-release-asset/123/a"))
        assertFalse(AndroidUrlPolicy.isAllowedApkRedirect(release, "https://release-assets.githubusercontent.com/github-production-release-asset/123/%2e%2e"))
        assertFalse(AndroidUrlPolicy.isAllowedApkRedirect(release, "https://release-assets.githubusercontent.com/github-production-release-asset/123/a?x=%0d%0aHeader"))
    }
}
