import { describe, expect, it } from 'vitest'
import {
	isMppEnabled,
	isMppProtectedRequest,
	mppDemoBillingMeta,
	stripeKeyValidationError,
} from '../src/mpp/policy'

describe('MPP route policy', () => {
	it('protects POST /mcp only', () => {
		expect(
			isMppProtectedRequest(new URL('http://x/mcp'), 'POST'),
		).toBe(true)
		expect(isMppProtectedRequest(new URL('http://x/mcp'), 'GET')).toBe(
			false,
		)
		expect(
			isMppProtectedRequest(new URL('http://x/products'), 'POST'),
		).toBe(false)
	})

	it('rejects live Stripe keys', () => {
		expect(stripeKeyValidationError('sk_live_abc')).toContain('test mode')
		expect(stripeKeyValidationError('sk_test_abc')).toBeNull()
		expect(stripeKeyValidationError(undefined)).toBeNull()
	})

	it('isMppEnabled requires both secrets with valid test key', () => {
		expect(
			isMppEnabled({
				STRIPE_SECRET_KEY: 'sk_test_abc',
				MPP_SECRET_KEY: 'x',
			} as Env),
		).toBe(true)
		expect(
			isMppEnabled({
				STRIPE_SECRET_KEY: 'sk_test_abc',
			} as Env),
		).toBe(false)
		expect(isMppEnabled({} as Env)).toBe(false)
	})

	it('mppDemoBillingMeta always advertises test-only demo billing', () => {
		const meta = mppDemoBillingMeta({
			STRIPE_SECRET_KEY: 'sk_test_abc',
			MPP_SECRET_KEY: 'x',
		} as Env)
		expect(meta.stripe_billing_mode).toBe('test_only')
		expect(meta.live_stripe_keys_rejected).toBe(true)
		expect(meta.mpp_enabled).toBe(true)
		expect(meta.summary).toContain('test mode')
	})
})
