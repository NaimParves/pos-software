import { useMemo, useState } from 'react'
import { Printer, Search, ImageOff } from 'lucide-react'
import { PageHeader, Card, Input, Select, Button, Modal, Field } from '../components/ui'
import Combo from '../components/Combo'
import DataTable from '../components/DataTable'
import { useDb, contactBalance } from '../store/db'
import { SHOP, PAYMENT_METHODS } from '../config/shop'
import { displayDate, inRange, money, round2, sftPerPiece, today } from '../utils/format'

const sum = (arr, f) => arr.reduce((a, x) => a + Number(typeof f === 'function' ? f(x) : x[f] || 0), 0)

function ReportShell({ title, filters, children }) {
  return (
    <>
      <PageHeader title={title} trail={['Reports', title]} />
      <Card>
        <div className="print-area">
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">{SHOP.name}</h2>
            <p className="text-[11px] text-gray-600">{SHOP.address}</p>
            <p className="text-[11px] text-gray-600">{SHOP.phone}</p>
            <h3 className="text-base font-semibold text-gray-700 mt-1">{title}</h3>
          </div>
          {filters && <div className="flex flex-wrap gap-3 items-end mb-4 print:hidden">{filters}<Button color="success" onClick={() => window.print()}><Printer size={15} /></Button></div>}
          {!filters && <div className="flex justify-end mb-3 print:hidden"><Button color="success" onClick={() => window.print()}><Printer size={15} /> Print</Button></div>}
          {children}
        </div>
      </Card>
    </>
  )
}

function DateFilter({ value, onApply }) {
  const [r, setR] = useState(value)
  return (
    <>
      <Field label="From"><Input type="date" value={r.from} onChange={(e) => setR({ ...r, from: e.target.value })} /></Field>
      <Field label="To"><Input type="date" value={r.to} onChange={(e) => setR({ ...r, to: e.target.value })} /></Field>
      <Button onClick={() => onApply(r)}><Search size={15} /> Search</Button>
    </>
  )
}

const monthStart = () => today().slice(0, 8) + '01'
const useRange = () => useState({ from: monthStart(), to: today() })

// ---------- Stock ----------
export function StockReport({ variant = 'status' }) {
  const s = useDb()
  const [f, setF] = useState({ brand: '', category: '', size: '', product: '', show: 'all' })
  const [a, setA] = useState(f)
  let rows = s.products
    .filter((p) => !a.brand || p.brand === a.brand)
    .filter((p) => !a.category || p.category === a.category)
    .filter((p) => !a.size || p.size === a.size)
    .filter((p) => !a.product || p.id === a.product)
    .filter((p) => a.show === 'all' || (a.show === 'in' ? p.stock > 0 : p.stock <= 0))
  if (variant === 'emergency') rows = s.products.filter((p) => Number(p.stock) <= Number(p.alertQty || 0))

  const title = { status: 'Stock Report', details: 'Stock Status Details', items: 'List of Items', emergency: 'Emergency Purchase List' }[variant]
  const breakdown = (p) => {
    const sft = p.kind === 'Tiles' ? sftPerPiece(p.size) : 0
    const pieces = sft ? Math.round(p.stock / sft) : p.stock
    const per = p.pcsPerCart || 1
    return { cart: Math.trunc(pieces / per), pcs: Math.round(pieces % per) }
  }

  const columns = [
    { key: 'sl', label: 'SL', render: (_, i) => i + 1, sortable: false },
    { key: 'code', label: 'Code' }, { key: 'grade', label: 'Grade' }, { key: 'name', label: 'Name' },
    { key: 'size', label: 'Size' }, { key: 'brand', label: 'Brand' }, { key: 'category', label: 'Category' },
    { key: 'purchasePrice', label: 'P/Price', align: 'right', render: (p) => money(p.purchasePrice) },
    { key: 'sellPrice', label: 'S/Price', align: 'right', render: (p) => money(p.sellPrice) },
    ...(variant === 'details' ? [
      { key: 'cart', label: 'Cartoon', align: 'right', render: (p) => breakdown(p).cart, sortable: false },
      { key: 'pcs', label: 'PCS', align: 'right', render: (p) => breakdown(p).pcs, sortable: false },
    ] : []),
    ...(variant === 'emergency' ? [{ key: 'alertQty', label: 'Alert Qty', align: 'right' }] : []),
    ...(variant !== 'items' ? [
      { key: 'stock', label: 'Stock/SFT', align: 'right', render: (p) => <span className={p.stock < 0 ? 'text-danger' : ''}>{money(p.stock)}</span> },
      { key: 'value', label: 'Stock Value', align: 'right', render: (p) => money(p.stock * p.purchasePrice), sortable: false },
    ] : [{ key: 'status', label: 'Status' }]),
  ]
  const opts = (list) => list.map((x) => ({ value: x.name, label: x.name }))
  const filters = variant === 'status' || variant === 'details' ? (
    <>
      <Select className="!w-40" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} placeholder="-- All Brands --" options={opts(s.brands)} />
      <Select className="!w-40" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="-- All Categories --" options={opts(s.categories)} />
      <Select className="!w-36" value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })} placeholder="-- All Sizes --" options={opts(s.sizes)} />
      <Combo className="w-48" value={f.product} onChange={(v) => setF({ ...f, product: v })} placeholder="-- All Product --" options={[{ value: '', label: '-- All Product --' }, ...s.products.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))]} />
      <Select className="!w-36" value={f.show} onChange={(e) => setF({ ...f, show: e.target.value })} options={[{ value: 'all', label: 'Show All' }, { value: 'in', label: 'In Stock' }, { value: 'out', label: 'Out of Stock' }]} />
      <Button color="success" onClick={() => setA(f)}>Search</Button>
    </>
  ) : null

  return (
    <ReportShell title={title} filters={filters}>
      <DataTable columns={columns} rows={rows} pageSizes={[100, 250, 500]}
        footer={variant !== 'items' && (
          <tr className="border-t"><td colSpan={columns.length - 1} className="px-3 py-2 text-right">Total Stock Value</td>
            <td className="px-3 py-2 text-right">{money(sum(rows, (p) => p.stock * p.purchasePrice))}</td></tr>
        )} />
    </ReportShell>
  )
}

export function StockWithImage() {
  const s = useDb()
  return (
    <ReportShell title="Product With Image">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {s.products.map((p) => (
          <div key={p.id} className="border rounded p-3 text-[12px]">
            <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center overflow-hidden">
              {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <ImageOff className="text-gray-300" size={32} />}
            </div>
            <p className="font-medium text-gray-700">{p.name}</p>
            <p className="text-gray-500">{p.code} {p.size && `| ${p.size}`}</p>
            <p>Stock: <b>{round2(p.stock)}</b> | Price: <b>{money(p.sellPrice)}</b></p>
          </div>
        ))}
      </div>
    </ReportShell>
  )
}

// ---------- Sales / purchase statements & summaries ----------
export function StatementReport({ collection, title, party = 'Customer' }) {
  const s = useDb()
  const [range, setRange] = useRange()
  const docs = s[collection].filter((d) => inRange(d.date, range.from, range.to))
  const lines = docs.flatMap((d) => d.items.map((it) => ({ ...it, date: d.date, number: d.number, contactName: d.contactName, id: d.id + it.productId })))
  const columns = [
    { key: 'sl', label: 'SL', render: (_, i) => i + 1, sortable: false },
    { key: 'date', label: 'Date', render: (r) => displayDate(r.date) },
    { key: 'number', label: 'Invoice#' }, { key: 'contactName', label: party },
    { key: 'name', label: 'Product' }, { key: 'qty', label: 'Qty', align: 'right', render: (r) => round2(r.qty) },
    { key: 'rate', label: 'Rate', align: 'right', render: (r) => money(r.rate) },
    { key: 'total', label: 'Total', align: 'right', render: (r) => money(r.total) },
  ]
  return (
    <ReportShell title={title} filters={<DateFilter value={range} onApply={setRange} />}>
      <DataTable columns={columns} rows={lines} pageSizes={[100, 250]}
        footer={<tr className="border-t"><td colSpan={7} className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right">{money(sum(lines, 'total'))}</td></tr>} />
    </ReportShell>
  )
}

export function SummaryReport({ collection, title }) {
  const s = useDb()
  const [range, setRange] = useRange()
  const docs = s[collection].filter((d) => inRange(d.date, range.from, range.to))
  const byDate = Object.values(docs.reduce((m, d) => {
    const r = m[d.date] || { id: d.date, date: d.date, count: 0, amount: 0, discount: 0, paid: 0, due: 0 }
    r.count += 1; r.amount += d.invoiceAmount; r.discount += d.discount || 0; r.paid += d.paid; r.due += d.due
    m[d.date] = r
    return m
  }, {})).sort((a, b) => a.date.localeCompare(b.date))
  const columns = [
    { key: 'date', label: 'Date', render: (r) => displayDate(r.date) },
    { key: 'count', label: 'Invoices', align: 'right' },
    { key: 'discount', label: 'Discount', align: 'right', render: (r) => money(r.discount) },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
    { key: 'paid', label: 'Paid', align: 'right', render: (r) => money(r.paid) },
    { key: 'due', label: 'Due', align: 'right', render: (r) => money(r.due) },
  ]
  return (
    <ReportShell title={title} filters={<DateFilter value={range} onApply={setRange} />}>
      <DataTable columns={columns} rows={byDate} searchable={false}
        footer={<tr className="border-t"><td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right">{sum(byDate, 'count')}</td><td className="px-3 py-2 text-right">{money(sum(byDate, 'discount'))}</td><td className="px-3 py-2 text-right">{money(sum(byDate, 'amount'))}</td><td className="px-3 py-2 text-right">{money(sum(byDate, 'paid'))}</td><td className="px-3 py-2 text-right">{money(sum(byDate, 'due'))}</td></tr>} />
    </ReportShell>
  )
}

export function AccountListReport({ collection, title }) {
  const s = useDb()
  const [range, setRange] = useRange()
  const rows = s[collection].filter((d) => inRange(d.date, range.from, range.to))
  const columns = [
    { key: 'date', label: 'Date', render: (r) => displayDate(r.date) }, { key: 'number', label: 'Number' },
    { key: 'head', label: 'Account Head' }, { key: 'contact', label: 'Contact' }, { key: 'method', label: 'Through' },
    { key: 'note', label: 'Note' }, { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
  ]
  return (
    <ReportShell title={title} filters={<DateFilter value={range} onApply={setRange} />}>
      <DataTable columns={columns} rows={rows}
        footer={<tr className="border-t"><td colSpan={6} className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right">{money(sum(rows, 'amount'))}</td></tr>} />
    </ReportShell>
  )
}

// Every money movement as { date, desc, method, in, out }
function cashFlows(s) {
  const flows = []
  const pays = (docs, label, dir) => docs.forEach((d) => (d.payments || []).forEach((p) => flows.push({ date: d.date, desc: `${label} ${d.number} - ${d.contactName}`, method: p.method, [dir]: Number(p.amount) })))
  pays(s.sales, 'Sale', 'in')
  pays(s.purchases, 'Purchase', 'out')
  pays(s.salesReturns, 'Sales Return', 'out')
  pays(s.purchaseReturns, 'Purchase Return', 'in')
  s.expenses.forEach((e) => flows.push({ date: e.date, desc: `Expense - ${e.head}`, method: e.method, out: e.amount }))
  s.incomes.forEach((e) => flows.push({ date: e.date, desc: `Income - ${e.head}`, method: e.method, in: e.amount }))
  s.payments.forEach((p) => flows.push({ date: p.date, desc: `${p.type === 'receive' ? 'Received from' : 'Paid to'} ${p.contactName}`, method: p.method, [p.type === 'receive' ? 'in' : 'out']: p.amount }))
  s.paySlips.forEach((p) => flows.push({ date: p.date, desc: `Salary - ${p.employeeName}`, method: p.method, out: p.amount }))
  s.transfers.forEach((t) => {
    flows.push({ date: t.date, desc: `Transfer to ${t.toAcc}`, method: t.fromAcc, out: t.amount })
    flows.push({ date: t.date, desc: `Transfer from ${t.fromAcc}`, method: t.toAcc, in: t.amount })
  })
  return flows.map((f, i) => ({ id: i, in: 0, out: 0, ...f })).sort((a, b) => a.date.localeCompare(b.date))
}

export function BookReport({ bank }) {
  const s = useDb()
  const [range, setRange] = useRange()
  const all = cashFlows(s).filter((f) => (bank ? f.method !== 'Cash' : f.method === 'Cash'))
  const opening = sum(all.filter((f) => f.date < range.from), (f) => f.in - f.out)
  let bal = opening
  const rows = all.filter((f) => inRange(f.date, range.from, range.to)).map((f) => ({ ...f, balance: (bal += f.in - f.out) }))
  const columns = [
    { key: 'date', label: 'Date', render: (r) => displayDate(r.date) }, { key: 'desc', label: 'Description' }, { key: 'method', label: 'Account' },
    { key: 'in', label: 'Debit (In)', align: 'right', render: (r) => (r.in ? money(r.in) : '') },
    { key: 'out', label: 'Credit (Out)', align: 'right', render: (r) => (r.out ? money(r.out) : '') },
    { key: 'balance', label: 'Balance', align: 'right', render: (r) => money(r.balance) },
  ]
  return (
    <ReportShell title={bank ? 'Bank Book' : 'Cash Book'} filters={<DateFilter value={range} onApply={setRange} />}>
      <p className="text-[13px] mb-2">Opening Balance: <b>{money(opening)}</b></p>
      <DataTable columns={columns} rows={rows} searchable={false} />
      <p className="text-[13px] mt-2 text-right">Closing Balance: <b>{money(bal)}</b></p>
    </ReportShell>
  )
}

export function CurrentBalance() {
  const s = useDb()
  const flows = cashFlows(s)
  const rows = PAYMENT_METHODS.map((m) => ({ id: m, method: m, in: sum(flows.filter((f) => f.method === m), 'in'), out: sum(flows.filter((f) => f.method === m), 'out') }))
  return (
    <ReportShell title="Current Balance">
      <DataTable searchable={false} rows={rows} columns={[
        { key: 'method', label: 'Account' },
        { key: 'in', label: 'Total In', align: 'right', render: (r) => money(r.in) },
        { key: 'out', label: 'Total Out', align: 'right', render: (r) => money(r.out) },
        { key: 'bal', label: 'Balance', align: 'right', render: (r) => <b>{money(r.in - r.out)}</b> },
      ]} footer={<tr className="border-t"><td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right">{money(sum(rows, 'in'))}</td><td className="px-3 py-2 text-right">{money(sum(rows, 'out'))}</td><td className="px-3 py-2 text-right">{money(sum(rows, (r) => r.in - r.out))}</td></tr>} />
    </ReportShell>
  )
}

export function DailyReport() {
  const s = useDb()
  const [date, setDate] = useState(today())
  const on = (arr) => arr.filter((x) => x.date === date)
  const flows = cashFlows(s).filter((f) => f.date === date)
  const lines = [
    ['Total Sales', sum(on(s.sales), 'invoiceAmount')],
    ['Cash Received From Sales', sum(on(s.sales), 'paid')],
    ['Sales Due', sum(on(s.sales), 'due')],
    ['Collection From Customers', sum(on(s.payments).filter((p) => p.type === 'receive'), 'amount')],
    ['Sales Return', sum(on(s.salesReturns), 'invoiceAmount')],
    ['Total Purchase', sum(on(s.purchases), 'invoiceAmount')],
    ['Paid To Suppliers', sum(on(s.payments).filter((p) => p.type === 'pay'), 'amount') + sum(on(s.purchases), 'paid')],
    ['Expenses', sum(on(s.expenses), 'amount')],
    ['Other Income', sum(on(s.incomes), 'amount')],
    ['Total In', sum(flows, 'in')],
    ['Total Out', sum(flows, 'out')],
    ['Net Cash Flow', sum(flows, (f) => f.in - f.out)],
  ]
  return (
    <ReportShell title="Daily Report" filters={<Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>}>
      <table className="w-full max-w-xl mx-auto text-[13px] border">
        <tbody>{lines.map(([k, v]) => <tr key={k} className="border-t"><td className="px-3 py-2">{k}</td><td className="px-3 py-2 text-right font-medium">{money(v)}</td></tr>)}</tbody>
      </table>
    </ReportShell>
  )
}

// ---------- Ledgers ----------
export function LedgerReport({ supplier }) {
  const s = useDb()
  const [view, setView] = useState(null)
  const types = supplier ? ['supplier'] : ['customer', 'retailer']
  const rows = s.contacts.filter((c) => types.includes(c.type)).map((c) => ({ ...c, balance: contactBalance(c, s) }))
  const columns = [
    { key: 'code', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'address', label: 'Address' },
    { key: 'balance', label: 'Balance', align: 'right', render: (r) => <span className={r.balance > 0 ? 'text-danger font-medium' : ''}>{money(r.balance)}</span> },
    { key: 'action', label: 'Action', render: (r) => <Button color="info" className="!py-1" onClick={() => setView(r)}>Ledger</Button> },
  ]
  return (
    <ReportShell title={supplier ? 'Supplier Ledger' : 'Customer Ledger'}>
      <DataTable columns={columns} rows={rows}
        footer={<tr className="border-t"><td colSpan={4} className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right">{money(sum(rows, 'balance'))}</td><td /></tr>} />
      <Modal open={!!view} onClose={() => setView(null)} title={`Ledger - ${view?.name}`} wide>
        {view && <ContactLedger contact={view} />}
      </Modal>
    </ReportShell>
  )
}

function ContactLedger({ contact }) {
  const s = useDb()
  const sup = contact.type === 'supplier'
  const entries = useMemo(() => {
    const e = []
    ;(sup ? s.purchases : s.sales).filter((d) => d.contactId === contact.id).forEach((d) => {
      e.push({ date: d.date, desc: `${sup ? 'Purchase' : 'Sale'} ${d.number}`, debit: d.invoiceAmount, credit: 0 })
      if (d.paid) e.push({ date: d.date, desc: `Paid on ${d.number}`, debit: 0, credit: d.paid })
    })
    ;(sup ? s.purchaseReturns : s.salesReturns).filter((d) => d.contactId === contact.id).forEach((d) => e.push({ date: d.date, desc: `Return ${d.number}`, debit: 0, credit: d.invoiceAmount }))
    s.payments.filter((p) => p.contactId === contact.id).forEach((p) => e.push({ date: p.date, desc: `Payment ${p.number || ''}`, debit: 0, credit: p.amount }))
    s.settlements.filter((p) => p.contactId === contact.id).forEach((p) => e.push({ date: p.date, desc: 'Settlement', debit: 0, credit: p.amount }))
    e.sort((a, b) => a.date.localeCompare(b.date))
    let bal = Number(contact.openingBalance || 0)
    return [{ date: '', desc: 'Opening Balance', debit: 0, credit: 0, balance: bal }, ...e.map((x) => ({ ...x, balance: (bal += x.debit - x.credit) }))]
  }, [s, contact, sup])
  return (
    <div className="print-area">
      <h3 className="text-center font-semibold mb-1">{SHOP.name}</h3>
      <p className="text-center text-[13px] mb-3">Ledger of {contact.name} ({contact.phone})</p>
      <table className="w-full text-[13px] border">
        <thead className="bg-gray-50"><tr><th className="px-2 py-1.5 text-left">Date</th><th className="px-2 py-1.5 text-left">Description</th><th className="px-2 py-1.5 text-right">Debit</th><th className="px-2 py-1.5 text-right">Credit</th><th className="px-2 py-1.5 text-right">Balance</th></tr></thead>
        <tbody>{entries.map((x, i) => <tr key={i} className="border-t"><td className="px-2 py-1.5">{displayDate(x.date)}</td><td className="px-2 py-1.5">{x.desc}</td><td className="px-2 py-1.5 text-right">{x.debit ? money(x.debit) : ''}</td><td className="px-2 py-1.5 text-right">{x.credit ? money(x.credit) : ''}</td><td className="px-2 py-1.5 text-right">{money(x.balance)}</td></tr>)}</tbody>
      </table>
      <div className="flex justify-end mt-3 print:hidden"><Button onClick={() => window.print()}><Printer size={15} /> Print</Button></div>
    </div>
  )
}

// ---------- Item wise ----------
export function ItemWiseReport({ supplier }) {
  const s = useDb()
  const [pid, setPid] = useState(s.products[0]?.id || '')
  const docs = supplier ? s.purchases : s.sales
  const map = {}
  docs.forEach((d) => d.items.filter((it) => it.productId === pid).forEach((it) => {
    const k = d.contactId || d.contactName
    const r = map[k] || { id: k, name: d.contactName, phone: d.phone, qty: 0, amount: 0, times: 0 }
    r.qty += Number(it.qty); r.amount += Number(it.total); r.times += 1
    map[k] = r
  }))
  const rows = Object.values(map)
  return (
    <ReportShell title={supplier ? 'Item Wise Supplier' : 'Item Wise Customer'}
      filters={<Field label="Product"><Combo className="w-72" value={pid} onChange={setPid} options={s.products.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))} /></Field>}>
      <DataTable rows={rows} columns={[
        { key: 'name', label: supplier ? 'Supplier' : 'Customer' }, { key: 'phone', label: 'Phone' },
        { key: 'times', label: 'Invoices', align: 'right' }, { key: 'qty', label: 'Qty', align: 'right', render: (r) => round2(r.qty) },
        { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
      ]} />
    </ReportShell>
  )
}

export function RegisterList({ type }) {
  const s = useDb()
  const title = { customer: 'Buyer List', retailer: 'Retailer List', supplier: 'Supplier List' }[type]
  const rows = s.contacts.filter((c) => c.type === type)
  return (
    <ReportShell title={title}>
      <DataTable rows={rows} columns={[
        { key: 'code', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'organization', label: 'Organization' },
        { key: 'phone', label: 'Phone' }, { key: 'address', label: 'Address' },
        { key: 'balance', label: 'Balance', align: 'right', render: (c) => money(contactBalance(c, s)), sortable: false },
      ]} />
    </ReportShell>
  )
}
