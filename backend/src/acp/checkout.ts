import { getProductById } from '../products/catalog'
import type {
	CheckoutItemInput,
	CheckoutSessionRecord,
	CheckoutSessionResponse,
	CompleteCheckoutRequest,
	CreateCheckoutRequest,
	FulfillmentOption,
	Link,
	LineItem,
	Message,
	Order,
	Total,
	UpdateCheckoutRequest,
} from './types'

const DEFAULT_PAYMENT_PROVIDER = {
	provider: 'stripe',
	supported_payment_methods: ['card', 'link'],
}

const DEFAULT_TAX_RATE = 0.08

export class CheckoutError extends Error {
	readonly code: string
	readonly statusCode: number
	readonly path?: string

	constructor(
		message: string,
		options: { code: string; statusCode?: number; path?: string },
	) {
		super(message)
		this.code = options.code
		this.statusCode = options.statusCode ?? 400
		this.path = options.path
	}
}

export function createCheckoutRecord(
	sessionId: string,
	input: CreateCheckoutRequest,
): CheckoutSessionRecord {
	const now = new Date().toISOString()
	validateItems(input.items)

	return normalizeRecord({
		id: sessionId,
		created_at: now,
		updated_at: now,
		currency: 'usd',
		payment_provider: DEFAULT_PAYMENT_PROVIDER,
		items: input.items,
		buyer: input.buyer,
		fulfillment_address: input.fulfillment_address,
		status: 'not_ready_for_payment',
	})
}

export function updateCheckoutRecord(
	record: CheckoutSessionRecord,
	input: UpdateCheckoutRequest,
): CheckoutSessionRecord {
	ensureMutable(record)

	if (input.items) {
		validateItems(input.items)
		record.items = input.items
	}

	if (input.buyer) {
		record.buyer = input.buyer
	}

	if (input.fulfillment_address) {
		record.fulfillment_address = input.fulfillment_address
	}

	const fulfillmentOptions = getFulfillmentOptions(record)
	if (input.fulfillment_option_id) {
		const requestedOption = fulfillmentOptions.find(
			option => option.id === input.fulfillment_option_id,
		)
		if (!requestedOption) {
			throw new CheckoutError('Unknown fulfillment option.', {
				code: 'invalid_fulfillment_option',
				path: '$.fulfillment_option_id',
			})
		}
		record.fulfillment_option_id = requestedOption.id
	} else if (record.fulfillment_address && fulfillmentOptions.length > 0) {
		record.fulfillment_option_id = fulfillmentOptions[0]?.id
	}

	record.updated_at = new Date().toISOString()
	return normalizeRecord(record)
}

export function completeCheckoutRecord(
	record: CheckoutSessionRecord,
	input: CompleteCheckoutRequest,
): CheckoutSessionRecord {
	ensureMutable(record)

	if (input.buyer) {
		record.buyer = input.buyer
	}

	if (!record.fulfillment_address) {
		throw new CheckoutError('Fulfillment address is required before payment.', {
			code: 'missing_fulfillment_address',
			path: '$.fulfillment_address',
		})
	}

	const normalizedRecord = normalizeRecord(record)
	if (normalizedRecord.status !== 'ready_for_payment') {
		throw new CheckoutError('Checkout session is not ready for payment.', {
			code: 'not_ready_for_payment',
		})
	}

	if (!input.payment_data?.token) {
		throw new CheckoutError('Payment token is required for demo checkout.', {
			code: 'missing_payment_token',
			path: '$.payment_data.token',
		})
	}

	const orderId = `order_${crypto.randomUUID()}`
	const order: Order = {
		id: orderId,
		data: 'order',
		checkout_session_id: record.id,
		permalink_url: `${input.origin}/orders/${orderId}`,
		status: 'created',
		refunds: [],
	}

	return normalizeRecord({
		...record,
		updated_at: new Date().toISOString(),
		status: 'completed',
		order,
	})
}

export function cancelCheckoutRecord(
	record: CheckoutSessionRecord,
): CheckoutSessionRecord {
	if (record.status === 'completed') {
		throw new CheckoutError('Completed sessions cannot be canceled.', {
			code: 'cannot_cancel_completed_session',
			statusCode: 405,
		})
	}

	if (record.status === 'canceled') {
		return record
	}

	return {
		...record,
		updated_at: new Date().toISOString(),
		status: 'canceled',
	}
}

export function buildCheckoutResponse(
	record: CheckoutSessionRecord,
	origin: string,
): CheckoutSessionResponse {
	const fulfillmentOptions = getFulfillmentOptions(record)
	const selectedFulfillmentOption =
		fulfillmentOptions.find(option => option.id === record.fulfillment_option_id) ??
		fulfillmentOptions[0]

	const lineItems = buildLineItems(record.items, Boolean(record.fulfillment_address))
	const itemsBaseAmount = lineItems.reduce(
		(sum, lineItem) => sum + lineItem.base_amount,
		0,
	)
	const itemsSubtotal = lineItems.reduce(
		(sum, lineItem) => sum + lineItem.subtotal,
		0,
	)
	const taxTotal = lineItems.reduce((sum, lineItem) => sum + lineItem.tax, 0)
	const fulfillmentTotal = selectedFulfillmentOption?.total ?? 0
	const totalAmount = itemsSubtotal + taxTotal + fulfillmentTotal

	return {
		id: record.id,
		buyer: record.buyer,
		payment_provider: record.payment_provider,
		status: record.status,
		currency: record.currency,
		line_items: lineItems,
		fulfillment_address: record.fulfillment_address,
		fulfillment_options: fulfillmentOptions,
		fulfillment_option_id: selectedFulfillmentOption?.id,
		totals: buildTotals(itemsBaseAmount, itemsSubtotal, taxTotal, fulfillmentTotal),
		order: record.order,
		messages: buildMessages(record, selectedFulfillmentOption),
		links: buildLinks(origin),
	}
}

function validateItems(items: CheckoutItemInput[]): void {
	if (items.length === 0) {
		throw new CheckoutError('At least one item is required.', {
			code: 'missing_items',
			path: '$.items',
		})
	}

	items.forEach((item, index) => {
		if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
			throw new CheckoutError('Quantity must be a positive integer.', {
				code: 'invalid_quantity',
				path: `$.items[${index}].quantity`,
			})
		}

		if (!getProductById(item.id)) {
			throw new CheckoutError(`Unknown product: ${item.id}`, {
				code: 'unknown_product',
				path: `$.items[${index}].id`,
			})
		}
	})
}

function ensureMutable(record: CheckoutSessionRecord): void {
	if (record.status === 'canceled') {
		throw new CheckoutError('Canceled sessions cannot be modified.', {
			code: 'session_canceled',
			statusCode: 405,
		})
	}

	if (record.status === 'completed') {
		throw new CheckoutError('Completed sessions cannot be modified.', {
			code: 'session_completed',
			statusCode: 405,
		})
	}
}

function normalizeRecord(record: CheckoutSessionRecord): CheckoutSessionRecord {
	const hasFulfillmentAddress = Boolean(record.fulfillment_address)
	const fulfillmentOptions = getFulfillmentOptions(record)
	const hasFulfillmentOption =
		fulfillmentOptions.some(option => option.id === record.fulfillment_option_id) ||
		(hasFulfillmentAddress && fulfillmentOptions.length > 0)

	if (record.status === 'completed' || record.status === 'canceled') {
		return record
	}

	return {
		...record,
		fulfillment_option_id:
			record.fulfillment_option_id ?? fulfillmentOptions[0]?.id,
		status:
			hasFulfillmentAddress && hasFulfillmentOption
				? 'ready_for_payment'
				: 'not_ready_for_payment',
	}
}

function buildLineItems(
	items: CheckoutItemInput[],
	shouldApplyTax: boolean,
): LineItem[] {
	return items.map(item => {
		const product = getProductById(item.id)
		if (!product) {
			throw new CheckoutError(`Unknown product: ${item.id}`, {
				code: 'unknown_product',
				path: '$.items',
			})
		}

		const baseAmount = product.price * item.quantity
		const tax = shouldApplyTax ? Math.round(baseAmount * DEFAULT_TAX_RATE) : 0

		return {
			id: `line_${product.id}`,
			item,
			title: product.name,
			base_amount: baseAmount,
			discount: 0,
			subtotal: baseAmount,
			tax,
			total: baseAmount + tax,
		}
	})
}

function getFulfillmentOptions(
	record: CheckoutSessionRecord,
): FulfillmentOption[] {
	if (!record.fulfillment_address) {
		return []
	}

	const baseDate = new Date('2026-03-25T12:00:00.000Z')
	const standardStart = new Date(baseDate)
	standardStart.setDate(standardStart.getDate() + 3)
	const standardEnd = new Date(baseDate)
	standardEnd.setDate(standardEnd.getDate() + 5)
	const expressStart = new Date(baseDate)
	expressStart.setDate(expressStart.getDate() + 1)
	const expressEnd = new Date(baseDate)
	expressEnd.setDate(expressEnd.getDate() + 2)

	return [
		{
			type: 'shipping',
			id: 'ship_standard',
			title: 'Standard Research Shipping',
			subtitle: 'Temperature-stable fulfillment, arrives in 3-5 days',
			carrier: 'FedEx',
			earliest_delivery_time: standardStart.toISOString(),
			latest_delivery_time: standardEnd.toISOString(),
			subtotal: 1200,
			tax: 0,
			total: 1200,
		},
		{
			type: 'shipping',
			id: 'ship_express',
			title: 'Cold Chain Express',
			subtitle: 'Priority cold-pack fulfillment, arrives in 1-2 days',
			carrier: 'UPS',
			earliest_delivery_time: expressStart.toISOString(),
			latest_delivery_time: expressEnd.toISOString(),
			subtotal: 2400,
			tax: 0,
			total: 2400,
		},
	]
}

function buildTotals(
	itemsBaseAmount: number,
	itemsSubtotal: number,
	taxTotal: number,
	fulfillmentTotal: number,
): Total[] {
	const totals: Total[] = [
		{
			type: 'items_base_amount',
			display_text: 'Peptide subtotal',
			amount: itemsBaseAmount,
		},
		{
			type: 'subtotal',
			display_text: 'Subtotal',
			amount: itemsSubtotal,
		},
		{
			type: 'tax',
			display_text: 'Estimated tax',
			amount: taxTotal,
		},
	]

	if (fulfillmentTotal > 0) {
		totals.push({
			type: 'fulfillment',
			display_text: 'Cold-chain shipping',
			amount: fulfillmentTotal,
		})
	}

	totals.push({
		type: 'total',
		display_text: 'Total',
		amount: itemsSubtotal + taxTotal + fulfillmentTotal,
	})

	return totals
}

function buildMessages(
	record: CheckoutSessionRecord,
	selectedFulfillmentOption?: FulfillmentOption,
): Message[] {
	if (record.status === 'completed') {
		return [
			{
				type: 'info',
				code: 'demo_order_created',
				content_type: 'plain',
				content:
					'Demo order created. The payment token was accepted for a simulated ACP checkout flow.',
			},
		]
	}

	if (record.status === 'canceled') {
		return [
			{
				type: 'info',
				code: 'checkout_canceled',
				content_type: 'plain',
				content: 'Checkout session canceled and inventory reservation released.',
			},
		]
	}

	if (!record.fulfillment_address) {
		return [
			{
				type: 'info',
				code: 'missing_fulfillment_address',
				content_type: 'plain',
				content:
					'Add a fulfillment address to calculate shipping, tax, and complete the demo purchase.',
			},
		]
	}

	return [
		{
			type: 'info',
			code: 'research_only',
			content_type: 'plain',
			content:
				'All products are marked Research Use Only in this peptide pharmacy demo.',
		},
		{
			type: 'info',
			code: 'selected_fulfillment',
			content_type: 'plain',
			content: `Selected fulfillment: ${selectedFulfillmentOption?.title ?? 'Standard Research Shipping'}.`,
		},
	]
}

function buildLinks(origin: string): Link[] {
	return [
		{
			type: 'terms_of_use',
			url: `${origin}/legal/terms`,
		},
		{
			type: 'privacy_policy',
			url: `${origin}/legal/privacy`,
		},
		{
			type: 'support',
			url: `${origin}/support`,
		},
	]
}
