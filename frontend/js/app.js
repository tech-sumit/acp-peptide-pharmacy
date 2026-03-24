const CART_STORAGE_KEY = 'acp-peptide-pharmacy-cart'
const SESSION_STORAGE_KEY = 'acp-peptide-pharmacy-checkout-session'

document.addEventListener('DOMContentLoaded', () => {
	void bootstrap()
})

async function bootstrap() {
	updateCartCount()

	const page = document.body.dataset.page
	switch (page) {
		case 'home':
			await initHomePage()
			break
		case 'product':
			await initProductPage()
			break
		case 'cart':
			await initCartPage()
			break
		default:
			break
	}
}

async function initHomePage() {
	const grid = document.querySelector('[data-product-grid]')
	const filters = document.querySelector('[data-category-filters]')
	if (!grid || !filters) {
		return
	}

	try {
		const { products } = await apiRequest('/products')
		renderCategoryFilters(filters, products)
		renderProductGrid(grid, products)

		filters.addEventListener('click', event => {
			const button = event.target.closest('[data-category-filter]')
			if (!button) {
				return
			}

			const selectedCategory = button.dataset.categoryFilter
			const nextProducts =
				selectedCategory === 'all'
					? products
					: products.filter(product => product.category === selectedCategory)

			filters
				.querySelectorAll('[data-category-filter]')
				.forEach(filterButton => {
					filterButton.classList.toggle(
						'is-active',
						filterButton === button,
					)
				})
			renderProductGrid(grid, nextProducts)
		})

		grid.addEventListener('click', event => {
			const button = event.target.closest('[data-add-product]')
			if (!button) {
				return
			}

			const product = products.find(item => item.id === button.dataset.addProduct)
			if (!product) {
				return
			}

			addToCart(product.id, 1)
			button.textContent = 'Added to cart'
			window.setTimeout(() => {
				button.textContent = 'Add to cart'
			}, 1400)
		})
	} catch (error) {
		renderStateMessage(
			grid,
			'Unable to reach the backend yet. Deploy or override `acp-api-base-url` to load the live catalog.',
		)
	}
}

async function initProductPage() {
	const detail = document.querySelector('[data-product-detail]')
	const related = document.querySelector('[data-related-products]')
	if (!detail || !related) {
		return
	}

	const productId = new URLSearchParams(window.location.search).get('id')
	if (!productId) {
		renderStateMessage(detail, 'No product was selected.')
		return
	}

	try {
		const [product, { products }] = await Promise.all([
			apiRequest(`/products/${productId}`),
			apiRequest('/products'),
		])

		renderProductDetail(detail, product)
		renderProductGrid(
			related,
			products.filter(item => item.category === product.category && item.id !== product.id),
		)

		detail.addEventListener('click', event => {
			const addButton = event.target.closest('[data-detail-add]')
			if (addButton) {
				const quantityInput = detail.querySelector('[data-detail-quantity]')
				const quantity = Number(quantityInput?.value ?? 1)
				addToCart(product.id, quantity)
				addButton.textContent = 'Added to cart'
				window.setTimeout(() => {
					addButton.textContent = 'Add to cart'
				}, 1400)
				return
			}

			const stepButton = event.target.closest('[data-detail-step]')
			if (!stepButton) {
				return
			}

			const quantityInput = detail.querySelector('[data-detail-quantity]')
			if (!quantityInput) {
				return
			}

			const currentValue = Number(quantityInput.value || 1)
			const nextValue =
				stepButton.dataset.detailStep === 'up'
					? currentValue + 1
					: Math.max(1, currentValue - 1)
			quantityInput.value = String(nextValue)
		})

		related.addEventListener('click', event => {
			const button = event.target.closest('[data-add-product]')
			if (!button) {
				return
			}

			addToCart(button.dataset.addProduct, 1)
			button.textContent = 'Added to cart'
			window.setTimeout(() => {
				button.textContent = 'Add to cart'
			}, 1400)
		})
	} catch (error) {
		renderStateMessage(
			detail,
			'Unable to load this product right now. Check the backend URL and try again.',
		)
	}
}

async function initCartPage() {
	const cartItemsContainer = document.querySelector('[data-cart-items]')
	const checkoutForm = document.querySelector('[data-checkout-form]')
	const shippingOptions = document.querySelector('[data-shipping-options]')
	const statusPanel = document.querySelector('[data-checkout-status]')
	const syncButton = document.querySelector('[data-sync-checkout]')
	const completeButton = document.querySelector('[data-complete-order]')
	const cancelButton = document.querySelector('[data-cancel-checkout]')
	const clearButton = document.querySelector('[data-clear-cart]')

	if (
		!cartItemsContainer ||
		!checkoutForm ||
		!shippingOptions ||
		!statusPanel ||
		!syncButton ||
		!completeButton ||
		!cancelButton ||
		!clearButton
	) {
		return
	}

	const { products } = await safeLoadProducts(statusPanel)
	renderCartItems(cartItemsContainer, products)
	renderCheckoutStatus(statusPanel)

	const refreshCartView = () => {
		renderCartItems(cartItemsContainer, products)
		updateCartCount()
	}

	cartItemsContainer.addEventListener('click', event => {
		const button = event.target.closest('[data-cart-action]')
		if (!button) {
			return
		}

		const productId = button.dataset.productId
		const action = button.dataset.cartAction
		if (!productId || !action) {
			return
		}

		mutateCart(productId, action)
		clearCheckoutSession()
		renderCheckoutStatus(statusPanel)
		shippingOptions.innerHTML = ''
		refreshCartView()
	})

	clearButton.addEventListener('click', () => {
		writeCart([])
		clearCheckoutSession()
		shippingOptions.innerHTML = ''
		renderCheckoutStatus(statusPanel)
		refreshCartView()
	})

	syncButton.addEventListener('click', async () => {
		const payload = buildCheckoutPayload(checkoutForm)
		if (!payload) {
			renderCheckoutStatus(statusPanel, null, 'Fill in the required buyer and address fields first.', 'error')
			return
		}

		try {
			const cartItems = readCart()
			const activeSessionId = readCheckoutSession()
			const selectedShipping = getSelectedShippingOption()
			const requestBody = {
				items: cartItems.map(item => ({
					id: item.id,
					quantity: item.quantity,
				})),
				buyer: payload.buyer,
				fulfillment_address: payload.address,
				fulfillment_option_id: selectedShipping || undefined,
			}

			const session = activeSessionId
				? await apiRequest(`/checkout_sessions/${activeSessionId}`, {
						method: 'POST',
						body: JSON.stringify(requestBody),
				  })
				: await apiRequest('/checkout_sessions', {
						method: 'POST',
						body: JSON.stringify(requestBody),
				  })

			writeCheckoutSession(session.id)
			renderShippingOptions(shippingOptions, session)
			renderCheckoutStatus(
				statusPanel,
				session,
				'Checkout session synced with the ACP backend.',
			)
		} catch (error) {
			renderCheckoutStatus(
				statusPanel,
				null,
				error.message || 'Unable to sync checkout session.',
				'error',
			)
		}
	})

	shippingOptions.addEventListener('change', async event => {
		const input = event.target.closest('[name="shipping_option"]')
		const sessionId = readCheckoutSession()
		if (!input || !sessionId) {
			return
		}

		const payload = buildCheckoutPayload(checkoutForm)
		if (!payload) {
			return
		}

		try {
			const session = await apiRequest(`/checkout_sessions/${sessionId}`, {
				method: 'POST',
				body: JSON.stringify({
					items: readCart().map(item => ({
						id: item.id,
						quantity: item.quantity,
					})),
					buyer: payload.buyer,
					fulfillment_address: payload.address,
					fulfillment_option_id: input.value,
				}),
			})

			renderShippingOptions(shippingOptions, session)
			renderCheckoutStatus(
				statusPanel,
				session,
				'Fulfillment selection updated.',
			)
		} catch (error) {
			renderCheckoutStatus(
				statusPanel,
				null,
				error.message || 'Unable to update fulfillment option.',
				'error',
			)
		}
	})

	completeButton.addEventListener('click', async () => {
		const sessionId = readCheckoutSession()
		if (!sessionId) {
			renderCheckoutStatus(
				statusPanel,
				null,
				'Create or update a checkout session before completing the order.',
				'error',
			)
			return
		}

		const payload = buildCheckoutPayload(checkoutForm)
		if (!payload) {
			renderCheckoutStatus(statusPanel, null, 'Buyer information is required.', 'error')
			return
		}

		try {
			const session = await apiRequest(`/checkout_sessions/${sessionId}/complete`, {
				method: 'POST',
				body: JSON.stringify({
					buyer: payload.buyer,
					payment_data: {
						provider: 'stripe',
						token: 'spt_demo_frontend_token',
						billing_address: payload.address,
					},
				}),
			})

			writeCart([])
			clearCheckoutSession()
			refreshCartView()
			renderShippingOptions(shippingOptions, session)
			renderCheckoutStatus(
				statusPanel,
				session,
				'Demo order completed. No live payment was processed.',
			)
		} catch (error) {
			renderCheckoutStatus(
				statusPanel,
				null,
				error.message || 'Unable to complete checkout.',
				'error',
			)
		}
	})

	cancelButton.addEventListener('click', async () => {
		const sessionId = readCheckoutSession()
		if (!sessionId) {
			renderCheckoutStatus(
				statusPanel,
				null,
				'There is no active checkout session to cancel.',
			)
			return
		}

		try {
			const session = await apiRequest(`/checkout_sessions/${sessionId}/cancel`, {
				method: 'POST',
			})
			clearCheckoutSession()
			renderShippingOptions(shippingOptions, session)
			renderCheckoutStatus(statusPanel, session, 'Checkout canceled.')
		} catch (error) {
			renderCheckoutStatus(
				statusPanel,
				null,
				error.message || 'Unable to cancel checkout.',
				'error',
			)
		}
	})
}

async function safeLoadProducts(statusPanel) {
	try {
		return await apiRequest('/products')
	} catch (error) {
		renderCheckoutStatus(
			statusPanel,
			null,
			'The cart UI could not load the live product catalog. Set the backend URL first.',
			'error',
		)
		return { products: [] }
	}
}

function renderCategoryFilters(container, products) {
	const categories = Array.from(new Set(products.map(product => product.category)))
	container.innerHTML = [
		renderFilterButton('all', 'All tracks', true),
		...categories.map(category =>
			renderFilterButton(category, titleCase(category), false),
		),
	].join('')
}

function renderProductGrid(container, products) {
	if (products.length === 0) {
		renderStateMessage(container, 'No products matched this filter.')
		return
	}

	container.innerHTML = products
		.map(
			product => `
				<article class="product-card">
					<div class="product-card__header">
						<span class="eyebrow-chip">${titleCase(product.category)}</span>
						<span class="stock-chip">${product.stock_status.replace('_', ' ')}</span>
					</div>
					<h3>${product.name}</h3>
					<p>${product.short_description}</p>
					<div class="product-card__meta">
						<span>Purity ${product.purity}</span>
						<span>${formatCurrency(product.price)}</span>
					</div>
					<div class="product-card__footer">
						<a class="button button--ghost" href="./product.html?id=${encodeURIComponent(product.id)}">Inspect</a>
						<button class="button button--secondary" data-add-product="${product.id}">
							Add to cart
						</button>
					</div>
				</article>
			`,
		)
		.join('')
}

function renderProductDetail(container, product) {
	container.innerHTML = `
		<div class="detail-card">
			<div class="detail-card__eyebrow">
				<span class="eyebrow-chip">${titleCase(product.category)}</span>
				<span class="stock-chip">${product.stock_status.replace('_', ' ')}</span>
			</div>
			<h1>${product.name}</h1>
			<p class="detail-card__lede">${product.description}</p>
			<div class="detail-card__specs">
				<div>
					<span>Purity</span>
					<strong>${product.purity}</strong>
				</div>
				<div>
					<span>Format</span>
					<strong>${product.dosage_forms.join(', ')}</strong>
				</div>
				<div>
					<span>Focus</span>
					<strong>${product.featured_benefit}</strong>
				</div>
				<div>
					<span>Price</span>
					<strong>${formatCurrency(product.price)}</strong>
				</div>
			</div>
			<p class="detail-card__notice">
				Research use only. This storefront is a protocol and tooling demo, not
				a real pharmacy checkout.
			</p>
		</div>
		<div class="detail-sidebar">
			<div class="panel panel--solid">
				<h2>Add to cart</h2>
				<div class="quantity-picker">
					<button class="quantity-button" data-detail-step="down">-</button>
					<input type="number" min="1" value="1" data-detail-quantity />
					<button class="quantity-button" data-detail-step="up">+</button>
				</div>
				<button class="button button--primary" data-detail-add>
					Add to cart
				</button>
				<a class="button button--ghost" href="./cart.html">Open checkout</a>
			</div>
		</div>
	`
}

function renderCartItems(container, products) {
	const cart = readCart()
	if (cart.length === 0) {
		renderStateMessage(
			container,
			'Your cart is empty. Add products from the catalog to start an ACP session.',
		)
		return
	}

	const items = cart
		.map(item => {
			const product = products.find(entry => entry.id === item.id)
			if (!product) {
				return ''
			}

			return `
				<div class="cart-row">
					<div>
						<h3>${product.name}</h3>
						<p>${product.short_description}</p>
						<span class="cart-row__price">${formatCurrency(product.price)}</span>
					</div>
					<div class="cart-row__actions">
						<button data-cart-action="decrease" data-product-id="${product.id}">-</button>
						<span>${item.quantity}</span>
						<button data-cart-action="increase" data-product-id="${product.id}">+</button>
						<button data-cart-action="remove" data-product-id="${product.id}">Remove</button>
					</div>
				</div>
			`
		})
		.join('')

	const subtotal = cart.reduce((sum, item) => {
		const product = products.find(entry => entry.id === item.id)
		return sum + (product?.price ?? 0) * item.quantity
	}, 0)

	container.innerHTML = `
		<div class="cart-list">${items}</div>
		<div class="cart-summary">
			<span>Estimated subtotal</span>
			<strong>${formatCurrency(subtotal)}</strong>
		</div>
	`
}

function renderShippingOptions(container, session) {
	if (!session?.fulfillment_options?.length) {
		container.innerHTML = `
			<div class="shipping-placeholder">
				Select a shipping address and sync the checkout to view cold-chain options.
			</div>
		`
		return
	}

	container.innerHTML = `
		<div class="panel__header panel__header--nested">
			<h3>Shipping options</h3>
		</div>
		<div class="shipping-list">
			${session.fulfillment_options
				.map(
					option => `
						<label class="shipping-card">
							<input
								type="radio"
								name="shipping_option"
								value="${option.id}"
								${option.id === session.fulfillment_option_id ? 'checked' : ''}
							/>
							<div>
								<strong>${option.title}</strong>
								<p>${option.subtitle}</p>
								<span>${formatCurrency(option.total)}</span>
							</div>
						</label>
					`,
				)
				.join('')}
		</div>
	`
}

function renderCheckoutStatus(container, session = null, message = '', tone = 'info') {
	if (!session) {
		container.innerHTML = `
			<div class="status-message ${tone === 'error' ? 'status-message--error' : ''}">
				<p>${message || 'No checkout session has been created yet.'}</p>
			</div>
		`
		return
	}

	const totals = session.totals
		.map(
			total => `
				<div class="status-total">
					<span>${total.display_text}</span>
					<strong>${formatCurrency(total.amount)}</strong>
				</div>
			`,
		)
		.join('')

	const messages = session.messages
		.map(
			entry => `
				<li class="${entry.type === 'error' ? 'status-error' : ''}">
					${entry.content}
				</li>
			`,
		)
		.join('')

	container.innerHTML = `
		<div class="status-message ${tone === 'error' ? 'status-message--error' : ''}">
			<p>${message || 'Checkout session loaded.'}</p>
		</div>
		<div class="status-meta">
			<span>Status</span>
			<strong>${session.status.replaceAll('_', ' ')}</strong>
		</div>
		<div class="status-meta">
			<span>Session</span>
			<strong>${session.id}</strong>
		</div>
		${session.order ? `<div class="status-meta"><span>Order</span><strong>${session.order.id}</strong></div>` : ''}
		<div class="status-totals">${totals}</div>
		<ul class="status-list">${messages}</ul>
	`
}

function renderStateMessage(container, message) {
	container.innerHTML = `
		<div class="state-message">
			<p>${message}</p>
		</div>
	`
}

function renderFilterButton(value, label, active) {
	return `
		<button class="filter-chip ${active ? 'is-active' : ''}" data-category-filter="${value}">
			${label}
		</button>
	`
}

function addToCart(productId, quantity) {
	const cart = readCart()
	const existingItem = cart.find(item => item.id === productId)
	if (existingItem) {
		existingItem.quantity += quantity
	} else {
		cart.push({ id: productId, quantity })
	}

	writeCart(cart)
	updateCartCount()
}

function mutateCart(productId, action) {
	const cart = readCart()
	const item = cart.find(entry => entry.id === productId)
	if (!item) {
		return
	}

	switch (action) {
		case 'increase':
			item.quantity += 1
			break
		case 'decrease':
			item.quantity = Math.max(1, item.quantity - 1)
			break
		case 'remove':
			writeCart(cart.filter(entry => entry.id !== productId))
			updateCartCount()
			return
		default:
			return
	}

	writeCart(cart)
	updateCartCount()
}

function readCart() {
	return JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]')
}

function writeCart(cart) {
	localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
}

function updateCartCount() {
	const cartCount = readCart().reduce((sum, item) => sum + item.quantity, 0)
	document.querySelectorAll('[data-cart-count]').forEach(node => {
		node.textContent = String(cartCount)
	})
}

function buildCheckoutPayload(form) {
	const cart = readCart()
	if (cart.length === 0) {
		return null
	}

	const data = new FormData(form)
	const requiredValues = [
		'first_name',
		'last_name',
		'email',
		'name',
		'line_one',
		'city',
		'state',
		'postal_code',
		'country',
	]

	const missingValue = requiredValues.some(field => !String(data.get(field) || '').trim())
	if (missingValue) {
		return null
	}

	return {
		buyer: {
			first_name: String(data.get('first_name')).trim(),
			last_name: String(data.get('last_name')).trim(),
			email: String(data.get('email')).trim(),
			phone_number: String(data.get('phone_number') || '').trim() || undefined,
		},
		address: {
			name: String(data.get('name')).trim(),
			line_one: String(data.get('line_one')).trim(),
			line_two: String(data.get('line_two') || '').trim() || undefined,
			city: String(data.get('city')).trim(),
			state: String(data.get('state')).trim(),
			postal_code: String(data.get('postal_code')).trim(),
			country: String(data.get('country')).trim().toUpperCase(),
		},
	}
}

function getSelectedShippingOption() {
	return document.querySelector('[name="shipping_option"]:checked')?.value
}

function readCheckoutSession() {
	return localStorage.getItem(SESSION_STORAGE_KEY)
}

function writeCheckoutSession(sessionId) {
	localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
}

function clearCheckoutSession() {
	localStorage.removeItem(SESSION_STORAGE_KEY)
}

function formatCurrency(cents) {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 2,
	}).format(cents / 100)
}

function titleCase(value) {
	return value
		.split('-')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
}

async function apiRequest(path, init = {}) {
	const apiBaseUrl = window.ACP_CONFIG?.apiBaseUrl?.replace(/\/$/, '')
	const response = await fetch(`${apiBaseUrl}${path}`, {
		...init,
		headers: {
			'content-type': 'application/json',
			...(init.headers || {}),
		},
	})

	const contentType = response.headers.get('content-type') || ''
	const payload = contentType.includes('application/json')
		? await response.json()
		: await response.text()

	if (!response.ok) {
		const message =
			typeof payload === 'string'
				? payload
				: payload.message || 'Request failed.'
		throw new Error(message)
	}

	return payload
}
