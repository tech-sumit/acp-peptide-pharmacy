import { DurableObject } from 'cloudflare:workers'

const RATE_LIMIT_STATE_KEY = 'rate-limit-state'

interface RateLimitState {
	count: number
	resetAt: number
}

export interface ConsumeRateLimitInput {
	limit: number
	windowMs: number
	now?: number
}

export interface RateLimitDecision {
	allowed: boolean
	limit: number
	remaining: number
	resetAt: number
	retryAfterSeconds: number
}

export class RateLimitDurableObject extends DurableObject<Env> {
	async consume({
		limit,
		windowMs,
		now = Date.now(),
	}: ConsumeRateLimitInput): Promise<RateLimitDecision> {
		const existingState =
			await this.ctx.storage.get<RateLimitState>(RATE_LIMIT_STATE_KEY)

		const state =
			!existingState || existingState.resetAt <= now
				? { count: 0, resetAt: now + windowMs }
				: existingState

		if (state.count >= limit) {
			await this.ctx.storage.put(RATE_LIMIT_STATE_KEY, state)
			return {
				allowed: false,
				limit,
				remaining: 0,
				resetAt: state.resetAt,
				retryAfterSeconds: Math.max(
					1,
					Math.ceil((state.resetAt - now) / 1000),
				),
			}
		}

		const nextState = {
			count: state.count + 1,
			resetAt: state.resetAt,
		}

		await this.ctx.storage.put(RATE_LIMIT_STATE_KEY, nextState)

		return {
			allowed: true,
			limit,
			remaining: Math.max(0, limit - nextState.count),
			resetAt: nextState.resetAt,
			retryAfterSeconds: Math.max(
				1,
				Math.ceil((nextState.resetAt - now) / 1000),
			),
		}
	}
}
