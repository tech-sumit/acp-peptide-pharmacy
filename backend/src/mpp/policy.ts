/**
 * Which HTTP requests require Machine Payments Protocol (MPP) settlement
 * before the Worker runs side effects or returns paid MCP resources.
 */
export function isMppProtectedRequest(url: URL, method: string): boolean {
	if (method !== 'POST') {
		return false
	}
	return url.pathname === '/mcp'
}

/**
 * Returns an error message if Stripe cannot be used for MPP, or null if OK.
 */
export function stripeKeyValidationError(
	secret: string | undefined,
): string | null {
	if (!secret?.trim()) {
		return null
	}
	if (secret.startsWith('sk_live_')) {
		return 'Live Stripe keys are rejected for this demo Worker. Use test mode (sk_test_...).'
	}
	if (!secret.startsWith('sk_test_')) {
		return 'Stripe secret key must be a test-mode key (sk_test_...).'
	}
	return null
}

/** True when both Stripe test key and MPP HMAC secret are configured. */
export function isMppEnabled(env: Env): boolean {
	const key = env.STRIPE_SECRET_KEY?.trim()
	if (!key || stripeKeyValidationError(key) !== null) {
		return false
	}
	return Boolean(env.MPP_SECRET_KEY?.trim())
}

/**
 * Public metadata for HTTP discovery. Deployed production is a concept demo:
 * MPP never uses live Stripe — only test keys are accepted.
 */
export function mppDemoBillingMeta(env: Env): {
	mpp_enabled: boolean
	stripe_billing_mode: 'test_only'
	live_stripe_keys_rejected: true
	summary: string
} {
	return {
		mpp_enabled: isMppEnabled(env),
		stripe_billing_mode: 'test_only',
		live_stripe_keys_rejected: true,
		summary:
			'MPP uses Stripe test mode only (e.g. $0.01 demo charges). sk_live_ keys are rejected; no real-money card charges on this Worker.',
	}
}
