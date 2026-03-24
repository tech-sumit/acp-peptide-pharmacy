import { DurableObject } from 'cloudflare:workers'
import {
	buildCheckoutResponse,
	cancelCheckoutRecord,
	completeCheckoutRecord,
	createCheckoutRecord,
	updateCheckoutRecord,
} from './checkout'
import type {
	CheckoutSessionRecord,
	CheckoutSessionResponse,
	CompleteCheckoutRequest,
	CreateCheckoutRequest,
	UpdateCheckoutRequest,
} from './types'

const SESSION_STORAGE_KEY = 'checkout-session'
const ORDER_REF_STORAGE_KEY = 'order-ref'

interface OrderReference {
	orderId: string
	sessionId: string
}

export class CheckoutSessionDurableObject extends DurableObject<Env> {
	async createSession(
		input: Omit<CreateCheckoutRequest, 'origin'> & {
			sessionId: string
			origin: string
		},
	): Promise<CheckoutSessionResponse> {
		const existingRecord = await this.loadRecord()
		const record =
			existingRecord ??
			createCheckoutRecord(input.sessionId, {
				items: input.items,
				buyer: input.buyer,
				fulfillment_address: input.fulfillment_address,
				origin: input.origin,
			})

		await this.saveRecord(record)
		return buildCheckoutResponse(record, input.origin)
	}

	async getSession(origin: string): Promise<CheckoutSessionResponse | null> {
		const record = await this.loadRecord()
		if (!record) {
			return null
		}

		return buildCheckoutResponse(record, origin)
	}

	async updateSession(
		input: UpdateCheckoutRequest,
	): Promise<CheckoutSessionResponse | null> {
		const record = await this.loadRecord()
		if (!record) {
			return null
		}

		const updatedRecord = updateCheckoutRecord(record, input)
		await this.saveRecord(updatedRecord)
		return buildCheckoutResponse(updatedRecord, input.origin)
	}

	async completeSession(
		input: CompleteCheckoutRequest,
	): Promise<CheckoutSessionResponse | null> {
		const record = await this.loadRecord()
		if (!record) {
			return null
		}

		const completedRecord = completeCheckoutRecord(record, input)
		await this.saveRecord(completedRecord)

		if (completedRecord.order) {
			const refStub = this.env.CHECKOUT_SESSIONS.getByName(
				completedRecord.order.id,
			)
			await refStub.storeOrderReference({
				orderId: completedRecord.order.id,
				sessionId: completedRecord.id,
			})
		}

		return buildCheckoutResponse(completedRecord, input.origin)
	}

	async cancelSession(origin: string): Promise<CheckoutSessionResponse | null> {
		const record = await this.loadRecord()
		if (!record) {
			return null
		}

		const canceledRecord = cancelCheckoutRecord(record)
		await this.saveRecord(canceledRecord)
		return buildCheckoutResponse(canceledRecord, origin)
	}

	async storeOrderReference(ref: OrderReference): Promise<void> {
		await this.ctx.storage.put(ORDER_REF_STORAGE_KEY, ref)
	}

	async getOrderReference(): Promise<OrderReference | null> {
		const ref =
			await this.ctx.storage.get<OrderReference>(ORDER_REF_STORAGE_KEY)
		return ref ?? null
	}

	private async loadRecord(): Promise<CheckoutSessionRecord | null> {
		const record = await this.ctx.storage.get<CheckoutSessionRecord>(
			SESSION_STORAGE_KEY,
		)

		return record ?? null
	}

	private async saveRecord(record: CheckoutSessionRecord): Promise<void> {
		await this.ctx.storage.put(SESSION_STORAGE_KEY, record)
	}
}
