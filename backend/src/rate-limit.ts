import type { RateLimitDecision } from './rate-limit-do'

const RATE_LIMIT_WINDOW_MS = 60_000
const READ_RATE_LIMIT = 60
const CHECKOUT_WRITE_RATE_LIMIT = 15
const MCP_RATE_LIMIT = 30

type RateLimitBucket = 'catalog-read' | 'checkout-write' | 'mcp'

interface RateLimitPolicy {
	bucket: RateLimitBucket
	limit: number
	windowMs: number
}

export async function enforceRateLimit(
	request: Request,
	env: Env,
	url: URL,
): Promise<{
	decision: RateLimitDecision
	headers: Record<string, string>
} | null> {
	const policy = getRateLimitPolicy(request, url)
	if (!policy) {
		return null
	}

	const clientId = getClientIdentifier(request)
	const stub = env.RATE_LIMITER.getByName(`${policy.bucket}:${clientId}`)
	const decision = await stub.consume({
		limit: policy.limit,
		windowMs: policy.windowMs,
	})

	return {
		decision,
		headers: {
			'x-rate-limit-limit': String(decision.limit),
			'x-rate-limit-remaining': String(decision.remaining),
			'x-rate-limit-reset': new Date(decision.resetAt).toISOString(),
			'retry-after': String(decision.retryAfterSeconds),
		},
	}
}

function getRateLimitPolicy(
	request: Request,
	url: URL,
): RateLimitPolicy | null {
	if (request.method === 'OPTIONS') {
		return null
	}

	if (url.pathname === '/' || url.pathname === '/health') {
		return null
	}

	if (url.pathname === '/mcp') {
		return {
			bucket: 'mcp',
			limit: MCP_RATE_LIMIT,
			windowMs: RATE_LIMIT_WINDOW_MS,
		}
	}

	if (
		request.method === 'GET' &&
		(url.pathname === '/products' ||
			url.pathname === '/products/search' ||
			/^\/products\/[^/]+$/.test(url.pathname) ||
			/^\/checkout_sessions\/[^/]+$/.test(url.pathname) ||
			/^\/orders\/[^/]+$/.test(url.pathname))
	) {
		return {
			bucket: 'catalog-read',
			limit: READ_RATE_LIMIT,
			windowMs: RATE_LIMIT_WINDOW_MS,
		}
	}

	if (url.pathname.startsWith('/checkout_sessions')) {
		return {
			bucket: 'checkout-write',
			limit: CHECKOUT_WRITE_RATE_LIMIT,
			windowMs: RATE_LIMIT_WINDOW_MS,
		}
	}

	return null
}

function getClientIdentifier(request: Request): string {
	const forwardedAddress =
		request.headers.get('cf-connecting-ip') ??
		request.headers.get('x-forwarded-for') ??
		request.headers.get('x-real-ip') ??
		'anonymous'

	return forwardedAddress.split(',')[0]?.trim() || 'anonymous'
}
