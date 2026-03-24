import { CheckoutError } from './acp/checkout'
import { CheckoutSessionDurableObject } from './acp/session-do'
import type {
	CompleteCheckoutRequest,
	CreateCheckoutRequest,
	UpdateCheckoutRequest,
} from './acp/types'
import { handleMcpRequest } from './mcp/server'
import {
	PRODUCT_CATALOG,
	getProductById,
	searchProducts,
} from './products/catalog'

const CORS_HEADERS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET,POST,OPTIONS',
	'access-control-allow-headers':
		'content-type, authorization, mcp-protocol-version',
}

export default {
	async fetch(request, env): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: CORS_HEADERS,
			})
		}

		const url = new URL(request.url)

		try {
			if (url.pathname === '/mcp') {
				return handleMcpRequest(request, env)
			}

			if (request.method === 'GET' && url.pathname === '/') {
				return jsonResponse({
					name: 'acp-peptide-pharmacy-backend',
					description:
						'ACP demo checkout API and companion MCP backend for peptide ordering workflows.',
					endpoints: [
						'GET /health',
						'GET /products',
						'GET /products/search?q=',
						'GET /products/:id',
						'ALL /mcp',
						'POST /checkout_sessions',
						'GET /checkout_sessions/:id',
						'POST /checkout_sessions/:id',
						'POST /checkout_sessions/:id/complete',
						'POST /checkout_sessions/:id/cancel',
					],
				})
			}

			if (request.method === 'GET' && url.pathname === '/health') {
				return jsonResponse({
					ok: true,
					service: 'acp-peptide-pharmacy-backend',
					version: '0.1.0',
				})
			}

			if (request.method === 'GET' && url.pathname === '/products') {
				return jsonResponse({
					products: PRODUCT_CATALOG,
				})
			}

			if (request.method === 'GET' && url.pathname === '/products/search') {
				const query = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
				return jsonResponse({
					query,
					products: searchProducts(query),
				})
			}

			const productMatch = url.pathname.match(/^\/products\/([^/]+)$/)
			if (request.method === 'GET' && productMatch) {
				const productId = productMatch[1]
				const product = getProductById(productId)
				if (!product) {
					return notFoundResponse('Product not found.')
				}

				return jsonResponse(product)
			}

			if (request.method === 'POST' && url.pathname === '/checkout_sessions') {
				const body = await readJson<CreateCheckoutRequest>(request)
				const sessionId = `checkout_${crypto.randomUUID()}`
				const stub = env.CHECKOUT_SESSIONS.getByName(sessionId)
				const session = await stub.createSession({
					sessionId,
					items: body.items,
					buyer: body.buyer,
					fulfillment_address: body.fulfillment_address,
					origin: url.origin,
				})

				return jsonResponse(session, 201)
			}

			const checkoutMatch = url.pathname.match(/^\/checkout_sessions\/([^/]+)$/)
			if (checkoutMatch) {
				const sessionId = checkoutMatch[1]
				const stub = env.CHECKOUT_SESSIONS.getByName(sessionId)

				if (request.method === 'GET') {
					const session = await stub.getSession(url.origin)
					if (!session) {
						return notFoundResponse('Checkout session not found.')
					}

					return jsonResponse(session)
				}

				if (request.method === 'POST') {
					const body = await readJson<UpdateCheckoutRequest>(request)
					const session = await stub.updateSession({
						items: body.items,
						buyer: body.buyer,
						fulfillment_address: body.fulfillment_address,
						fulfillment_option_id: body.fulfillment_option_id,
						origin: url.origin,
					})
					if (!session) {
						return notFoundResponse('Checkout session not found.')
					}

					return jsonResponse(session, 201)
				}
			}

			const completeMatch = url.pathname.match(
				/^\/checkout_sessions\/([^/]+)\/complete$/,
			)
			if (request.method === 'POST' && completeMatch) {
				const sessionId = completeMatch[1]
				const body = await readJson<CompleteCheckoutRequest>(request)
				const stub = env.CHECKOUT_SESSIONS.getByName(sessionId)
				const session = await stub.completeSession({
					buyer: body.buyer,
					payment_data: body.payment_data,
					origin: url.origin,
				})
				if (!session) {
					return notFoundResponse('Checkout session not found.')
				}

				return jsonResponse(session, 201)
			}

			const cancelMatch = url.pathname.match(
				/^\/checkout_sessions\/([^/]+)\/cancel$/,
			)
			if (request.method === 'POST' && cancelMatch) {
				const sessionId = cancelMatch[1]
				const stub = env.CHECKOUT_SESSIONS.getByName(sessionId)
				const session = await stub.cancelSession(url.origin)
				if (!session) {
					return notFoundResponse('Checkout session not found.')
				}

				return jsonResponse(session)
			}

			return notFoundResponse('Route not found.')
		} catch (error) {
			if (error instanceof CheckoutError) {
				return jsonResponse(
					{
						type: 'invalid_request',
						code: error.code,
						message: error.message,
						param: error.path,
					},
					error.statusCode,
				)
			}

			console.error('Unhandled request error', error)
			return jsonResponse(
				{
					type: 'server_error',
					message: 'Unexpected server error.',
				},
				500,
			)
		}
	},
} satisfies ExportedHandler<Env>

export { CheckoutSessionDurableObject }

function jsonResponse(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: CORS_HEADERS,
	})
}

function notFoundResponse(message: string): Response {
	return jsonResponse(
		{
			type: 'invalid_request',
			code: 'not_found',
			message,
		},
		404,
	)
}

async function readJson<T>(request: Request): Promise<T> {
	try {
		return (await request.json()) as T
	} catch (error) {
		throw new CheckoutError('Request body must be valid JSON.', {
			code: 'invalid_json',
		})
	}
}
