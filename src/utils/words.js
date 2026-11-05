// 4221 -> "four thousand two hundred twenty-one"
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SCALES = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]

function under1000(n) {
  const parts = []
  if (n >= 100) { parts.push(`${ONES[Math.floor(n / 100)]} hundred`); n %= 100 }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''))
  else if (n > 0) parts.push(ONES[n])
  return parts.join(' ')
}

export function numberToWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0))
  if (n === 0) return 'zero'
  const parts = []
  for (const [size, word] of SCALES) {
    if (n >= size) { parts.push(`${under1000(Math.floor(n / size))} ${word}`); n %= size }
  }
  if (n) parts.push(under1000(n))
  return (value < 0 ? 'minus ' : '') + parts.join(' ')
}

// "four thousand two hundred twenty-one Taka" (+ "and fifty Paisa")
export function amountInWords(value, currency = 'Taka') {
  const abs = Math.abs(Number(value) || 0)
  const paisa = Math.round((abs - Math.floor(abs)) * 100)
  let s = `${numberToWords(Math.trunc(Number(value) || 0))} ${currency}`
  if (paisa) s += ` and ${numberToWords(paisa)} Paisa`
  return s
}
