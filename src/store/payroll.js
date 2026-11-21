// Payroll arithmetic shared by the payroll pages, reports and cash book.
//
// salarySheets: { number, period 'YYYY-MM', branch, role, status, rows: [row] }
//   row: { employeeId, code, name, designation, basic, commission, allowance, overtime, deduction, carry, absent }
// salaryAdvances: money taken during the month, one record per payment { date, employeeId, period, amount, method }
// paySlips: salary paid at month end ("Pay Now / Settle Due") { date, employeeId, period, amount, method }
const n = (v) => Number(v) || 0
const r2 = (v) => Math.round(v * 100) / 100

export const thisMonth = () => new Date().toISOString().slice(0, 7)
export const monthLabel = (period) => {
  if (!/^\d{4}-\d{2}$/.test(period || '')) return period || ''
  const [y, m] = period.split('-')
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(m) - 1]} ${y}`
}
export const prevMonth = (period) => {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return d.toISOString().slice(0, 7)
}

export const gross = (row) => r2(n(row.basic) + n(row.commission) + n(row.allowance) + n(row.overtime))
export const netOf = (row) => r2(gross(row) - n(row.deduction) - n(row.carry))

export const advancesOf = (s, employeeId, period) =>
  (s.salaryAdvances || []).filter((a) => a.employeeId === employeeId && a.period === period).sort((a, b) => a.date.localeCompare(b.date))
export const salaryPaidOf = (s, employeeId, period) =>
  (s.paySlips || []).filter((p) => p.employeeId === employeeId && p.period === period).sort((a, b) => a.date.localeCompare(b.date))

// The sheet row that decides an employee's pay for a month (approved first, then the newest)
export function sheetRowFor(s, employeeId, period) {
  const sheets = (s.salarySheets || []).filter((x) => x.period === period && Array.isArray(x.rows) && x.rows.some((r) => r.employeeId === employeeId))
  const sheet = sheets.find((x) => x.status === 'Approved' || x.status === 'Paid') || sheets[sheets.length - 1]
  return sheet ? { sheet, row: sheet.rows.find((r) => r.employeeId === employeeId) } : null
}

// Everything about one employee's month
export function payState(s, employeeId, period, row) {
  const advances = advancesOf(s, employeeId, period)
  const payments = salaryPaidOf(s, employeeId, period)
  const taken = r2(advances.reduce((a, x) => a + n(x.amount), 0))
  const paid = r2(payments.reduce((a, x) => a + n(x.amount), 0))
  const net = row ? netOf(row) : 0
  const remaining = r2(net - taken) // what was left to pay at month end, before Pay Now
  const due = r2(net - taken - paid)
  const status = !row ? 'No Sheet' : taken + paid > net + 0.005 ? 'Over-Advanced' : due <= 0.005 ? 'Paid' : taken + paid > 0 ? 'Partial' : 'Unpaid'
  return { advances, payments, taken, takenCount: advances.length, paid, net, remaining, due, status, excess: due < 0 ? -due : 0 }
}

// Over-advance from last month that is carried forward into this month
export function carryFrom(s, employeeId, period) {
  const prev = prevMonth(period)
  const found = sheetRowFor(s, employeeId, prev)
  if (!found) return 0
  return payState(s, employeeId, prev, found.row).excess
}

// Shown status of a sheet: Approved becomes Paid once nobody is owed anything
export function sheetStatus(s, sheet) {
  if (!Array.isArray(sheet.rows)) return sheet.status || 'Old entry'
  if (sheet.status === 'Approved' && sheet.rows.length && sheet.rows.every((r) => payState(s, r.employeeId, sheet.period, r).due <= 0.005)) return 'Paid'
  return sheet.status || 'Draft'
}

export function sheetTotals(s, sheet) {
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  const states = rows.map((r) => payState(s, r.employeeId, sheet.period, r))
  return {
    employees: rows.length,
    gross: r2(rows.reduce((a, r) => a + gross(r), 0)),
    net: r2(rows.reduce((a, r) => a + netOf(r), 0)),
    taken: r2(states.reduce((a, x) => a + x.taken, 0)),
    remaining: r2(states.reduce((a, x) => a + x.remaining, 0)),
    due: r2(states.reduce((a, x) => a + x.due, 0)),
    over: states.filter((x) => x.status === 'Over-Advanced').length,
  }
}
