import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

const jsonHeaders = {
	'content-type': 'application/json',
}

function requestHeadersForIp(ip: string): Headers {
	return new Headers({
		...jsonHeaders,
		'cf-connecting-ip': ip,
	})
}

const address = {
	name: 'Dr. Maya Patel',
	line_one: '123 Lab Lane',
	line_two: 'Suite 12',
	city: 'Austin',
	state: 'TX',
	postal_code: '78701',
	country: 'US',
}

const buyer = {
	first_name: 'Maya',
	last_name: 'Patel',
	email: 'maya@example.com',
	phone_number: '15551234567',
}

describe('ACP peptide pharmacy API', () => {
	it('lists the peptide catalog with research-only metadata', async () => {
		const response = await SELF.fetch(new Request('http://example.com/products'))
		expect(response.status).toBe(200)

		const body = (await response.json()) as {
			products: Array<{ id: string; name: string; research_use_only: boolean }>
		}

		expect(body.products).toHaveLength(10)
		expect(body.products).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'bpc-157',
					name: 'BPC-157',
					research_use_only: true,
				}),
			]),
		)
	})

	it('searches products by query string', async () => {
		const response = await SELF.fetch(
			new Request('http://example.com/products/search?q=semax'),
		)
		expect(response.status).toBe(200)

		const body = (await response.json()) as {
			query: string
			products: Array<{ id: string }>
		}

		expect(body.query).toBe('semax')
		expect(body.products).toEqual([expect.objectContaining({ id: 'semax' })])
	})

	it('creates a checkout session from cart items', async () => {
		const response = await SELF.fetch(
			new Request('http://example.com/checkout_sessions', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					items: [{ id: 'bpc-157', quantity: 2 }],
				}),
			}),
		)

		expect(response.status).toBe(201)

		const body = (await response.json()) as {
			id: string
			status: string
			currency: string
			line_items: Array<{ item: { id: string; quantity: number } }>
			links: Array<{ type: string }>
		}

		expect(body.id).toMatch(/^checkout_/)
		expect(body.status).toBe('not_ready_for_payment')
		expect(body.currency).toBe('usd')
		expect(body.line_items).toEqual([
			expect.objectContaining({
				item: expect.objectContaining({
					id: 'bpc-157',
					quantity: 2,
				}),
			}),
		])
		expect(body.links).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: 'terms_of_use' }),
				expect.objectContaining({ type: 'privacy_policy' }),
			]),
		)
	})

	it('updates a session with buyer and fulfillment data until it is ready to pay', async () => {
		const createResponse = await SELF.fetch(
			new Request('http://example.com/checkout_sessions', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					items: [{ id: 'ghk-cu', quantity: 1 }],
				}),
			}),
		)
		const created = (await createResponse.json()) as { id: string }

		const updateResponse = await SELF.fetch(
			new Request(`http://example.com/checkout_sessions/${created.id}`, {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					buyer,
					fulfillment_address: address,
				}),
			}),
		)

		expect(updateResponse.status).toBe(201)

		const updated = (await updateResponse.json()) as {
			status: string
			fulfillment_option_id?: string
			fulfillment_options: Array<{ id: string; title: string }>
		}

		expect(updated.status).toBe('ready_for_payment')
		expect(updated.fulfillment_option_id).toBeTruthy()
		expect(updated.fulfillment_options).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ title: 'Standard Research Shipping' }),
			]),
		)
	})

	it('completes a checkout session in demo payment mode', async () => {
		const createResponse = await SELF.fetch(
			new Request('http://example.com/checkout_sessions', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					items: [{ id: 'tb-500', quantity: 1 }],
					buyer,
					fulfillment_address: address,
				}),
			}),
		)
		const created = (await createResponse.json()) as { id: string }

		const completeResponse = await SELF.fetch(
			new Request(`http://example.com/checkout_sessions/${created.id}/complete`, {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					buyer,
					payment_data: {
						provider: 'stripe',
						token: 'spt_demo_checkout_token',
						billing_address: address,
					},
				}),
			}),
		)

		expect(completeResponse.status).toBe(201)

		const completed = (await completeResponse.json()) as {
			status: string
			order: { id: string; status: string; permalink_url: string }
		}

		expect(completed.status).toBe('completed')
		expect(completed.order.id).toMatch(/^order_/)
		expect(completed.order.status).toBe('created')
		expect(completed.order.permalink_url).toContain('/orders/')
	})

	it('retrieves an order by ID via GET /orders/:id after checkout completion', async () => {
		const createResponse = await SELF.fetch(
			new Request('http://example.com/checkout_sessions', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					items: [{ id: 'bpc-157', quantity: 1 }],
					buyer,
					fulfillment_address: address,
				}),
			}),
		)
		const created = (await createResponse.json()) as { id: string }

		const completeResponse = await SELF.fetch(
			new Request(
				`http://example.com/checkout_sessions/${created.id}/complete`,
				{
					method: 'POST',
					headers: jsonHeaders,
					body: JSON.stringify({
						buyer,
						payment_data: {
							provider: 'stripe',
							token: 'spt_demo_token',
							billing_address: address,
						},
					}),
				},
			),
		)
		const completed = (await completeResponse.json()) as {
			order: { id: string; permalink_url: string }
		}

		const orderResponse = await SELF.fetch(
			new Request(`http://example.com/orders/${completed.order.id}`),
		)

		expect(orderResponse.status).toBe(200)

		const order = (await orderResponse.json()) as {
			id: string
			data: string
			checkout_session_id: string
			status: string
			permalink_url: string
		}

		expect(order.id).toBe(completed.order.id)
		expect(order.data).toBe('order')
		expect(order.checkout_session_id).toBe(created.id)
		expect(order.status).toBe('created')
		expect(order.permalink_url).toContain('/orders/')
	})

	it('returns 404 for a non-existent order ID', async () => {
		const response = await SELF.fetch(
			new Request('http://example.com/orders/order_nonexistent'),
		)

		expect(response.status).toBe(404)

		const body = (await response.json()) as { code: string }
		expect(body.code).toBe('not_found')
	})

	it('cancels an active checkout session', async () => {
		const createResponse = await SELF.fetch(
			new Request('http://example.com/checkout_sessions', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					items: [{ id: 'selank', quantity: 1 }],
				}),
			}),
		)
		const created = (await createResponse.json()) as { id: string }

		const cancelResponse = await SELF.fetch(
			new Request(`http://example.com/checkout_sessions/${created.id}/cancel`, {
				method: 'POST',
			}),
		)

		expect(cancelResponse.status).toBe(200)

		const canceled = (await cancelResponse.json()) as { status: string }
		expect(canceled.status).toBe('canceled')
	})

	it('rate limits repeated catalog reads from the same IP address', async () => {
		const ip = '198.51.100.10'
		let finalResponse: Response | undefined

		for (let attempt = 0; attempt < 61; attempt += 1) {
			finalResponse = await SELF.fetch(
				new Request('http://example.com/products', {
					headers: requestHeadersForIp(ip),
				}),
			)
		}

		expect(finalResponse?.status).toBe(429)
		expect(finalResponse?.headers.get('x-rate-limit-limit')).toBe('60')
		expect(finalResponse?.headers.get('retry-after')).toBeTruthy()

		const body = (await finalResponse?.json()) as {
			code: string
			message: string
		}
		expect(body.code).toBe('rate_limited')
		expect(body.message).toContain('Too many requests')
	})

	it('rate limits repeated checkout writes from the same IP address', async () => {
		const ip = '198.51.100.11'
		let finalResponse: Response | undefined

		for (let attempt = 0; attempt < 16; attempt += 1) {
			finalResponse = await SELF.fetch(
				new Request('http://example.com/checkout_sessions', {
					method: 'POST',
					headers: requestHeadersForIp(ip),
					body: JSON.stringify({
						items: [{ id: 'bpc-157', quantity: 1 }],
					}),
				}),
			)
		}

		expect(finalResponse?.status).toBe(429)
		expect(finalResponse?.headers.get('x-rate-limit-limit')).toBe('15')
		expect(finalResponse?.headers.get('retry-after')).toBeTruthy()

		const body = (await finalResponse?.json()) as {
			code: string
			message: string
		}
		expect(body.code).toBe('rate_limited')
		expect(body.message).toContain('Too many requests')
	})
})
