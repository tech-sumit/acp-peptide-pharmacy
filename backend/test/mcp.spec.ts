import { SELF } from 'cloudflare:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { afterEach, describe, expect, it } from 'vitest'

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

const activeClients: Client[] = []

describe('remote MCP server', () => {
	afterEach(async () => {
		await Promise.all(activeClients.map(client => client.close()))
		activeClients.length = 0
	})

	it('exposes the peptide commerce tools to MCP clients', async () => {
		const client = await connectClient()

		const tools = await client.listTools()
		const toolNames = tools.tools.map(tool => tool.name)

		expect(toolNames).toEqual(
			expect.arrayContaining([
				'list_products',
				'search_products',
				'get_product_details',
				'create_checkout',
				'update_checkout',
				'get_checkout_status',
				'complete_checkout',
				'cancel_checkout',
			]),
		)
	})

	it('creates and completes a demo peptide order through MCP tools', async () => {
		const client = await connectClient()

		const createResult = await client.callTool({
			name: 'create_checkout',
			arguments: {
				items: [{ id: 'bpc-157', quantity: 1 }],
			},
		})

		const createdPayload = JSON.parse(createResult.content[0].text) as {
			id: string
			status: string
		}
		expect(createdPayload.status).toBe('not_ready_for_payment')

		const updateResult = await client.callTool({
			name: 'update_checkout',
			arguments: {
				checkoutSessionId: createdPayload.id,
				buyer,
				fulfillmentAddress: address,
			},
		})

		const updatedPayload = JSON.parse(updateResult.content[0].text) as {
			status: string
		}
		expect(updatedPayload.status).toBe('ready_for_payment')

		const completeResult = await client.callTool({
			name: 'complete_checkout',
			arguments: {
				checkoutSessionId: createdPayload.id,
				buyer,
				paymentData: {
					provider: 'stripe',
					token: 'spt_demo_checkout_token',
					billingAddress: address,
				},
			},
		})

		const completedPayload = JSON.parse(completeResult.content[0].text) as {
			status: string
			order: { id: string }
		}
		expect(completedPayload.status).toBe('completed')
		expect(completedPayload.order.id).toMatch(/^order_/)
	})
})

async function connectClient(): Promise<Client> {
	const transport = new StreamableHTTPClientTransport(
		new URL('http://example.com/mcp'),
		{
			fetch: async (input, init) => {
				const request =
					input instanceof Request ? input : new Request(input, init)
				return SELF.fetch(request)
			},
		},
	)

	const client = new Client({
		name: 'acp-peptide-pharmacy-test-client',
		version: '0.1.0',
	})

	await client.connect(transport)
	activeClients.push(client)
	return client
}
