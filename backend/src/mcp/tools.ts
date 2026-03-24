import { z } from 'zod'
import type {
	Address,
	Buyer,
	CompleteCheckoutRequest,
	CreateCheckoutRequest,
	UpdateCheckoutRequest,
} from '../acp/types'
import { PRODUCT_CATALOG, getProductById, searchProducts } from '../products/catalog'

const addressSchema = z.object({
	name: z.string().min(1),
	line_one: z.string().min(1),
	line_two: z.string().optional(),
	city: z.string().min(1),
	state: z.string().min(1),
	postal_code: z.string().min(1),
	country: z.string().length(2),
})

const buyerSchema = z.object({
	first_name: z.string().min(1),
	last_name: z.string().min(1),
	email: z.email(),
	phone_number: z.string().optional(),
})

export const toolSchemas = {
	listProducts: {
		category: z
			.enum(['recovery', 'performance', 'anti-aging', 'nootropics', 'metabolic'])
			.optional(),
	},
	searchProducts: {
		query: z.string().min(1),
	},
	getProductDetails: {
		productId: z.string().min(1),
	},
	createCheckout: {
		items: z
			.array(
				z.object({
					id: z.string().min(1),
					quantity: z.number().int().positive(),
				}),
			)
			.min(1),
		buyer: buyerSchema.optional(),
		fulfillmentAddress: addressSchema.optional(),
	},
	updateCheckout: {
		checkoutSessionId: z.string().min(1),
		items: z
			.array(
				z.object({
					id: z.string().min(1),
					quantity: z.number().int().positive(),
				}),
			)
			.optional(),
		buyer: buyerSchema.optional(),
		fulfillmentAddress: addressSchema.optional(),
		fulfillmentOptionId: z.string().optional(),
	},
	getCheckoutStatus: {
		checkoutSessionId: z.string().min(1),
	},
	completeCheckout: {
		checkoutSessionId: z.string().min(1),
		buyer: buyerSchema.optional(),
		paymentData: z.object({
			provider: z.string().min(1),
			token: z.string().min(1),
			billingAddress: addressSchema.optional(),
		}),
	},
	cancelCheckout: {
		checkoutSessionId: z.string().min(1),
	},
} as const

export function createToolHandlers(env: Env, origin: string) {
	return {
		listProducts: async ({
			category,
		}: {
			category?: (typeof PRODUCT_CATALOG)[number]['category']
		}) => {
			const products = category
				? PRODUCT_CATALOG.filter(product => product.category === category)
				: PRODUCT_CATALOG

			return serializeResult({
				count: products.length,
				products,
			})
		},

		searchProducts: async ({ query }: { query: string }) => {
			const products = searchProducts(query)
			return serializeResult({
				query,
				count: products.length,
				products,
			})
		},

		getProductDetails: async ({ productId }: { productId: string }) => {
			const product = getProductById(productId)
			if (!product) {
				throw new Error(`Unknown product: ${productId}`)
			}

			return serializeResult(product)
		},

		createCheckout: async ({
			items,
			buyer,
			fulfillmentAddress,
		}: {
			items: CreateCheckoutRequest['items']
			buyer?: Buyer
			fulfillmentAddress?: Address
		}) => {
			const sessionId = `checkout_${crypto.randomUUID()}`
			const stub = env.CHECKOUT_SESSIONS.getByName(sessionId)
			const checkout = await stub.createSession({
				sessionId,
				items,
				buyer,
				fulfillment_address: fulfillmentAddress,
				origin,
			})

			return serializeResult(checkout)
		},

		updateCheckout: async ({
			checkoutSessionId,
			items,
			buyer,
			fulfillmentAddress,
			fulfillmentOptionId,
		}: {
			checkoutSessionId: string
			items?: UpdateCheckoutRequest['items']
			buyer?: Buyer
			fulfillmentAddress?: Address
			fulfillmentOptionId?: string
		}) => {
			const stub = env.CHECKOUT_SESSIONS.getByName(checkoutSessionId)
			const checkout = await stub.updateSession({
				items,
				buyer,
				fulfillment_address: fulfillmentAddress,
				fulfillment_option_id: fulfillmentOptionId,
				origin,
			})

			if (!checkout) {
				throw new Error(`Unknown checkout session: ${checkoutSessionId}`)
			}

			return serializeResult(checkout)
		},

		getCheckoutStatus: async ({
			checkoutSessionId,
		}: {
			checkoutSessionId: string
		}) => {
			const stub = env.CHECKOUT_SESSIONS.getByName(checkoutSessionId)
			const checkout = await stub.getSession(origin)
			if (!checkout) {
				throw new Error(`Unknown checkout session: ${checkoutSessionId}`)
			}

			return serializeResult(checkout)
		},

		completeCheckout: async ({
			checkoutSessionId,
			buyer,
			paymentData,
		}: {
			checkoutSessionId: string
			buyer?: Buyer
			paymentData: {
				provider: string
				token: string
				billingAddress?: Address
			}
		}) => {
			const stub = env.CHECKOUT_SESSIONS.getByName(checkoutSessionId)
			const checkout = await stub.completeSession({
				buyer,
				payment_data: {
					provider: paymentData.provider,
					token: paymentData.token,
					billing_address: paymentData.billingAddress,
				},
				origin,
			} satisfies CompleteCheckoutRequest)

			if (!checkout) {
				throw new Error(`Unknown checkout session: ${checkoutSessionId}`)
			}

			return serializeResult(checkout)
		},

		cancelCheckout: async ({
			checkoutSessionId,
		}: {
			checkoutSessionId: string
		}) => {
			const stub = env.CHECKOUT_SESSIONS.getByName(checkoutSessionId)
			const checkout = await stub.cancelSession(origin)
			if (!checkout) {
				throw new Error(`Unknown checkout session: ${checkoutSessionId}`)
			}

			return serializeResult(checkout)
		},
	}
}

function serializeResult(payload: unknown) {
	const normalizedPayload = JSON.parse(JSON.stringify(payload))

	return {
		content: [
			{
				type: 'text' as const,
				text: JSON.stringify(normalizedPayload, null, 2),
			},
		],
		structuredContent: normalizedPayload as Record<string, unknown>,
	}
}
