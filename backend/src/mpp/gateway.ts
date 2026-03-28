import { Mppx, stripe } from 'mppx/server'
import { stripeKeyValidationError } from './policy'

type MppxInstance = ReturnType<typeof Mppx.create>

const mppxByRealm = new Map<string, MppxInstance>()

function getMppx(env: Env, realm: string): MppxInstance {
	const stripeKey = env.STRIPE_SECRET_KEY!.trim()
	const mppSecret = env.MPP_SECRET_KEY!.trim()
	const cacheKey = `${realm}:${stripeKey}:${mppSecret}`
	let instance = mppxByRealm.get(cacheKey)
	if (!instance) {
		instance = Mppx.create({
			methods: [
				stripe.charge({
					networkId: 'internal',
					paymentMethodTypes: ['card', 'link'],
					secretKey: stripeKey,
				}),
			],
			secretKey: mppSecret,
			realm,
		})
		mppxByRealm.set(cacheKey, instance)
	}
	return instance
}

export type MppGateResult =
	| { kind: 'passthrough' }
	| { kind: 'misconfigured'; response: Response }
	| { kind: 'payment_required'; response: Response }
	| { kind: 'ok'; wrap: (response: Response) => Response }

/**
 * When MPP is enabled (Stripe test key + MPP_SECRET_KEY), runs the Stripe SPT
 * charge flow from mppx. Otherwise passes through without payment.
 */
export async function runMppGate(
	request: Request,
	env: Env,
): Promise<MppGateResult> {
	const keyError = stripeKeyValidationError(env.STRIPE_SECRET_KEY)
	if (keyError) {
		return {
			kind: 'misconfigured',
			response: Response.json(
				{
					type: 'server_error',
					code: 'mpp_misconfigured',
					message: keyError,
				},
				{ status: 500 },
			),
		}
	}

	const stripeKey = env.STRIPE_SECRET_KEY?.trim()
	if (!stripeKey) {
		return { kind: 'passthrough' }
	}

	if (!env.MPP_SECRET_KEY?.trim()) {
		return {
			kind: 'misconfigured',
			response: Response.json(
				{
					type: 'server_error',
					code: 'mpp_misconfigured',
					message:
						'MPP_SECRET_KEY must be set when STRIPE_SECRET_KEY is configured. Generate with: openssl rand -base64 32',
				},
				{ status: 500 },
			),
		}
	}

	const realm = new URL(request.url).host
	const mppx = getMppx(env, realm)

	const result = await mppx.charge({
		amount: '0.01',
		currency: 'usd',
		decimals: 2,
		description: 'MCP tool access (demo, Stripe test mode)',
	})(request)

	if (result.status === 402) {
		return { kind: 'payment_required', response: result.challenge }
	}

	return {
		kind: 'ok',
		wrap: (response: Response) => result.withReceipt(response),
	}
}
