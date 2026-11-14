import { useMemo, useState } from 'react'
import { Printer, Save, Search, Trash2 } from 'lucide-react'
import { PageHeader, Card, Field, Input, Select, Button, Badge } from '../components/ui'
import Combo from '../components/Combo'
import DataTable from '../components/DataTable'
import { toast } from '../components/Toast'
import { stockText } from './Damages'
import { db, useCollection, useDb } from '../store/db'
import { useCan } from '../store/permissions'
import { useShop } from '../store/shop'
import { displayDate, inRange, money, num, round2, sftPerPiece, today } from '../utils/format'

const units = (p) => ({ per: num(p?.pcsPerCart) || 1, sft: p?.kind === 'Tiles' ? sftPerPiece(p.size) : 0 })

// ---------- Product Stock In/Out ----------
// Brings the software's stock in line with the physical stock. Stock In adds,
// Stock Out removes; deleting an entry reverses it.
export function StockInOut() {
  const s = useDb()
  const allow = useCan()
  const blank = { date: today(), productId: '', direction: 'in', cart: '', pcs: '', qty: '', note: '' }
  const [f, setF] = useState(blank)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const p = s.products.find((x) => x.id === f.productId)
  const set = (k, v) => setF((x) => {
    const next = { ...x, [k]: v }
    const { per, sft } = units(p)
    if (k === 'cart' || k === 'pcs') {
      const pieces = num(next.cart) * per + num(next.pcs)
      next.qty = pieces ? (sft ? round2(pieces * sft) : pieces) : ''
    }
    if (k === 'productId') Object.assign(next, { cart: '', pcs: '', qty: '' })
    return next
  })
  const save = async () => {
    if (!p) { setError('Select a product.'); return }
    if (!(num(f.qty) > 0)) { setError('Enter the quantity (PCS, Cartoon or SFT/Qty).'); return }
    if (f.direction === 'out' && num(f.qty) > num(p.stock) && !confirm(`Stock is only ${round2(p.stock)}. Take out ${f.qty} anyway?`)) return
    setSaving(true); setError('')
    const rate = num(p.purchasePrice)
    const doc = await db.saveDocument('stockAdjustments', {
      date: f.date, direction: f.direction, note: f.note, contactName: f.direction === 'in' ? 'Stock In' : 'Stock Out',
      items: [{ productId: p.id, name: p.name, code: p.code, size: p.size, grade: p.grade, kind: p.kind, cart: f.cart, pcs: f.pcs, qty: num(f.qty), rate, total: round2(num(f.qty) * rate) }],
      invoiceAmount: round2(num(f.qty) * rate), paid: 0, due: 0, noPayments: true,
    })
    setSaving(false)
    if (!doc) return
    toast.success(`${doc.number}: ${f.direction === 'in' ? 'added' : 'removed'} ${f.qty} of ${p.name}. Stock is now ${round2(s.products.find((x) => x.id === p.id)?.stock ?? 0)}.`)
    setF({ ...blank, date: f.date })
  }
  const rows = s.stockAdjustments.slice().reverse().map((d) => ({ ...d, product: d.items[0]?.name || '', qty: d.items[0]?.qty || 0 }))
  const columns = [
    { key: 'sl', label: 'SL', render: (_, i) => i + 1, sortable: false },
    { key: 'date', label: 'Date', render: (d) => displayDate(d.date) },
    { key: 'number', label: 'Entry#' },
    { key: 'product', label: 'Product' },
    { key: 'direction', label: 'Status', render: (d) => (d.direction === 'out' ? <Badge color="danger">Stock Out</Badge> : <Badge>Stock In</Badge>) },
    { key: 'qty', label: 'Qty', align: 'right', render: (d) => round2(d.qty) },
    { key: 'note', label: 'Note' },
    { key: 'createdBy', label: 'Entry By' },
    ...(allow.delete ? [{
      key: 'action', label: 'Action', render: (d) => (
        <Button color="danger" className="!px-2 !py-1" title="Delete (reverses the stock change)" onClick={() => confirm(`Delete ${d.number}? The stock change is reversed.`) && db.removeDocument('stockAdjustments', d.id)}><Trash2 size={13} /></Button>
      ),
    }] : []),
  ]
  return (
    <>
      <PageHeader title="Product Stock In Out" trail={['Others', 'Product Stock In Out']} />
      <Card>
        <div className="grid sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4">
          <Field label="Product Name *">
            <Combo value={f.productId} onChange={(v) => set('productId', v)} placeholder="-- Select Product --"
              options={s.products.map((x) => ({ value: x.id, label: `${x.code} - ${x.name}${x.size ? ` (${x.size})` : ''}` }))} />
            {p && <span className="block text-[11px] text-gray-600 mt-1">{stockText(p)}</span>}
          </Field>
          <Field label="Status"><Select value={f.direction} onChange={(e) => set('direction', e.target.value)} options={[{ value: 'in', label: 'Stock In' }, { value: 'out', label: 'Stock Out' }]} /></Field>
          <Field label="Cartoon"><Input type="number" min="0" placeholder="Cartoon" value={f.cart} onChange={(e) => set('cart', e.target.value)} /></Field>
          <Field label="PCS"><Input type="number" min="0" placeholder="PCS" value={f.pcs} onChange={(e) => set('pcs', e.target.value)} /></Field>
          <Field label={`Qty${p ? ` (${p.kind === 'Tiles' ? 'SFT' : 'PCS'})` : ''} *`}><Input type="number" min="0" placeholder="Product Qty" value={f.qty} onChange={(e) => set('qty', e.target.value)} /></Field>
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="Note" className="sm:col-span-2 lg:col-span-4"><Input placeholder="Why the stock changes (e.g. physical count)" value={f.note} onChange={(e) => set('note', e.target.value)} /></Field>
        </div>
        {error && <p className="text-danger text-[13px] mt-3">{error}</p>}
        <div className="flex gap-1 mt-4">
          <Button onClick={save} disabled={saving}>Save</Button>
          <Button color="secondary" onClick={() => { setF(blank); setError('') }}>Close</Button>
        </div>
      </Card>
      <Card title="Stock In/Out List"><DataTable columns={columns} rows={rows} /></Card>
    </>
  )
}

// ---------- Product Ledger (MIS) ----------
// Every stock movement of one product: purchases, sales, returns, damages and
// manual stock in/out, with a running balance that ends at the product's stock.
const MOVES = [
  ['purchases', 'Purchase', 1],
  ['sales', 'Sale', -1],
  ['salesReturns', (d) => (d.sourceId ? 'Sales Return' : 'Direct Return'), 1],
  ['purchaseReturns', 'Purchase Return', -1],
  ['damages', 'Damage', -1],
  ['stockAdjustments', (d) => (d.direction === 'out' ? 'Manual Stock Out' : 'Manual Stock In'), (d) => (d.direction === 'out' ? -1 : 1)],
]

export function productMovements(s, productId) {
  const out = []
  for (const [col, label, sign] of MOVES) {
    for (const d of s[col] || []) {
      d.items.forEach((it, i) => {
        if (it.productId !== productId) return
        const dir = typeof sign === 'function' ? sign(d) : sign
        out.push({
          id: `${col}-${d.id}-${i}`, date: d.date, at: d.createdAt, desc: typeof label === 'function' ? label(d) : label,
          ref: d.number, party: d.contactName || d.note || '', in: dir > 0 ? num(it.qty) : 0, out: dir < 0 ? num(it.qty) : 0, rate: num(it.rate),
        })
      })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || String(a.at || '').localeCompare(String(b.at || '')))
}

export function ProductLedger() {
  const s = useDb()
  const shop = useShop()
  const [f, setF] = useState({ productId: '', from: today().slice(0, 8) + '01', to: today() })
  const [a, setA] = useState(null)
  const p = a && s.products.find((x) => x.id === a.productId)
  const data = useMemo(() => {
    if (!p) return null
    const moves = productMovements(s, p.id)
    const net = moves.reduce((x, m) => x + m.in - m.out, 0)
    const base = round2(num(p.stock) - net) // opening stock (entered stock not explained by any document)
    const opening = round2(base + moves.filter((m) => a.from && m.date < a.from).reduce((x, m) => x + m.in - m.out, 0))
    let bal = opening
    const rows = moves.filter((m) => inRange(m.date, a.from, a.to)).map((m) => ({ ...m, balance: (bal = round2(bal + m.in - m.out)) }))
    return { opening, rows, closing: bal, tin: round2(rows.reduce((x, r) => x + r.in, 0)), tout: round2(rows.reduce((x, r) => x + r.out, 0)) }
  }, [s, p, a])
  const unit = p?.kind === 'Tiles' ? 'SFT' : 'PCS'
  const cell = 'border border-gray-300 px-2 py-1.5'
  const head = `${cell} font-semibold text-white`
  return (
    <>
      <PageHeader title="Product Ledger" trail={['Reports', 'Product Ledger']} />
      <Card className="print:hidden">
        <div className="flex flex-wrap justify-center gap-3 items-end">
          <Field label="From Date"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="To Date"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          <Field label="Product (code or name)">
            <Combo className="w-80" value={f.productId} onChange={(v) => setF({ ...f, productId: v })} placeholder="Select Product"
              options={s.products.map((x) => ({ value: x.id, label: `${x.code} - ${x.name}${x.size ? ` (${x.size})` : ''}` }))} />
          </Field>
          <Button disabled={!f.productId} onClick={() => setA(f)}><Search size={15} /> Search</Button>
          {data && <Button color="success" onClick={() => window.print()}><Printer size={15} /> Print</Button>}
        </div>
      </Card>
      {data && (
        <Card>
          <div className="print-area text-[12px] text-gray-800">
            <div className="text-center mb-3">
              <p className="font-semibold text-[15px]">{shop.name}</p>
              <p className="text-[11px]">{shop.address} · {shop.phone}</p>
              <h3 className="font-semibold text-[15px] mt-1">Product Ledger</h3>
            </div>
            <div className="flex flex-wrap justify-between gap-2 mb-2">
              <div>
                <p><b>Product Name :</b> {p.code} - {p.name}{p.size ? ` (${p.size})` : ''}</p>
                <p><b>Opening Stock :</b> {data.opening} {unit}</p>
              </div>
              <div className="text-right">
                <p><b>Period :</b> {displayDate(a.from) || 'Beginning'} to {displayDate(a.to) || 'Today'}</p>
                <p><b>Purchase Price :</b> {money(p.purchasePrice)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="bg-success">{['Date', 'Description', 'Ref#', 'Party / Note', `In (${unit})`, `Out (${unit})`, `Balance (${unit})`, 'Rate', 'Value'].map((h) => <th key={h} className={head}>{h}</th>)}</tr>
                </thead>
                <tbody className="text-center">
                  <tr className="bg-gray-50"><td className={cell} /><td className={cell}>Opening Stock</td><td className={cell} /><td className={cell} /><td className={cell}>0</td><td className={cell}>0</td><td className={`${cell} font-semibold`}>{data.opening}</td><td className={cell} /><td className={cell}>{money(data.opening * num(p.purchasePrice))}</td></tr>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <td className={cell}>{displayDate(r.date)}</td><td className={cell}>{r.desc}</td><td className={cell}>{r.ref}</td><td className={`${cell} text-left`}>{r.party}</td>
                      <td className={cell}>{round2(r.in)}</td><td className={cell}>{round2(r.out)}</td><td className={`${cell} font-semibold ${r.balance < 0 ? 'text-danger' : ''}`}>{r.balance}</td>
                      <td className={cell}>{round2(r.rate)}</td><td className={cell}>{money((r.in || r.out) * r.rate)}</td>
                    </tr>
                  ))}
                  {!data.rows.length && <tr><td colSpan={9} className={`${cell} text-gray-500 py-3`}>No stock movement in this period.</td></tr>}
                </tbody>
                <tfoot className="font-semibold bg-gray-50 text-center">
                  <tr>
                    <td colSpan={4} className={`${cell} text-right`}>Closing Balance</td>
                    <td className={cell}>{data.tin}</td><td className={cell}>{data.tout}</td><td className={cell}>{data.closing}</td>
                    <td className={cell}>{money(p.purchasePrice)}</td><td className={cell}>{money(data.closing * num(p.purchasePrice))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {(!a.to || a.to >= today()) && Math.abs(data.closing - num(p.stock)) < 0.01 && (
              <p className="text-[10px] text-gray-500 mt-2">The closing balance matches the product&apos;s current stock ({round2(p.stock)} {unit}) on Stock Status.</p>
            )}
          </div>
        </Card>
      )}
    </>
  )
}

// ---------- Bulk Product Update ----------
// Edit many products in one grid and save every changed row at once.
const EDITABLE = ['code', 'name', 'category', 'brand', 'size', 'pcsPerCart', 'purchasePrice', 'sellPrice', 'alertQty', 'status']
export function BulkProductUpdate() {
  const s = useDb()
  const allow = useCan('/products')
  const [f, setF] = useState({ brand: '', category: '', kind: '' })
  const [a, setA] = useState(f)
  const [edits, setEdits] = useState({})
  const [saving, setSaving] = useState(false)
  const list = s.products
    .filter((p) => (!a.brand || p.brand === a.brand) && (!a.category || p.category === a.category) && (!a.kind || p.kind === a.kind))
  const val = (p, k) => (edits[p.id]?.[k] ?? p[k] ?? '')
  const change = (p, k, v) => setEdits((e) => ({ ...e, [p.id]: { ...e[p.id], [k]: v } }))
  const changed = Object.entries(edits).filter(([id, e]) => {
    const p = s.products.find((x) => x.id === id)
    return p && EDITABLE.some((k) => k in e && String(e[k]) !== String(p[k] ?? ''))
  })
  const saveAll = async () => {
    if (!allow.edit) { toast.error('Your role is not allowed to edit products.'); return }
    const bad = changed.find(([, e]) => ('name' in e && !String(e.name).trim()) || ('code' in e && !String(e.code).trim()))
    if (bad) { toast.error('Product code and name cannot be empty.'); return }
    setSaving(true)
    const numKeys = ['pcsPerCart', 'purchasePrice', 'sellPrice', 'alertQty']
    const results = await Promise.all(changed.map(([id, e]) => db.update('products', id, Object.fromEntries(Object.entries(e).map(([k, v]) => [k, numKeys.includes(k) ? num(v) : v])))))
    setSaving(false)
    const ok = results.filter(Boolean).length
    if (ok) toast.success(`${ok} product(s) updated.`)
    setEdits({})
  }
  const names = (col) => s[col].map((x) => x.name)
  const inp = 'w-full border border-gray-300 rounded px-2 py-1 text-[13px] focus:outline-none focus:border-primary'
  const sel = (p, k, options) => (
    <select className={inp} value={val(p, k)} onChange={(e) => change(p, k, e.target.value)}>
      <option value="">—</option>{[...new Set([...options, val(p, k)].filter(Boolean))].map((o) => <option key={o}>{o}</option>)}
    </select>
  )
  const txt = (p, k, type = 'text') => <input type={type} className={`${inp} ${edits[p.id] && k in edits[p.id] && String(edits[p.id][k]) !== String(p[k] ?? '') ? '!border-warning bg-warning/10' : ''}`} value={val(p, k)} onChange={(e) => change(p, k, e.target.value)} />
  return (
    <>
      <PageHeader title="Bulk Product Update" trail={['Products', 'Bulk Product Update']} />
      <Card>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <Field label="Brand"><Select className="!w-48" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} placeholder="-- All Brand --" options={names('brands')} /></Field>
          <Field label="Category"><Select className="!w-48" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="-- All Categories --" options={names('categories')} /></Field>
          <Field label="Type"><Select className="!w-40" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} placeholder="--Select Type--" options={['Tiles', 'General']} /></Field>
          <Button onClick={() => setA(f)}><Search size={15} /> Search</Button>
          <div className="flex-1" />
          <span className="text-[13px] text-gray-600">{changed.length} changed</span>
          <Button color="success" disabled={!changed.length || saving} onClick={saveAll}><Save size={15} /> Save All</Button>
          {changed.length > 0 && <Button color="secondary" onClick={() => setEdits({})}>Undo changes</Button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-[13px]">
            <thead>
              <tr className="text-left">
                {['Product Code', 'Product Name *', 'Category', 'Brand', 'Size', 'PCS/Cart', 'Purchase Price *', 'Sell Price *', 'Alert Qty', 'Status'].map((h) => <th key={h} className="px-1 pb-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="p-1 w-32">{txt(p, 'code')}</td>
                  <td className="p-1">{txt(p, 'name')}</td>
                  <td className="p-1 w-36">{sel(p, 'category', names('categories'))}</td>
                  <td className="p-1 w-36">{sel(p, 'brand', names('brands'))}</td>
                  <td className="p-1 w-28">{sel(p, 'size', names('sizes'))}</td>
                  <td className="p-1 w-20">{txt(p, 'pcsPerCart', 'number')}</td>
                  <td className="p-1 w-28">{txt(p, 'purchasePrice', 'number')}</td>
                  <td className="p-1 w-28">{txt(p, 'sellPrice', 'number')}</td>
                  <td className="p-1 w-20">{txt(p, 'alertQty', 'number')}</td>
                  <td className="p-1 w-28">{sel(p, 'status', ['Active', 'Inactive'])}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={10} className="text-center text-gray-500 py-4">No products match.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-gray-500 mt-3">Changed boxes are highlighted. Nothing is saved until you click Save All. Stock is changed on Bulk Opening Stock or Product Stock In Out.</p>
      </Card>
    </>
  )
}
