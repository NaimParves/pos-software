import { useMemo, useState } from 'react'
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
  s.payments.forEach((p) => flows.push({ date: p.date, desc: `${p.type === 'receive' ? 'Received from' : 'Paid to'} ${p.contactName}`, method: p.method, [p.type === 'receive' ? 'in' : 'out']: Number(p.amount) }))
  // advance paid back: to a customer (out) or by a supplier (in)
  s.settlements.filter((x) => x.refund).forEach((x) => flows.push({ date: x.date, desc: `Settlement ${x.number || ''} - ${x.contactName}`, method: x.method || 'Cash', [x.kind === 'supplier' ? 'in' : 'out']: Number(x.amount) }))
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
    ;(sup ? s.purchaseReturns : s.salesReturns).filter((d) => d.contactId === contact.id).forEach((d) => {
      e.push({ date: d.date, desc: `Return ${d.number}`, debit: 0, credit: d.invoiceAmount })
      if (d.paid) e.push({ date: d.date, desc: `Return paid on ${d.number}`, debit: d.paid, credit: 0 })
    })
    s.payments.filter((p) => p.contactId === contact.id).forEach((p) => {
      e.push({ date: p.date, desc: `Payment ${p.number || ''}`, debit: 0, credit: Number(p.amount) })
      if (Number(p.discount)) e.push({ date: p.date, desc: `Discount on ${p.number || 'payment'}`, debit: 0, credit: Number(p.discount) })
    })
    s.settlements.filter((p) => p.contactId === contact.id).forEach((p) => e.push(p.refund
      ? { date: p.date, desc: `Advance settled ${p.number || ''}`, debit: Number(p.amount), credit: 0 }
      : { date: p.date, desc: 'Settlement (write-off)', debit: 0, credit: Number(p.amount) }))
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
