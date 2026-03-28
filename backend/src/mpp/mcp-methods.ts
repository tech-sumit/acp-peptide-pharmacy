/**
 * MCP JSON-RPC methods that must stay free so Streamable HTTP clients
 * (Cursor, mcp-remote) can handshake and list tools without MPP credentials.
 * Paid gate applies to everything else (notably `tools/call`).
 */
const MPP_EXEMPT_MCP_METHODS = new Set([
	'completion/complete',
	'initialize',
	'logging/setLevel',
	'notifications/cancelled',
	'notifications/initialized',
	'notifications/message',
	'notifications/progress',
	'ping',
	'prompts/get',
	'prompts/list',
	'resources/list',
	'resources/read',
	'resources/subscribe',
	'resources/unsubscribe',
	'resources/templates/list',
	'tools/list',
])

function collectMethodsFromJsonRpcPayload(parsed: unknown): string[] {
	const methods: string[] = []
	if (Array.isArray(parsed)) {
		for (const item of parsed) {
			if (
				item &&
				typeof item === 'object' &&
				'method' in item &&
				typeof (item as { method: unknown }).method === 'string'
			) {
				methods.push((item as { method: string }).method)
			}
		}
		return methods
	}
	if (
		parsed &&
		typeof parsed === 'object' &&
		'method' in parsed &&
		typeof (parsed as { method: unknown }).method === 'string'
	) {
		methods.push((parsed as { method: string }).method)
	}
	return methods
}

/**
 * Returns true when this POST /mcp body should run through MPP (Stripe charge).
 * Unknown or empty bodies are treated as requiring payment (safe default).
 */
export function mcpPostBodyRequiresMppCharge(bodyText: string): boolean {
	const trimmed = bodyText.trim()
	if (!trimmed) {
		return true
	}
	let parsed: unknown
	try {
		parsed = JSON.parse(trimmed) as unknown
	} catch {
		return true
	}
	const methods = collectMethodsFromJsonRpcPayload(parsed)
	if (methods.length === 0) {
		return true
	}
	for (const method of methods) {
		if (!MPP_EXEMPT_MCP_METHODS.has(method)) {
			return true
		}
	}
	return false
}
