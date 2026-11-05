// public/ files, also when the app is served from a sub-folder (GitHub Pages)
const asset = (f) => `${import.meta.env.BASE_URL}${f}`

// Business details shown on the login screen, reports and printed invoices.
export const SHOP = {
  name: 'M/S SONALI PLASTIC DOOR & SANITARY',
  address: 'SHELI PLAZA, 32 WEST PAIKPARA, KUMARSHIL MORE, BRAHMANBARIA',
  phone: '01711-109149, 01939-342901',
  mobiles: ['01711-109149', '01939-342901'],
  logo: asset('logo.jpg'), // put your logo in public/; use '' for none
  currency: 'BDT',
  currencyWord: 'Taka',
  footer: 'Point of Sales',
}

// Brand logos shown next to "Dealers:" on the invoice (files in public/brands)
export const DEALER_BRANDS = [
  { name: 'Aura', logo: asset('brands/aura.jpg') },
  { name: 'ROSA', logo: asset('brands/rosa.jpg') },
  { name: 'RFL', logo: asset('brands/rfl.png') },
]

// Printed under the invoice
export const INVOICE_TERMS = [
  'All ceramic products are subject to size & shade varieties. Before using, verify the materials.',
  'No claims will be accepted once they are used.',
  'Goods once sold will not be taken back or exchanged.',
]

export const PAYMENT_METHODS = ['Cash', 'Bank', 'bKash', 'Nagad', 'Rocket', 'Cheque']
