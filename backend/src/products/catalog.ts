export type ProductCategory =
	| 'recovery'
	| 'performance'
	| 'anti-aging'
	| 'nootropics'
	| 'metabolic'

export type StockStatus = 'in_stock' | 'low_stock'

export interface Product {
	id: string
	sku: string
	name: string
	category: ProductCategory
	short_description: string
	description: string
	purity: string
	dosage_forms: string[]
	price: number
	stock_status: StockStatus
	research_use_only: true
	featured_benefit: string
	hero_image: string
	keywords: string[]
}

export const PRODUCT_CATALOG: Product[] = [
	{
		id: 'bpc-157',
		sku: 'PEP-BPC-157-5MG',
		name: 'BPC-157',
		category: 'recovery',
		short_description: 'A recovery-focused peptide popular in tendon and gut repair research.',
		description:
			'BPC-157 is commonly explored in connective tissue, gastric, and soft-tissue recovery studies. This demo product is presented for research workflow simulations only.',
		purity: '99%+',
		dosage_forms: ['5mg lyophilized vial'],
		price: 12900,
		stock_status: 'in_stock',
		research_use_only: true,
		featured_benefit: 'Recovery support',
		hero_image: '/images/products/bpc-157.svg',
		keywords: ['recovery', 'gut', 'tendon', 'healing'],
	},
	{
		id: 'tb-500',
		sku: 'PEP-TB500-10MG',
		name: 'TB-500',
		category: 'recovery',
		short_description: 'A thymosin beta-4 fragment used in mobility and repair research.',
		description:
			'TB-500 is often researched alongside connective tissue recovery protocols and performance restoration studies.',
		purity: '99%+',
		dosage_forms: ['10mg lyophilized vial'],
		price: 14900,
		stock_status: 'in_stock',
		research_use_only: true,
		featured_benefit: 'Mobility research',
		hero_image: '/images/products/tb-500.svg',
		keywords: ['recovery', 'mobility', 'repair'],
	},
	{
		id: 'ghk-cu',
		sku: 'PEP-GHK-CU-50MG',
		name: 'GHK-Cu',
		category: 'anti-aging',
		short_description: 'A copper peptide investigated in dermal and regenerative research.',
		description:
			'GHK-Cu appears frequently in cosmetic and tissue-regeneration studies focused on remodeling and skin recovery.',
		purity: '98%+',
		dosage_forms: ['50mg lyophilized vial', 'serum concentrate'],
		price: 9900,
		stock_status: 'in_stock',
		research_use_only: true,
		featured_benefit: 'Regenerative signaling',
		hero_image: '/images/products/ghk-cu.svg',
		keywords: ['skin', 'copper peptide', 'regeneration'],
	},
	{
		id: 'ipamorelin',
		sku: 'PEP-IPAMORELIN-5MG',
		name: 'Ipamorelin',
		category: 'performance',
		short_description: 'A growth-hormone secretagogue used in body composition research.',
		description:
			'Ipamorelin is typically studied for growth hormone pulse behavior and recovery-focused performance protocols.',
		purity: '99%+',
		dosage_forms: ['5mg lyophilized vial'],
		price: 11900,
		stock_status: 'low_stock',
		research_use_only: true,
		featured_benefit: 'Recovery signaling',
		hero_image: '/images/products/ipamorelin.svg',
		keywords: ['growth hormone', 'secretagogue', 'recovery'],
	},
	{
		id: 'cjc-1295',
		sku: 'PEP-CJC1295-5MG',
		name: 'CJC-1295',
		category: 'performance',
		short_description: 'A GHRH analog evaluated in endurance and recovery stacks.',
		description:
			'CJC-1295 is frequently investigated for prolonged growth hormone response and peptide stack design.',
		purity: '99%+',
		dosage_forms: ['5mg lyophilized vial'],
		price: 12900,
		stock_status: 'in_stock',
		research_use_only: true,
		featured_benefit: 'Longer GH stimulation',
		hero_image: '/images/products/cjc-1295.svg',
		keywords: ['ghrh', 'performance', 'stack'],
	},
	{
		id: 'pt-141',
		sku: 'PEP-PT141-10MG',
		name: 'PT-141',
		category: 'metabolic',
		short_description: 'A melanocortin analog explored in libido and appetite-response research.',
		description:
			'PT-141 is commonly explored in melanocortin pathway studies with behavioral and metabolic effects.',
		purity: '99%+',
		dosage_forms: ['10mg lyophilized vial'],
		price: 10900,
		stock_status: 'in_stock',
		research_use_only: true,
		featured_benefit: 'Melanocortin pathway studies',
		hero_image: '/images/products/pt-141.svg',
		keywords: ['melanocortin', 'libido', 'metabolic'],
	},
	{
		id: 'selank',
		sku: 'PEP-SELANK-5MG',
		name: 'Selank',
		category: 'nootropics',
		short_description: 'An anxiolytic peptide presented in nasal and injectable research formats.',
		description:
			'Selank is studied for stress modulation, cognitive steadiness, and mood-regulation use cases.',
		purity: '98%+',
		dosage_forms: ['5mg lyophilized vial', 'nasal spray concentrate'],
		price: 8900,
		stock_status: 'in_stock',
		research_use_only: true,
		featured_benefit: 'Calm focus',
		hero_image: '/images/products/selank.svg',
		keywords: ['anxiolytic', 'focus', 'nasal'],
	},
	{
		id: 'semax',
		sku: 'PEP-SEMAX-5MG',
		name: 'Semax',
		category: 'nootropics',
		short_description: 'A nootropic peptide explored in attention and neuroplasticity research.',
		description:
			'Semax appears in experiments around cognition, learning support, and neuroprotective response pathways.',
		purity: '98%+',
		dosage_forms: ['5mg lyophilized vial', 'nasal spray concentrate'],
		price: 8900,
		stock_status: 'in_stock',
		research_use_only: true,
		featured_benefit: 'Attention support',
		hero_image: '/images/products/semax.svg',
		keywords: ['nootropic', 'attention', 'focus'],
	},
	{
		id: 'kpv',
		sku: 'PEP-KPV-10MG',
		name: 'KPV',
		category: 'recovery',
		short_description: 'A tripeptide studied in inflammation and gut-barrier research.',
		description:
			'KPV is often explored for inflammatory signaling and gastrointestinal support in research settings.',
		purity: '99%+',
		dosage_forms: ['10mg lyophilized vial'],
		price: 7900,
		stock_status: 'in_stock',
		research_use_only: true,
		featured_benefit: 'Inflammation research',
		hero_image: '/images/products/kpv.svg',
		keywords: ['inflammation', 'gut', 'recovery'],
	},
	{
		id: 'epithalon',
		sku: 'PEP-EPITHALON-10MG',
		name: 'Epithalon',
		category: 'anti-aging',
		short_description: 'A peptide associated with telomerase and longevity research.',
		description:
			'Epithalon is used in longevity-oriented peptide stacks and cellular aging studies.',
		purity: '99%+',
		dosage_forms: ['10mg lyophilized vial'],
		price: 15900,
		stock_status: 'low_stock',
		research_use_only: true,
		featured_benefit: 'Longevity studies',
		hero_image: '/images/products/epithalon.svg',
		keywords: ['longevity', 'telomerase', 'anti-aging'],
	},
]

export function getProductById(productId: string): Product | undefined {
	return PRODUCT_CATALOG.find(product => product.id === productId)
}

export function searchProducts(query: string): Product[] {
	const normalizedQuery = query.trim().toLowerCase()
	if (!normalizedQuery) {
		return PRODUCT_CATALOG
	}

	return PRODUCT_CATALOG.filter(product => {
		const haystack = [
			product.name,
			product.category,
			product.short_description,
			product.description,
			...product.keywords,
		]
			.join(' ')
			.toLowerCase()

		return haystack.includes(normalizedQuery)
	})
}
