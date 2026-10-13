package tr.com.stagepulse.app

/**
 * Prevents a failed/cancelled Android package installation from being launched
 * automatically again on every Activity resume. A deliberate user retry clears
 * the blocked flag first.
 */
internal object UpdateInstallStatePolicy {
    fun shouldAutoResume(retryBlocked: Boolean): Boolean = !retryBlocked
}
