package tr.com.stagepulse.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateInstallStatePolicyTest {
    @Test
    fun pendingInstallResumesWhenNoFailureWasRecorded() {
        assertTrue(UpdateInstallStatePolicy.shouldAutoResume(retryBlocked = false))
    }

    @Test
    fun failedOrCancelledInstallRequiresExplicitRetry() {
        assertFalse(UpdateInstallStatePolicy.shouldAutoResume(retryBlocked = true))
    }
}
