export interface Address {
	name: string
	line_one: string
	line_two?: string
	city: string
	state: string
	postal_code: string
	country: string
}

export interface Buyer {
	first_name: string
	last_name: string
	email: string
	phone_number?: string
}

export interface CheckoutItemInput {
	id: string
	quantity: number
}

export interface CreateCheckoutRequest {
	items: CheckoutItemInput[]
	buyer?: Buyer
	fulfillment_address?: Address
	origin: string
}

export interface UpdateCheckoutRequest {
	items?: CheckoutItemInput[]
	buyer?: Buyer
	fulfillment_address?: Address
	fulfillment_option_id?: string
	origin: string
}

export interface PaymentData {
	provider: string
	token: string
	billing_address?: Address
}

export interface CompleteCheckoutRequest {
	buyer?: Buyer
	payment_data: PaymentData
	origin: string
}

export type CheckoutStatus =
	| 'not_ready_for_payment'
	| 'ready_for_payment'
	| 'completed'
	| 'canceled'

export interface PaymentProvider {
	provider: string
	supported_payment_methods: string[]
}

export interface LineItem {
	id: string
	item: CheckoutItemInput
	title: string
	base_amount: number
	discount: number
	subtotal: number
	tax: number
	total: number
}

export interface FulfillmentOption {
	type: 'shipping'
	id: string
	title: string
	subtitle: string
	carrier: string
	earliest_delivery_time: string
	latest_delivery_time: string
	subtotal: number
	tax: number
	total: number
}

export interface Total {
	type:
		| 'items_base_amount'
		| 'subtotal'
		| 'tax'
		| 'fulfillment'
		| 'total'
	display_text: string
	amount: number
}

export interface Message {
	type: 'info' | 'error'
	code: string
	content_type: 'plain'
	content: string
	path?: string
}

export interface Link {
	type: 'terms_of_use' | 'privacy_policy' | 'support'
	url: string
}

export interface Order {
	id: string
	data: 'order'
	checkout_session_id: string
	permalink_url: string
	status: 'created' | 'confirmed' | 'canceled' | 'fulfilled'
	refunds: Array<{ type: 'store_credit' | 'original_payment'; amount: number }>
}

export interface CheckoutSessionRecord {
	id: string
	created_at: string
	updated_at: string
	currency: 'usd'
	payment_provider: PaymentProvider
	items: CheckoutItemInput[]
	buyer?: Buyer
	fulfillment_address?: Address
	fulfillment_option_id?: string
	status: CheckoutStatus
	order?: Order
}

export interface CheckoutSessionResponse {
	id: string
	buyer?: Buyer
	payment_provider: PaymentProvider
	status: CheckoutStatus
	currency: 'usd'
	line_items: LineItem[]
	fulfillment_address?: Address
	fulfillment_options: FulfillmentOption[]
	fulfillment_option_id?: string
	totals: Total[]
	order?: Order
	messages: Message[]
	links: Link[]
}
