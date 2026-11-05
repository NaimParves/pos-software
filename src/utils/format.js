export const money = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

export const round2 = (n) => Math.round(num(n) * 100) / 100

// yyyy-mm-dd, the format <input type="date"> uses
export const today = () => new Date().toISOString().slice(0, 10)

export const displayDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

// "8 X 12" (inches) -> square feet per piece
export const sftPerPiece = (sizeName) => {
  const m = String(sizeName || '').match(/(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)/)
  if (!m) return 0
  return (parseFloat(m[1]) * parseFloat(m[2])) / 144
}

export const inRange = (date, from, to) =>
  (!from || date >= from) && (!to || date <= to)
