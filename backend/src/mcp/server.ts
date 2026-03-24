import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createToolHandlers, toolSchemas } from './tools'

export function createCommerceMcpServer(env: Env, origin: string): McpServer {
	const server = new McpServer(
		{
			name: 'acp-peptide-pharmacy',
			version: '0.1.0',
		},
		{
			instructions:
				'Use these tools to browse a research-only peptide catalog and run demo ACP checkout flows.',
		},
	)

	const handlers = createToolHandlers(env, origin)

	server.registerTool(
		'list_products',
		{
			title: 'List products',
			description:
				'List the peptide catalog, optionally filtered by category.',
			inputSchema: toolSchemas.listProducts,
			annotations: {
				readOnlyHint: true,
				idempotentHint: true,
			},
		},
		handlers.listProducts,
	)

	server.registerTool(
		'search_products',
		{
			title: 'Search products',
			description:
				'Search the peptide catalog by product name, use case, or keyword.',
			inputSchema: toolSchemas.searchProducts,
			annotations: {
				readOnlyHint: true,
				idempotentHint: true,
			},
		},
		handlers.searchProducts,
	)

	server.registerTool(
		'get_product_details',
		{
			title: 'Get product details',
			description:
				'Fetch detailed metadata for a single peptide product in the catalog.',
			inputSchema: toolSchemas.getProductDetails,
			annotations: {
				readOnlyHint: true,
				idempotentHint: true,
			},
		},
		handlers.getProductDetails,
	)

	server.registerTool(
		'create_checkout',
		{
			title: 'Create checkout',
			description:
				'Create a demo ACP checkout session from one or more peptide items.',
			inputSchema: toolSchemas.createCheckout,
			annotations: {
				idempotentHint: false,
			},
		},
		handlers.createCheckout,
	)

	server.registerTool(
		'update_checkout',
		{
			title: 'Update checkout',
			description:
				'Update a checkout session with buyer data, shipping address, quantities, or shipping selection.',
			inputSchema: toolSchemas.updateCheckout,
			annotations: {
				idempotentHint: false,
			},
		},
		handlers.updateCheckout,
	)

	server.registerTool(
		'get_checkout_status',
		{
			title: 'Get checkout status',
			description:
				'Return the latest checkout session state, totals, and fulfillment options.',
			inputSchema: toolSchemas.getCheckoutStatus,
			annotations: {
				readOnlyHint: true,
				idempotentHint: true,
			},
		},
		handlers.getCheckoutStatus,
	)

	server.registerTool(
		'complete_checkout',
		{
			title: 'Complete checkout',
			description:
				'Complete the demo checkout using placeholder payment data compatible with ACP flows.',
			inputSchema: toolSchemas.completeCheckout,
			annotations: {
				idempotentHint: false,
			},
		},
		handlers.completeCheckout,
	)

	server.registerTool(
		'cancel_checkout',
		{
			title: 'Cancel checkout',
			description:
				'Cancel an active checkout session and release the demo inventory reservation.',
			inputSchema: toolSchemas.cancelCheckout,
			annotations: {
				idempotentHint: false,
			},
		},
		handlers.cancelCheckout,
	)

	return server
}

export async function handleMcpRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	})
	const server = createCommerceMcpServer(env, new URL(request.url).origin)

	await server.connect(transport)
	const response = await transport.handleRequest(request)

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	})
}
