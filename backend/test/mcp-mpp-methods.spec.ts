import { describe, expect, it } from 'vitest'
import { mcpPostBodyRequiresMppCharge } from '../src/mpp/mcp-methods'

describe('mcpPostBodyRequiresMppCharge', () => {
	it('does not charge for initialize and tools/list', () => {
		expect(
			mcpPostBodyRequiresMppCharge(
				JSON.stringify({
					jsonrpc: '2.0',
					id: 1,
					method: 'initialize',
					params: {},
				}),
			),
		).toBe(false)
		expect(
			mcpPostBodyRequiresMppCharge(
				JSON.stringify({
					jsonrpc: '2.0',
					id: 2,
					method: 'tools/list',
					params: {},
				}),
			),
		).toBe(false)
	})

	it('charges for tools/call', () => {
		expect(
			mcpPostBodyRequiresMppCharge(
				JSON.stringify({
					jsonrpc: '2.0',
					id: 3,
					method: 'tools/call',
					params: { name: 'list_products', arguments: {} },
				}),
			),
		).toBe(true)
	})

	it('charges when batch includes any non-exempt method', () => {
		expect(
			mcpPostBodyRequiresMppCharge(
				JSON.stringify([
					{
						jsonrpc: '2.0',
						id: 1,
						method: 'initialize',
						params: {},
					},
					{
						jsonrpc: '2.0',
						id: 2,
						method: 'tools/call',
						params: {},
					},
				]),
			),
		).toBe(true)
	})

	it('does not charge when batch is only exempt methods', () => {
		expect(
			mcpPostBodyRequiresMppCharge(
				JSON.stringify([
					{
						jsonrpc: '2.0',
						id: 1,
						method: 'ping',
					},
					{
						jsonrpc: '2.0',
						id: 2,
						method: 'notifications/initialized',
					},
				]),
			),
		).toBe(false)
	})

	it('charges on invalid JSON or empty body (safe default)', () => {
		expect(mcpPostBodyRequiresMppCharge('')).toBe(true)
		expect(mcpPostBodyRequiresMppCharge('not json')).toBe(true)
		expect(mcpPostBodyRequiresMppCharge('{}')).toBe(true)
	})
})
