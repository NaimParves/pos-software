import { Fragment, useMemo, useState } from 'react'
import { Printer, Search, ImageOff } from 'lucide-react'
import { PageHeader, Card, Input, Select, Button, Modal, Field } from '../components/ui'
import Combo from '../components/Combo'
import DataTable from '../components/DataTable'
import InvoicePrint from '../components/InvoicePrint'
import { useDb, contactBalance } from '../store/db'
import { SHOP, PAYMENT_METHODS } from '../config/shop'
import { displayDate, inRange, money, num, round2, sftPerPiece, today } from '../utils/format'

const sum = (arr, f) => arr.reduce((a, x) => a + Number(typeof f === 'function' ? f(x) : x[f] || 0), 0)

function ReportShell({ title, subtitle, filters, children }) {
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
            {subtitle && <p className="text-[12px] text-gray-600">{subtitle}</p>}
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
const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)))

// Shop header used on the printed statements
function PrintHead() {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        {SHOP.logo && <img src={SHOP.logo} alt="" className="w-14 h-auto" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
      </div>
      <div className="text-right text-[11px] text-gray-600 leading-4">
        <p className="font-semibold text-[13px] text-gray-800">{SHOP.name}</p>
        <p>{SHOP.address}</p>
        <p>{SHOP.phone}</p>
        <p>Print Date: {displayDate(today())}</p>
      </div>
    </div>
  )
}

// Statement of Sales / Statement of Purchase: a query page; Show or Print
// lists every matching invoice line, with the invoice totals beside them.
export function StatementReport({ collection, title, party = 'Customer' }) {
  const s = useDb()
  const sale = collection === 'sales'
  const word = sale ? 'Sales' : 'Purchase'
  const retCol = sale ? 'salesReturns' : 'purchaseReturns'
  const docsAll = s[collection]
  const contacts = s.contacts.filter((c) => (sale ? ['customer', 'retailer'] : ['supplier']).includes(c.type))
  const blankF = { from: monthStart(), to: today(), contactId: '', company: '', docId: '', category: '', productId: '', code: '', referenceId: '', by: '', kind: '' }
  const [f, setF] = useState(blankF)
  const [a, setA] = useState(null)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const run = (print) => { setA({ ...f }); if (print) setTimeout(() => window.print(), 400) }

  const prod = (id) => s.products.find((p) => p.id === id)
  const contactOf = (d) => s.contacts.find((c) => c.id === d.contactId)
  const name = (id) => s.contacts.find((c) => c.id === id)?.name || ''

  const report = useMemo(() => {
    if (!a) return null
    const docOk = (d, isReturn) => inRange(d.date, a.from, a.to)
      && (!a.contactId || d.contactId === a.contactId)
      && (!a.company || contactOf(d)?.organization === a.company)
      && (!a.docId || (isReturn ? d.sourceId === a.docId : d.id === a.docId))
      && (!a.referenceId || d.referenceId === a.referenceId)
      && (!a.by || (d.createdBy || '') === a.by)
    const lineOk = (it) => (!a.category || (prod(it.productId)?.category || '') === a.category)
      && (!a.productId || it.productId === a.productId)
      && (!a.code || (it.code || prod(it.productId)?.code) === a.code)
    const groups = [
      ...(a.kind !== 'R' ? docsAll.map((d) => ({ d, type: sale ? 'S' : 'P', sign: 1 })) : []),
      ...(a.kind !== 'S' ? s[retCol].map((d) => ({ d, type: 'R', sign: -1 })) : []),
    ]
      .filter(({ d, type }) => docOk(d, type === 'R'))
      .map((g) => ({ ...g, lines: g.d.items.filter(lineOk) }))
      .filter((g) => g.lines.length)
      .sort((x, y) => x.d.date.localeCompare(y.d.date) || String(x.d.number).localeCompare(String(y.d.number)))
      .map((g) => {
        const lines = g.lines.map((it) => {
          const p = prod(it.productId) || {}
          const tPrice = num(it.qty) * num(it.rate)
          return {
            code: it.code || p.code || '', name: it.name || p.name || '', um: (it.kind || p.kind) === 'Tiles' ? 'SFT' : 'PCS',
            qty: num(it.qty), rate: num(it.rate), tPrice, disc: round2(tPrice - num(it.total)), payable: num(it.total),
          }
        })
        // profit on a sale at today's purchase prices (labour cost and VAT are passed on, not profit)
        const cost = g.d.items.reduce((acc, it) => acc + num(it.qty) * num(prod(it.productId)?.purchasePrice), 0)
        const profit = sale && g.type === 'S' ? round2(num(g.d.invoiceAmount) - num(g.d.laborCost) - num(g.d.vat) - cost) : null
        return { ...g, lines, profit }
      })
    const tot = (fn) => round2(groups.reduce((acc, g) => acc + g.sign * fn(g), 0))
    const totals = {
      tPrice: tot((g) => g.lines.reduce((x, l) => x + l.tPrice, 0)),
      disc: tot((g) => g.lines.reduce((x, l) => x + l.disc, 0)),
      payable: tot((g) => g.lines.reduce((x, l) => x + l.payable, 0)),
      vat: tot((g) => num(g.d.vat)), tDisc: tot((g) => num(g.d.discount)), net: tot((g) => num(g.d.invoiceAmount)),
      paid: tot((g) => num(g.d.paid)), due: tot((g) => num(g.d.due)), profit: tot((g) => num(g.profit)),
    }
    return { groups, totals }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, s])

  const contactOpts = [{ value: '', label: 'All' }, ...contacts.map((c) => ({ value: c.id, label: `${c.name}${c.phone ? ` - ${c.phone}` : ''}` }))]
  const row = (label, el) => (
    <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] items-center gap-2">
      <span className="sm:text-right text-[13px] font-medium text-gray-600">{label}</span>{el}
    </div>
  )
  const filterText = (v, list) => (v ? list.find((o) => o.value === v)?.label || v : 'ALL')
  const th = 'border border-gray-400 px-1.5 py-1 font-semibold bg-gray-100'
  const td = 'border border-gray-300 px-1.5 py-1'

  return (
    <>
      <PageHeader title={title} trail={['Reports', title]} />
      <Card className="print:hidden">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="grid sm:grid-cols-[150px_1fr_auto_1fr] items-center gap-2">
            <span className="sm:text-right text-[13px] font-medium text-gray-600">From Date</span>
            <Input type="date" value={f.from} onChange={(e) => set('from', e.target.value)} />
            <span className="text-[13px] font-medium text-gray-600 px-2">To</span>
            <Input type="date" value={f.to} onChange={(e) => set('to', e.target.value)} />
          </div>
          {row(sale ? 'Customer/Retailer' : 'Supplier', <Combo value={f.contactId} onChange={(v) => set('contactId', v)} placeholder="All" options={contactOpts} />)}
          {row(`${party} Company`, <Select value={f.company} onChange={(e) => set('company', e.target.value)} placeholder="All" options={uniq(contacts.map((c) => c.organization))} />)}
          {row(`${word} ID`, <Combo value={f.docId} onChange={(v) => set('docId', v)} placeholder="All" options={[{ value: '', label: 'All' }, ...docsAll.slice().reverse().map((d) => ({ value: d.id, label: `${d.number} | ${d.contactName}` }))]} />)}
          {row('Category Name', <Select value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="All" options={s.categories.map((c) => c.name)} />)}
          <div className="grid sm:grid-cols-[150px_1fr_auto_1fr] items-center gap-2">
            <span className="sm:text-right text-[13px] font-medium text-gray-600">Item Name</span>
            <Combo value={f.productId} onChange={(v) => set('productId', v)} placeholder="All" options={[{ value: '', label: 'All' }, ...s.products.map((p) => ({ value: p.id, label: p.name }))]} />
            <span className="text-[13px] font-medium text-gray-600 px-2">Code</span>
            <Combo value={f.code} onChange={(v) => set('code', v)} placeholder="All" options={[{ value: '', label: 'All' }, ...uniq(s.products.map((p) => p.code)).map((c) => ({ value: c, label: c }))]} />
          </div>
          {sale && row('Reference', <Select value={f.referenceId} onChange={(e) => set('referenceId', e.target.value)} placeholder="All" options={s.contacts.filter((c) => c.type === 'reference').map((c) => ({ value: c.id, label: c.name }))} />)}
          {row(`${word} By`, <Select value={f.by} onChange={(e) => set('by', e.target.value)} placeholder="All" options={uniq([...docsAll, ...s[retCol]].map((d) => d.createdBy))} />)}
          {row(`${word}/Return`, <Select value={f.kind} onChange={(e) => set('kind', e.target.value)} placeholder={`${word} and Return`} options={[{ value: 'S', label: `${word} only` }, { value: 'R', label: 'Return only' }]} />)}
          <div className="sm:pl-[158px] flex gap-2">
            <Button onClick={() => run(false)}><Search size={15} /> Show</Button>
            <Button color="success" onClick={() => run(true)}><Printer size={15} /> Print</Button>
            <Button color="secondary" onClick={() => { setF(blankF); setA(null) }}>Reset</Button>
          </div>
        </div>
      </Card>

      {report && (
        <Card>
          <div className="print-area text-[11px] text-gray-800">
            <PrintHead />
            <h3 className="text-center font-semibold text-[14px] bg-gray-100 py-1.5 mb-2">{title}</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse mb-2">
                <thead>
                  <tr>
                    <th className={th}>Date From</th><th className={th}>Item Category</th><th className={th}>{word} Type</th>
                    <th className={th}>{word} By</th><th className={th}>{word} ID</th><th className={th}>{party} Name</th>
                    {sale && <th className={th}>Reference</th>}
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-center">
                    <td className={td}>{displayDate(a.from) || '…'} To {displayDate(a.to) || '…'}</td>
                    <td className={td}>{a.category || 'ALL'}</td>
                    <td className={td}>{a.kind === 'S' ? word.toUpperCase() : a.kind === 'R' ? 'RETURN' : 'ALL'}</td>
                    <td className={td}>{a.by || 'ALL'}</td>
                    <td className={td}>{a.docId ? docsAll.find((d) => d.id === a.docId)?.number : 'ALL'}</td>
                    <td className={td}>{filterText(a.contactId, contactOpts)}</td>
                    {sale && <td className={td}>{a.referenceId ? name(a.referenceId) : 'ALL'}</td>}
                  </tr>
                </tbody>
              </table>
              <table className="w-full min-w-[1100px] border-collapse">
                <thead>
                  <tr>
                    {['SL', 'T/Date', `${word} ID`, 'Item Code', 'Name', 'U/M', 'Qty', 'Unit Price', 'T/Price', 'Discount', 'T/Payable', 'VAT', 'T/Discount', 'N/Payable', 'Paid',
                      sale ? 'Profit/Loss' : 'Due', `${party} Name`, 'Type'].map((h) => <th key={h} className={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {report.groups.map((g, gi) => g.lines.map((l, li) => {
                    const span = g.lines.length
                    const inv = (v, cls = 'text-right') => (li === 0 ? <td rowSpan={span} className={`${td} ${cls}`}>{v}</td> : null)
                    return (
                      <tr key={`${g.d.id}-${li}`} className={g.type === 'R' ? 'text-danger' : ''}>
                        {inv(gi + 1, 'text-center')}
                        {inv(g.d.date, 'text-center whitespace-nowrap')}
                        {inv(g.d.number, 'text-center')}
                        <td className={td}>{l.code}</td><td className={td}>{l.name}</td><td className={`${td} text-center`}>{l.um}</td>
                        <td className={`${td} text-right`}>{round2(l.qty)}</td><td className={`${td} text-right`}>{round2(l.rate)}</td>
                        <td className={`${td} text-right`}>{round2(l.tPrice)}</td><td className={`${td} text-right`}>{round2(l.disc)}</td>
                        <td className={`${td} text-right`}>{round2(l.payable)}</td>
                        {inv(round2(g.d.vat))}{inv(round2(g.d.discount))}{inv(round2(g.d.invoiceAmount))}{inv(round2(g.d.paid))}
                        {inv(sale ? (g.profit === null ? '' : round2(g.profit)) : round2(g.d.due))}
                        {inv(g.d.contactName, 'text-left')}
                        {inv(g.type, 'text-center')}
                      </tr>
                    )
                  }))}
                  {!report.groups.length && <tr><td colSpan={18} className={`${td} text-center text-gray-500 py-3`}>Nothing matches these filters.</td></tr>}
                </tbody>
                {report.groups.length > 0 && (
                  <tfoot className="font-semibold bg-gray-50">
                    <tr>
                      <td colSpan={8} className={`${td} text-right`}>Total{a.kind !== 'S' && ' (returns subtracted)'}</td>
                      <td className={`${td} text-right`}>{money(report.totals.tPrice)}</td><td className={`${td} text-right`}>{money(report.totals.disc)}</td>
                      <td className={`${td} text-right`}>{money(report.totals.payable)}</td><td className={`${td} text-right`}>{money(report.totals.vat)}</td>
                      <td className={`${td} text-right`}>{money(report.totals.tDisc)}</td><td className={`${td} text-right`}>{money(report.totals.net)}</td>
                      <td className={`${td} text-right`}>{money(report.totals.paid)}</td>
                      <td className={`${td} text-right`}>{money(sale ? report.totals.profit : report.totals.due)}</td>
                      <td colSpan={2} className={td} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <p className="mt-2 text-[10px] text-gray-500">
              Type: {sale ? 'S = Sale' : 'P = Purchase'}, R = Return (shown in red).{sale && ' Profit/Loss = N/Payable − labour cost − VAT − cost of the items at their current purchase price.'}
            </p>
          </div>
        </Card>
      )}
    </>
  )
}

// Sales Summary / Purchase Summary: one row per invoice with column totals.
// Clicking the invoice number opens the invoice.
export function SummaryReport({ collection, title }) {
  const s = useDb()
  const sale = collection === 'sales'
  const contacts = s.contacts.filter((c) => (sale ? ['customer', 'retailer'] : ['supplier']).includes(c.type))
  const [f, setF] = useState({ from: today(), to: today(), contactId: '' })
  const [a, setA] = useState(f)
  const [open, setOpen] = useState(null)
  const rows = s[collection]
    .filter((d) => inRange(d.date, a.from, a.to) && (!a.contactId || d.contactId === a.contactId))
    .slice().sort((x, y) => x.date.localeCompare(y.date) || String(x.number).localeCompare(String(y.number)))
    .map((d) => ({ ...d, gross: num(d.invoiceAmount) + num(d.discount) }))
  const L = sale
    ? { no: 'Invoice#', party: 'Customer', gross: 'Invoice Amount', net: 'Receivable', paid: 'Received' }
    : { no: 'Bill#', party: 'Supplier', gross: 'Bill Amount', net: 'Payable', paid: 'Paid' }
  const columns = [
    { key: 'sl', label: 'SL', render: (_, i) => i + 1, sortable: false },
    { key: 'number', label: L.no, render: (d) => <button className="text-primary hover:underline" onClick={() => setOpen(d)}>{d.number}</button> },
    { key: 'date', label: 'Date', render: (d) => displayDate(d.date) },
    { key: 'contactName', label: L.party },
    { key: 'gross', label: L.gross, align: 'right', render: (d) => money(d.gross) },
    { key: 'discount', label: 'Discount', align: 'right', render: (d) => money(d.discount) },
    { key: 'invoiceAmount', label: L.net, align: 'right', render: (d) => money(d.invoiceAmount) },
    { key: 'paid', label: L.paid, align: 'right', render: (d) => money(d.paid) },
    { key: 'due', label: 'Due', align: 'right', render: (d) => money(d.due) },
  ]
  const t = (k) => money(sum(rows, k))
  const cell = 'px-3 py-2 text-right'
  return (
    <ReportShell title={title} subtitle={`From ${displayDate(a.from) || '…'} To ${displayDate(a.to) || '…'}`} filters={(
      <>
        <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label={L.party}>
          <Combo className="w-64" value={f.contactId} onChange={(v) => setF({ ...f, contactId: v })} placeholder={`-- All ${L.party}s --`}
            options={[{ value: '', label: `-- All ${L.party}s --` }, ...contacts.map((c) => ({ value: c.id, label: c.name }))]} />
        </Field>
        <Button color="success" onClick={() => setA(f)}>Search</Button>
      </>
    )}>
      <DataTable columns={columns} rows={rows} pageSizes={[100, 250, 500]}
        footer={rows.length > 0 && (
          <tr className="border-t">
            <td colSpan={4} className={cell}>Total</td>
            <td className={cell}>{t('gross')}</td><td className={cell}>{t('discount')}</td><td className={cell}>{t('invoiceAmount')}</td>
            <td className={cell}>{t('paid')}</td><td className={cell}>{t('due')}</td>
          </tr>
        )} />
      <Modal open={!!open} onClose={() => setOpen(null)} title={open && `${sale ? 'Invoice' : 'Bill'} ${open.number}`} wide>
        {open && <InvoicePrint doc={open} />}
      </Modal>
    </ReportShell>
  )
}

export function AccountListReport({ collection, title }) {
  const s = useDb()
  const headType = collection === 'expenses' ? 'Expense' : 'Income'
  const [f, setF] = useState({ from: monthStart(), to: today(), head: '' })
  const [a, setA] = useState(f)
  const rows = s[collection].filter((d) => inRange(d.date, a.from, a.to) && (!a.head || d.head === a.head))
  const heads = uniq([...s.accountHeads.filter((h) => h.type === headType).map((h) => h.name), ...s[collection].map((d) => d.head)])
  const columns = [
    { key: 'sl', label: 'SL', render: (_, i) => i + 1, sortable: false },
    { key: 'date', label: 'Date', render: (r) => displayDate(r.date) }, { key: 'number', label: `${headType}#` },
    { key: 'method', label: 'Paid Through' }, { key: 'head', label: 'Account Head' }, { key: 'contact', label: 'Contact' },
    { key: 'note', label: 'Note' }, { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
  ]
  return (
    <ReportShell title={title} subtitle={`From ${displayDate(a.from) || '…'} To ${displayDate(a.to) || '…'}${a.head ? ` · ${a.head}` : ''}`} filters={(
      <>
        <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label="Account Head">
          <Combo className="w-60" value={f.head} onChange={(v) => setF({ ...f, head: v })} placeholder="---All---" options={[{ value: '', label: '---All---' }, ...heads.map((h) => ({ value: h, label: h }))]} />
        </Field>
        <Button color="success" onClick={() => setA(f)}><Search size={15} /> Search</Button>
      </>
    )}>
      <DataTable columns={columns} rows={rows} pageSizes={[100, 250, 500]}
        footer={<tr className="border-t"><td colSpan={7} className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right">{money(sum(rows, 'amount'))}</td></tr>} />
    </ReportShell>
  )
}

// Every money movement, in the wording of the printed books:
// { date, vid, particulars, verb, name, daily, method, in, out, note, entryBy, transfer? }
const MOVES = {
  sale: ['Sales of Items', 'Received from', 'Received From Product Sale'],
  purchase: ['Purchase of Items', 'Paid to', 'Paid For Product Purchase'],
  salesReturn: ['Sales Return of Items', 'Paid to', 'Paid For Return'],
  purchaseReturn: ['Purchase Return', 'Received from', 'Received For Purchase Return'],
  receive: ['Previous Due Collection', 'Received from', 'Previous Due Collection'],
  pay: ['Previous Due Paid', 'Paid to', 'Previous Due Paid'],
  customerAdvance: ['Return Customer Advance', 'Paid to', 'Customer Advance Returned'],
  supplierAdvance: ['Supplier Advance Return', 'Received from', 'Supplier Advance Returned'],
  expense: ['Expense', 'Against', 'Expense'],
  income: ['Income', 'Against', 'Income'],
  salary: ['Salary', 'Paid to', 'Salary Paid'],
}
function cashFlows(s) {
  const flows = []
  const add = (kind, m) => {
    const [particulars, verb, daily] = MOVES[kind] || ['Balance Transfer', '', '']
    flows.push({ particulars, verb, daily, vid: '', note: '', entryBy: '', in: 0, out: 0, ...m, method: m.method || 'Cash' })
  }
  const docPays = (docs, kind, dir) => docs.forEach((d) => (d.payments || []).forEach((p) => add(kind, {
    date: d.date, at: d.createdAt, vid: d.number, name: d.contactName, method: p.method, [dir]: num(p.amount), note: p.note || '', entryBy: d.createdBy,
  })))
  docPays(s.sales, 'sale', 'in')
  docPays(s.purchases, 'purchase', 'out')
  docPays(s.salesReturns, 'salesReturn', 'out')
  docPays(s.purchaseReturns, 'purchaseReturn', 'in')
  const rec = (r) => ({ date: r.date, at: r.createdAt, vid: r.number || '', method: r.method, note: r.note || '', entryBy: r.createdBy })
  s.payments.forEach((p) => add(p.type === 'receive' ? 'receive' : 'pay', { ...rec(p), name: p.contactName, [p.type === 'receive' ? 'in' : 'out']: num(p.amount) }))
  s.settlements.filter((x) => x.refund).forEach((x) => add(x.kind === 'supplier' ? 'supplierAdvance' : 'customerAdvance', { ...rec(x), name: x.contactName, [x.kind === 'supplier' ? 'in' : 'out']: num(x.amount) }))
  s.expenses.forEach((e) => add('expense', { ...rec(e), name: e.head, out: num(e.amount) }))
  s.incomes.forEach((e) => add('income', { ...rec(e), name: e.head, in: num(e.amount) }))
  s.paySlips.forEach((p) => add('salary', { ...rec(p), name: p.employeeName, out: num(p.amount) }))
  s.transfers.forEach((t) => {
    const base = { ...rec(t), transfer: true, desc: `From ${t.fromAcc} To ${t.toAcc}` }
    add('transfer', { ...base, method: t.fromAcc, out: num(t.amount) })
    add('transfer', { ...base, method: t.toAcc, in: num(t.amount) })
  })
  return flows
    .map((f, i) => ({ id: i, ...f }))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.at || '').localeCompare(String(b.at || '')))
}

const Desc = ({ f }) => (f.transfer ? <>{f.desc}</> : <>{f.verb} <b>{f.name}</b></>)
const n0 = (v) => Math.round(num(v)).toLocaleString('en-US')

// Shell for the printed books: query bar, then the A4 report
function BookShell({ title, filters, children }) {
  return (
    <>
      <PageHeader title={title} trail={['Reports', title]} />
      <Card>
        <div className="flex flex-wrap gap-3 items-end mb-4 print:hidden">
          {filters}
          <Button color="success" onClick={() => window.print()}><Printer size={15} /> Print</Button>
        </div>
        <div className="print-area text-[12px] text-gray-800">
          <PrintHead />
          <h3 className="text-center font-semibold text-[16px] border-y py-2 mb-3">{title}</h3>
          <div className="overflow-x-auto">{children}</div>
        </div>
      </Card>
    </>
  )
}
const bth = 'border border-gray-500 px-2 py-1 font-semibold'
const btd = 'border border-gray-400 px-2 py-1 align-top'

function RangeBox({ from, to }) {
  return (
    <table className="w-full border-collapse mb-2">
      <tbody>
        <tr><td className={`${bth} text-center`}>Date From</td></tr>
        <tr><td className={`${btd} text-center`}>{from || '…'} <b>To</b> {to || '…'}</td></tr>
      </tbody>
    </table>
  )
}

function useRangeFilter(initial) {
  const [f, setF] = useState(initial)
  const [a, setA] = useState(initial)
  const filters = (
    <>
      <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
      <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
      <Button onClick={() => setA(f)}><Search size={15} /> Search</Button>
    </>
  )
  return [a, filters]
}

const BOOK_HEAD = ['SL', 'DATE', 'V.ID', 'PARTICULARS', 'DESCRIPTION', 'DEBIT', 'CREDIT', 'BALANCE', 'ENTRY BY']

// One account's rows: opening balance, entries (credit = money in, debit = money out), total
function BookRows({ flows, from, to, totalLabel = 'TOTAL', title }) {
  const opening = flows.filter((x) => from && x.date < from).reduce((acc, x) => acc + x.in - x.out, 0)
  const rows = flows.filter((x) => inRange(x.date, from, to))
  let bal = opening
  const out = rows.reduce((acc, x) => acc + x.out, 0)
  const inn = rows.reduce((acc, x) => acc + x.in, 0)
  return {
    closing: opening + inn - out,
    body: (
      <>
        {title && <tr><td colSpan={7} className={`${btd} font-bold`}>{title}</td><td className={btd} /><td className={btd} /></tr>}
        <tr><td colSpan={7} className={`${btd} text-right font-semibold`}>Opening Balance</td><td className={`${btd} text-right font-semibold`}>{n0(opening)}</td><td className={btd} /></tr>
        {rows.map((x, i) => {
          bal += x.in - x.out
          return (
            <tr key={x.id}>
              <td className={btd}>{i + 1}</td><td className={`${btd} whitespace-nowrap`}>{displayDate(x.date)}</td><td className={`${btd} whitespace-nowrap`}>{x.vid}</td>
              <td className={`${btd} text-center font-semibold`}>{x.particulars}{x.note && <div className="font-normal text-gray-600">{x.note}</div>}</td>
              <td className={btd}><Desc f={x} /></td>
              <td className={`${btd} text-right`}>{n0(x.out)}</td><td className={`${btd} text-right`}>{n0(x.in)}</td>
              <td className={`${btd} text-right`}>{n0(bal)}</td><td className={btd}>{x.entryBy}</td>
            </tr>
          )
        })}
        <tr className="font-bold">
          <td colSpan={5} className={`${btd} text-right`}>{totalLabel}</td>
          <td className={`${btd} text-right`}>{n0(out)}</td><td className={`${btd} text-right`}>{n0(inn)}</td>
          <td className={`${btd} text-right`}>{n0(opening + inn - out)}</td><td className={btd} />
        </tr>
      </>
    ),
  }
}

export function BookReport({ bank }) {
  const s = useDb()
  const [a, filters] = useRangeFilter({ from: monthStart(), to: today() })
  const all = cashFlows(s)
  const title = bank ? 'Bank Book' : 'Cash Book'
  let body
  if (!bank) {
    body = BookRows({ flows: all.filter((x) => x.method === 'Cash'), from: a.from, to: a.to }).body
  } else {
    const accounts = [...new Set([...PAYMENT_METHODS.filter((m) => m !== 'Cash'), ...all.map((x) => x.method).filter((m) => m !== 'Cash')])]
    const parts = accounts.map((acc) => ({ acc, ...BookRows({ flows: all.filter((x) => x.method === acc), from: a.from, to: a.to, title: `${SHOP.name} (${acc.toUpperCase()})`, totalLabel: 'SUB TOTAL' }) }))
    body = (
      <>
        {parts.map((p) => <Fragment key={p.acc}>{p.body}</Fragment>)}
        <tr className="font-bold">
          <td colSpan={7} className={`${btd} text-right`}>GRAND TOTAL</td>
          <td className={`${btd} text-right`}>{n0(parts.reduce((acc, p) => acc + p.closing, 0))}</td><td className={btd} />
        </tr>
      </>
    )
  }
  return (
    <BookShell title={title} filters={filters}>
      <RangeBox from={a.from} to={a.to} />
      <table className="w-full min-w-[900px] border-collapse">
        <thead><tr>{BOOK_HEAD.map((h) => <th key={h} className={`${bth} text-center`}>{h}</th>)}</tr></thead>
        <tbody>{body}</tbody>
      </table>
      <p className="text-[10px] text-gray-500 mt-2">Credit = money in, Debit = money out.{bank && ' Each payment method other than Cash is shown as its own account.'}</p>
    </BookShell>
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

// Daily Report: everything received and everything paid on one day, side by side
export function DailyReport() {
  const s = useDb()
  const [date, setDate] = useState(today())
  const day = cashFlows(s).filter((x) => x.date === date && !x.transfer)
  const ins = day.filter((x) => x.in > 0)
  const outs = day.filter((x) => x.out > 0)
  const len = Math.max(ins.length, outs.length, 1)
  const side = (x, i, field) => (x
    ? <>
      <td className={`${btd} text-center`}>{i + 1}</td>
      <td className={btd}>{x.name} <b>{x.daily}</b>{x.vid && <span className="text-gray-500"> ({x.vid})</span>}{x.method !== 'Cash' && <span className="text-gray-500"> · {x.method}</span>}</td>
      <td className={btd}>{x.note}</td>
      <td className={`${btd} text-right text-[13px]`}>{n0(x[field])}</td>
    </>
    : <><td className={`${btd} text-center`}>{i + 1}</td><td className={btd} /><td className={btd} /><td className={btd} /></>)
  const tIn = sum(ins, 'in')
  const tOut = sum(outs, 'out')
  return (
    <BookShell title="Daily Report" filters={<Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>}>
      <table className="w-full border-collapse mb-2"><tbody><tr><td className={`${bth} text-center text-[14px]`}>Date : {displayDate(date)}</td></tr></tbody></table>
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr><th colSpan={4} className={`${bth} text-[15px]`}>Income/Receive</th><th colSpan={4} className={`${bth} text-[15px]`}>Expense/Paid</th></tr>
          <tr>{['SL', 'Description', 'Note', 'Total', 'SL', 'Description', 'Note', 'Total'].map((h, i) => <th key={i} className={`${bth} ${h === 'Description' ? 'w-[24%]' : ''}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: len }, (_, i) => <tr key={i}>{side(ins[i], i, 'in')}{side(outs[i], i, 'out')}</tr>)}
          <tr className="font-bold text-[14px]">
            <td colSpan={3} className={`${btd} text-right`}>Total</td><td className={`${btd} text-right`}>{n0(tIn)}</td>
            <td colSpan={3} className={`${btd} text-right`}>Total</td><td className={`${btd} text-right`}>{n0(tOut)}</td>
          </tr>
          <tr className="font-semibold">
            <td colSpan={7} className={`${btd} text-right`}>Net (Receive − Paid)</td><td className={`${btd} text-right`}>{n0(tIn - tOut)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-[10px] text-gray-500 mt-2">All payment methods are included. Balance transfers between accounts are left out.</p>
    </BookShell>
  )
}

// ---------- Ledgers ----------
// Search by name / phone / address and filter by dues; Action opens the ledger.
export function LedgerReport({ supplier }) {
  const s = useDb()
  const [view, setView] = useState(null)
  const types = supplier ? ['supplier'] : ['customer', 'retailer']
  const word = supplier ? 'Supplier' : 'Customer'
  const all = s.contacts.filter((c) => types.includes(c.type)).map((c) => ({ ...c, balance: contactBalance(c, s) }))
  const [f, setF] = useState({ contactId: '', q: '', dues: 'due' })
  const [a, setA] = useState(f)
  const q = a.q.trim().toLowerCase()
  const rows = all
    .filter((c) => !a.contactId || c.id === a.contactId)
    .filter((c) => !q || [c.name, c.phone, c.altPhone, c.address, c.organization, c.code].some((x) => String(x ?? '').toLowerCase().includes(q)))
    .filter((c) => ({ all: true, due: c.balance > 0.005, none: Math.abs(c.balance) <= 0.005, advance: c.balance < -0.005 }[a.dues]))
    .sort((x, y) => x.name.localeCompare(y.name))
  const columns = [
    { key: 'sl', label: 'Serial', render: (_, i) => i + 1, sortable: false },
    { key: 'name', label: word }, { key: 'address', label: 'Address' }, { key: 'phone', label: 'Phone' },
    { key: 'balance', label: 'Balance', align: 'right', render: (r) => <span className={r.balance > 0 ? 'text-danger font-medium' : r.balance < 0 ? 'text-success' : ''}>{money(r.balance)}</span> },
    { key: 'action', label: 'Action', render: (r) => <Button color="info" className="!py-1" onClick={() => setView(r)}>Ledger</Button> },
  ]
  const duesLabel = { all: 'All', due: 'Dues Available', none: 'No Dues', advance: 'Advance' }
  return (
    <ReportShell title={`${word} Ledger`} subtitle={`${duesLabel[a.dues]}${a.q ? ` · "${a.q}"` : ''}`} filters={(
      <>
        <Field label={word}>
          <Combo className="w-60" value={f.contactId} onChange={(v) => setF({ ...f, contactId: v })} placeholder={`--All ${word}s--`}
            options={[{ value: '', label: `--All ${word}s--` }, ...all.map((c) => ({ value: c.id, label: `${c.name}${c.phone ? ` - ${c.phone}` : ''}` }))]} />
        </Field>
        <Field label="Name / Number / Address"><Input className="!w-56" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && setA(f)} /></Field>
        <Field label="Dues">
          <Select className="!w-40" value={f.dues} onChange={(e) => setF({ ...f, dues: e.target.value })} options={Object.entries(duesLabel).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Button color="success" onClick={() => setA(f)}><Search size={15} /> Search</Button>
      </>
    )}>
      <DataTable columns={columns} rows={rows} pageSizes={[100, 250, 500]}
        footer={rows.length > 0 && <tr className="border-t"><td colSpan={4} className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right">{money(sum(rows, 'balance'))}</td><td /></tr>} />
      <Modal open={!!view} onClose={() => setView(null)} title={`Ledger - ${view?.name}`} wide="xl">
        {view && <ContactLedger contact={view} />}
      </Modal>
    </ReportShell>
  )
}

// Customer / Supplier Ledger Details: every transaction with its item lines.
// Debit raises the balance (what they owe the shop, or what the shop owes a
// supplier); credit lowers it. The closing balance matches the ledger list.
function ledgerEntries(contact, s) {
  const sup = contact.type === 'supplier'
  const mine = (x) => x.contactId === contact.id
  const through = (d) => [...new Set((d.payments || []).map((p) => p.method))].join(', ')
  const e = []
  const push = (x) => e.push({ note: '', trans: '', through: '', items: null, disc: 0, ship: 0, debit: 0, credit: 0, ...x })
  ;(sup ? s.purchases : s.sales).filter(mine).forEach((d) => {
    push({ date: d.date, at: d.createdAt, details: sup ? 'Purchase of Items' : 'Sales of Items', trans: d.number, note: d.note, items: d.items, disc: num(d.discount), ship: num(d.laborCost), debit: num(d.invoiceAmount) })
    const paid = num(d.invoiceAmount) - num(d.due)
    if (paid) push({ date: d.date, at: d.createdAt, details: sup ? 'Payment Paid' : 'Payment Received', trans: d.number, through: through(d), credit: paid })
  })
  ;(sup ? s.purchaseReturns : s.salesReturns).filter(mine).forEach((d) => {
    push({ date: d.date, at: d.createdAt, details: d.sourceId ? `${sup ? 'Purchase' : 'Sales'} Return${d.sourceNumber ? ` (${d.sourceNumber})` : ''}` : 'Direct Return', trans: d.number, note: d.note, items: d.items, disc: num(d.less ?? d.discount), credit: num(d.invoiceAmount) })
    if (num(d.paid)) push({ date: d.date, at: d.createdAt, details: sup ? 'Return Money Received' : 'Return Money Paid', trans: d.number, through: through(d), debit: num(d.paid) })
  })
  s.payments.filter((p) => mine(p) && p.type === (sup ? 'pay' : 'receive')).forEach((p) => {
    push({ date: p.date, at: p.createdAt, details: sup ? 'Previous Due Paid' : 'Previous Due Collection', trans: p.number, note: p.note, through: p.method, credit: num(p.amount) })
    if (num(p.discount)) push({ date: p.date, at: p.createdAt, details: 'Discount', trans: p.number, credit: num(p.discount) })
  })
  s.settlements.filter(mine).forEach((x) => push(x.refund
    ? { date: x.date, at: x.createdAt, details: sup ? 'Advance Received Back' : 'Advance Returned', trans: x.number, note: x.note, through: x.method, debit: num(x.amount) }
    : { date: x.date, at: x.createdAt, details: 'Settlement', trans: x.number, note: x.note, credit: num(x.amount) }))
  return e.sort((a, b) => a.date.localeCompare(b.date) || String(a.at || '').localeCompare(String(b.at || '')))
}

function ContactLedger({ contact }) {
  const s = useDb()
  const sup = contact.type === 'supplier'
  const word = sup ? 'Supplier' : 'Customer'
  const [f, setF] = useState({ from: '', to: today() })
  const [a, setA] = useState(f)
  const all = useMemo(() => ledgerEntries(contact, s), [contact, s])
  const openingAmt = num(contact.openingBalance)
  const before = all.filter((x) => a.from && x.date < a.from).reduce((acc, x) => acc + x.debit - x.credit, 0)
  const rows = all.filter((x) => inRange(x.date, a.from, a.to))
  // the contact's opening balance is its own first line when the range starts at the beginning
  const showOpeningLine = !a.from && openingAmt !== 0
  let bal = a.from ? openingAmt + before : 0
  const startBal = bal
  const cell = 'border border-gray-400 px-1.5 py-1 align-top'
  const head = 'border border-gray-500 px-1.5 py-1 font-semibold'
  const plain = (x) => (
    <>
      <td className={cell} colSpan={5} />
      <td className={`${cell} text-center`}>{x.disc ? n0(x.disc) : ''}</td>
      <td className={`${cell} text-center`}>{x.ship ? n0(x.ship) : ''}</td>
    </>
  )
  const line = (x, key) => {
    bal += x.debit - x.credit
    const items = x.items?.length ? x.items : null
    const span = items ? items.length : 1
    const first = items?.[0]
    const itemCells = (it) => {
      const tp = num(it.qty) * num(it.rate)
      return (
        <>
          <td className={cell}>{[it.code, it.name].filter(Boolean).join(' - ')}</td>
          <td className={`${cell} text-right`}>{round2(it.qty)}</td>
          <td className={`${cell} text-right`}>{round2(it.rate)}</td>
          <td className={`${cell} text-right`}>{round2(num(it.total))}</td>
          <td className={`${cell} text-right`}>{round2(tp - num(it.total))}</td>
        </>
      )
    }
    const rs = (content, cls = '') => <td rowSpan={span} className={`${cell} ${cls}`}>{content}</td>
    return [
      <tr key={key}>
        {rs(displayDate(x.date), 'whitespace-nowrap')}
        {rs(x.details, 'text-center')}
        {rs(x.trans, 'text-center whitespace-nowrap')}
        {rs(x.note)}
        {items ? <>{itemCells(first)}{rs(n0(x.disc), 'text-center')}{rs(x.ship ? n0(x.ship) : '', 'text-center')}</> : plain(x)}
        {rs(x.through, 'text-center')}
        {rs(n0(x.debit), 'text-right')}
        {rs(n0(x.credit), 'text-right')}
        {rs(n0(bal), 'text-right')}
      </tr>,
      ...(items ? items.slice(1).map((it, i) => <tr key={`${key}-${i}`}>{itemCells(it)}</tr>) : []),
    ]
  }
  return (
    <div>
      <div className="flex flex-wrap gap-3 items-end mb-4 print:hidden">
        <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Button onClick={() => setA(f)}><Search size={15} /> Search</Button>
        <Button color="success" onClick={() => window.print()}><Printer size={15} /> Print</Button>
      </div>
      <div className="print-area text-[11px] text-gray-800">
        <PrintHead />
        <h3 className="text-center font-semibold text-[15px] border-y py-2 mb-3">{word} Ledger Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse mb-2">
            <thead><tr><th className={head}>Date From</th><th className={head}>{word} Name</th><th className={head}>{word} Phone</th></tr></thead>
            <tbody><tr className="text-center">
              <td className={cell}>{displayDate(a.from) || 'Beginning'} <b>To</b> {displayDate(a.to) || 'Today'}</td>
              <td className={cell}>{contact.name}</td><td className={cell}>{contact.phone}</td>
            </tr></tbody>
          </table>
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr>
                {['Date', 'Details', 'Trans#', 'Note'].map((h) => <th key={h} rowSpan={2} className={head}>{h}</th>)}
                <th colSpan={5} className={head}>Description</th>
                {['Total Amount Dis.', 'Ship/Cost', 'Paid Through', 'Debit', 'Credit', 'Balance'].map((h) => <th key={h} rowSpan={2} className={head}>{h}</th>)}
              </tr>
              <tr>{['Item Name', 'Qty.', 'U/Price', 'T/Price', 'Dis.'].map((h) => <th key={h} className={head}>{h}</th>)}</tr>
            </thead>
            <tbody>
              <tr><td colSpan={14} className={`${cell} text-right font-semibold`}>Opening Balance</td><td className={`${cell} text-right font-semibold`}>{n0(startBal)}</td></tr>
              {showOpeningLine && line({ date: '', details: 'Opening Balance', trans: '', note: `${word} Opening Balance`, through: '', disc: 0, ship: 0, debit: openingAmt > 0 ? openingAmt : 0, credit: openingAmt < 0 ? -openingAmt : 0 }, 'opening')}
              {rows.flatMap((x, i) => line(x, i))}
              {!rows.length && !showOpeningLine && <tr><td colSpan={15} className={`${cell} text-center text-gray-500 py-3`}>No transactions in this period.</td></tr>}
              <tr className="font-bold"><td colSpan={14} className={`${cell} text-right`}>TOTAL</td><td className={`${cell} text-right`}>{n0(bal)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
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
