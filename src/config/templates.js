// Template Settings: which design each kind of printed document uses.
// The choices are saved in the `templateSettings` collection (one record).

export const TEMPLATE_CATEGORIES = [
  { key: 'sale', label: 'Invoice Template', hint: 'Sales invoice / memo, challan and price quotation' },
  { key: 'salesReturn', label: 'Sales Return Template', hint: 'Sales return memo' },
  { key: 'directReturn', label: 'Direct Return Template', hint: 'Direct return memo' },
  { key: 'purchase', label: 'Purchase Template', hint: 'Purchase invoice, purchase order, purchase return and damage' },
  { key: 'receive', label: 'Receive from Customer Template', hint: 'Money receipt for due collection and customer advance' },
  { key: 'pay', label: 'Pay to Supplier Template', hint: 'Payment voucher for supplier payment and supplier advance' },
  { key: 'customerSettlement', label: 'Customer Settlement Template', hint: 'Customer settlement receipt' },
  { key: 'supplierSettlement', label: 'Supplier Settlement Template', hint: 'Supplier settlement receipt' },
]

export const DESIGNS = [
  {
    key: 'classic', name: 'Template 1 — Classic',
    features: 'Framed header with logo and mobile numbers, dealer logos, coloured table header, terms box and signatures.',
  },
  {
    key: 'modern', name: 'Template 2 — Modern',
    features: 'Full-width coloured header band, banner/logo on the left, light striped table and a highlighted total.',
  },
  {
    key: 'simple', name: 'Template 3 — Simple',
    features: 'Plain black-and-white layout with a centred header. Saves ink and suits any printer.',
  },
]

export const DEFAULT_COLOR = '#ec6a1f'

// dealers / terms: null = use the defaults from config/shop.js
// Memos show dealer logos and terms unless switched off; money receipts only when switched on.
export const blankTemplate = (kind = 'sale') => ({
  design: 'classic', color: DEFAULT_COLOR, banner: '', title: '', headerNote: '', footerNote: '',
  showTerms: MEMO_KINDS.includes(kind), showDealers: MEMO_KINDS.includes(kind),
  dealers: null, terms: null, gradient: false, color2: '#f1b44c', direction: 'to right', twoColumn: false,
})

export const GRADIENT_DIRECTIONS = [
  { value: 'to bottom', label: 'Top → Bottom' },
  { value: 'to right', label: 'Left → Right' },
  { value: 'to bottom right', label: 'Corner ↘ (top-left to bottom-right)' },
  { value: 'to top right', label: 'Corner ↗ (bottom-left to top-right)' },
  { value: 'radial', label: 'Centre → Edges (radial)' },
]

// The colour to paint headers, bands and table heads with (plain or gradient)
export function paint(t, fallback = DEFAULT_COLOR) {
  const c1 = t?.color || fallback
  if (!t?.gradient) return c1
  const c2 = t.color2 || '#f1b44c'
  return t.direction === 'radial' ? `radial-gradient(circle, ${c1}, ${c2})` : `linear-gradient(${t.direction || 'to right'}, ${c1}, ${c2})`
}

// Template categories that print an invoice-style memo (the others print a money receipt)
export const MEMO_KINDS = ['sale', 'salesReturn', 'directReturn', 'purchase']

// collection of a saved document -> template category
export function templateKindOf(collection, doc) {
  if (collection === 'salesReturns') return doc?.sourceId ? 'salesReturn' : 'directReturn'
  if (['purchases', 'purchaseOrders', 'purchaseReturns', 'damages'].includes(collection)) return 'purchase'
  return 'sale'
}

export const PAPER_SIZES = [
  { value: 'A4', label: 'A4 Size Paper (210 × 297 mm)', css: 'A4 portrait' },
  { value: 'A5', label: 'A5 Size Paper (148 × 210 mm)', css: 'A5 portrait' },
  { value: 'Letter', label: 'Letter Size Paper', css: 'letter portrait' },
  { value: 'Legal', label: 'Legal Size Paper', css: 'legal portrait' },
]
