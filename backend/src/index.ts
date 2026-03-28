import { CheckoutError } from './acp/checkout'
import { CheckoutSessionDurableObject } from './acp/session-do'
import type {
	CompleteCheckoutRequest,
	CreateCheckoutRequest,
	UpdateCheckoutRequest,
} from './acp/types'
import { handleMcpRequest } from './mcp/server'
import { runMppGate } from './mpp/gateway'
import { mcpPostBodyRequiresMppCharge } from './mpp/mcp-methods'
import { isMppProtectedRequest } from './mpp/policy'
import {
	PRODUCT_CATALOG,
	getProductById,
	searchProducts,
} from './products/catalog'
import { RateLimitDurableObject } from './rate-limit-do'
import { enforceRateLimit } from './rate-limit'

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
		const rateLimit = await enforceRateLimit(request, env, url)
		const rateLimitHeaders = rateLimit?.headers ?? {}

		try {
			if (rateLimit && !rateLimit.decision.allowed) {
				return jsonResponse(
					{
						type: 'invalid_request',
						code: 'rate_limited',
						message: 'Too many requests from this client. Please retry later.',
					},
					429,
					rateLimitHeaders,
				)
			}

			if (url.pathname === '/mcp') {
				let mcpResponse: Response
				if (isMppProtectedRequest(url, request.method)) {
					const bodyText = await request.text()
					const mcpHeaders = new Headers(request.headers)
					mcpHeaders.delete('content-length')
					const mcpRequest = new Request(request.url, {
						method: request.method,
						headers: mcpHeaders,
						body: bodyText,
					})
					const chargeMpp = mcpPostBodyRequiresMppCharge(bodyText)
					if (!chargeMpp) {
						mcpResponse = await handleMcpRequest(mcpRequest, env)
					} else {
						const gate = await runMppGate(mcpRequest, env)
						if (gate.kind === 'misconfigured') {
							mcpResponse = gate.response
						} else if (gate.kind === 'payment_required') {
							mcpResponse = gate.response
						} else if (gate.kind === 'ok') {
							mcpResponse = gate.wrap(
								await handleMcpRequest(mcpRequest, env),
							)
						} else {
							mcpResponse = await handleMcpRequest(mcpRequest, env)
						}
					}
				} else {
					mcpResponse = await handleMcpRequest(request, env)
				}

				return responseWithHeaders(mcpResponse, rateLimitHeaders)
			}

			if (request.method === 'GET' && url.pathname === '/') {
				return jsonResponse({
					name: 'acp-peptide-pharmacy-backend',
					description:
						'ACP demo checkout API, MCP tools, and optional MPP (Stripe test mode) on POST /mcp.',
					mpp:
						'When STRIPE_SECRET_KEY (sk_test_...) and MPP_SECRET_KEY are set, paid MCP JSON-RPC (e.g. tools/call) returns HTTP 402 until MPP payment; handshake methods like initialize and tools/list stay free. See README.',
					endpoints: [
						'GET /health',
						'GET /products',
						'GET /products/search?q=',
						'GET /products/:id',
					'GET /orders/:id',
					'ALL /mcp (MPP: POST only when configured)',
					'POST /checkout_sessions',
						'GET /checkout_sessions/:id',
						'POST /checkout_sessions/:id',
						'POST /checkout_sessions/:id/complete',
						'POST /checkout_sessions/:id/cancel',
					],
				}, 200, rateLimitHeaders)
			}

			if (request.method === 'GET' && url.pathname === '/health') {
				return jsonResponse({
					ok: true,
					service: 'acp-peptide-pharmacy-backend',
					version: '0.1.0',
				}, 200, rateLimitHeaders)
			}

			if (request.method === 'GET' && url.pathname === '/products') {
				return jsonResponse({
					products: PRODUCT_CATALOG,
				}, 200, rateLimitHeaders)
			}

			if (request.method === 'GET' && url.pathname === '/products/search') {
				const query = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
				return jsonResponse({
					query,
					products: searchProducts(query),
				}, 200, rateLimitHeaders)
			}

			const productMatch = url.pathname.match(/^\/products\/([^/]+)$/)
			if (request.method === 'GET' && productMatch) {
				const productId = productMatch[1]
				const product = getProductById(productId)
				if (!product) {
					return notFoundResponse('Product not found.', rateLimitHeaders)
				}

				return jsonResponse(product, 200, rateLimitHeaders)
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

				return jsonResponse(session, 201, rateLimitHeaders)
			}

			const checkoutMatch = url.pathname.match(/^\/checkout_sessions\/([^/]+)$/)
			if (checkoutMatch) {
				const sessionId = checkoutMatch[1]
				const stub = env.CHECKOUT_SESSIONS.getByName(sessionId)

				if (request.method === 'GET') {
					const session = await stub.getSession(url.origin)
					if (!session) {
						return notFoundResponse(
							'Checkout session not found.',
							rateLimitHeaders,
						)
					}

					return jsonResponse(session, 200, rateLimitHeaders)
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
						return notFoundResponse(
							'Checkout session not found.',
							rateLimitHeaders,
						)
					}

					return jsonResponse(session, 201, rateLimitHeaders)
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
					return notFoundResponse(
						'Checkout session not found.',
						rateLimitHeaders,
					)
				}

				return jsonResponse(session, 201, rateLimitHeaders)
			}

			const cancelMatch = url.pathname.match(
				/^\/checkout_sessions\/([^/]+)\/cancel$/,
			)
			if (request.method === 'POST' && cancelMatch) {
				const sessionId = cancelMatch[1]
				const stub = env.CHECKOUT_SESSIONS.getByName(sessionId)
				const session = await stub.cancelSession(url.origin)
				if (!session) {
					return notFoundResponse(
						'Checkout session not found.',
						rateLimitHeaders,
					)
				}

				return jsonResponse(session, 200, rateLimitHeaders)
			}

			const orderMatch = url.pathname.match(/^\/orders\/([^/]+)$/)
			if (request.method === 'GET' && orderMatch) {
				const orderId = orderMatch[1]
				const refStub = env.CHECKOUT_SESSIONS.getByName(orderId)
				const ref = await refStub.getOrderReference()
				if (!ref) {
					return notFoundResponse('Order not found.', rateLimitHeaders)
				}

				const sessionStub = env.CHECKOUT_SESSIONS.getByName(ref.sessionId)
				const session = await sessionStub.getSession(url.origin)
				if (!session?.order) {
					return notFoundResponse('Order not found.', rateLimitHeaders)
				}

				return jsonResponse(session.order, 200, rateLimitHeaders)
			}

			return notFoundResponse('Route not found.', rateLimitHeaders)
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
					rateLimitHeaders,
				)
			}

			console.error('Unhandled request error', error)
			return jsonResponse(
				{
					type: 'server_error',
					message: 'Unexpected server error.',
				},
				500,
				rateLimitHeaders,
			)
		}
	},
} satisfies ExportedHandler<Env>

export { CheckoutSessionDurableObject, RateLimitDurableObject }

function jsonResponse(
	data: unknown,
	status = 200,
	additionalHeaders: HeadersInit = {},
): Response {
	return Response.json(data, {
		status,
		headers: mergeHeaders(additionalHeaders),
	})
}

function notFoundResponse(
	message: string,
	additionalHeaders: HeadersInit = {},
): Response {
	return jsonResponse(
		{
			type: 'invalid_request',
			code: 'not_found',
			message,
		},
		404,
		additionalHeaders,
	)
}

function responseWithHeaders(
	response: Response,
	additionalHeaders: HeadersInit = {},
): Response {
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: mergeHeaders(response.headers, additionalHeaders),
	})
}

function mergeHeaders(
	...headerGroups: HeadersInit[]
): Headers {
	const headers = new Headers(CORS_HEADERS)

	for (const headerGroup of headerGroups) {
		new Headers(headerGroup).forEach((value, key) => {
			headers.set(key, value)
		})
	}

	return headers
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
