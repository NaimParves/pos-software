import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Boxes, CircleDollarSign, Eye, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react'
import { PageHeader, Card, Field, Input, Button, Modal } from '../components/ui'
import Combo from '../components/Combo'
import DataTable from '../components/DataTable'
import InvoicePrint from '../components/InvoicePrint'
import { toast } from '../components/Toast'
import { db, useCollection, useDb } from '../store/db'
import { useCan } from '../store/permissions'
import { displayDate, inRange, money, num, round2, sftPerPiece, today } from '../utils/format'

const monthStart = () => today().slice(0, 8) + '01'
const units = (p) => ({ per: num(p?.pcsPerCart) || 1, sft: p?.kind === 'Tiles' ? sftPerPiece(p.size) : 0 })
const toQty = (cart, pcs, p) => {
  const { per, sft } = units(p)
  const pieces = num(cart) * per + num(pcs)
  return pieces ? (sft ? round2(pieces * sft) : pieces) : ''
}
const toCartPcs = (qty, p) => {
  const { per, sft } = units(p)
  const pieces = sft ? Math.round(num(qty) / sft) : num(qty)
  return { cart: Math.floor(pieces / per) || '', pcs: pieces % per || '' }
}
// "Stock : 17.35 SFT | 1.04 Cart | 26.02 PCS"
export function stockText(p) {
  if (!p) return ''
  const { per, sft } = units(p)
  const pieces = sft ? num(p.stock) / sft : num(p.stock)
  return sft
    ? `Stock : ${round2(p.stock)} SFT | ${round2(pieces / per)} Cart | ${round2(pieces)} PCS`
    : `Stock : ${round2(p.stock)} PCS | ${round2(pieces / per)} Cart`
}

const emptyLine = () => ({ key: Math.random(), productId: '', cart: '', pcs: '', qty: '' })

// New Damage Entry: Date, Note, then Product / Cart / PCS / Qty lines.
// The damaged quantity leaves stock; the value is counted at purchase price.
export function DamageForm() {
  const [params] = useSearchParams()
  const editId = params.get('edit') || ''
  const allow = useCan('/damages')
  if (editId && !allow.edit) return <div className="bg-white rounded shadow-sm p-6 text-[13px] text-gray-600">Your role is not allowed to edit damages.</div>
  return <DamageEditor key={editId || 'new'} editId={editId} />
}

function DamageEditor({ editId }) {
  const nav = useNavigate()
  const state = useDb()
  const products = useCollection('products')
  const [editDoc] = useState(() => (editId ? state.damages.find((d) => d.id === editId) || null : null))
  const [date, setDate] = useState(editDoc?.date || today())
  const [note, setNote] = useState(editDoc?.note || '')
  const [lines, setLines] = useState(() => (editDoc?.items?.length ? editDoc.items.map((it) => ({ ...emptyLine(), ...it, key: Math.random() })) : [emptyLine()]))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const prod = (id) => products.find((p) => p.id === id)
  const opts = products.filter((p) => p.status === 'Active').map((p) => ({ value: p.id, label: `${p.grade ? `${p.grade} - ` : ''}${p.code} - ${p.name}${p.size ? ` - ${p.size}` : ''}` }))

  const setLine = (i, field, value) => setLines((ls) => ls.map((l, idx) => {
    if (idx !== i) return l
    const next = { ...l, [field]: value }
    const p = prod(next.productId)
    if (field === 'cart' || field === 'pcs') next.qty = toQty(next.cart, next.pcs, p)
    if (field === 'qty') Object.assign(next, toCartPcs(value, p))
    if (field === 'productId') Object.assign(next, { cart: '', pcs: '', qty: '' })
    return next
  }))

  const save = async () => {
    const items = lines.filter((l) => l.productId && num(l.qty) > 0)
    if (!items.length) { setError('Add at least one product with a quantity.'); return }
    setSaving(true); setError('')
    const saved = items.map(({ key, ...l }) => {
      const p = prod(l.productId) || {}
      const rate = num(p.purchasePrice)
      return { productId: l.productId, name: p.name, code: p.code, size: p.size, grade: p.grade, kind: p.kind, cart: l.cart, pcs: l.pcs, qty: num(l.qty), rate, discount: 0, discountType: '%', total: round2(num(l.qty) * rate) }
    })
    const value = round2(saved.reduce((a, it) => a + it.total, 0))
    const body = { date, note, contactName: note || 'Damage', items: saved, subTotal: value, invoiceAmount: value, paid: 0, due: 0, noPayments: true, discount: 0, vat: 0, laborCost: 0 }
    const doc = editDoc ? await db.updateDocument('damages', editDoc.id, body) : await db.saveDocument('damages', body)
    setSaving(false)
    if (!doc) return
    toast.success(`Damage ${doc.number} ${editDoc ? 'updated' : 'saved'}.`)
    if (editDoc) nav('/damages')
    else { setDate(today()); setNote(''); setLines([emptyLine()]) }
  }

  return (
    <div className="bg-white rounded shadow-sm p-4 mb-6">
      <div className="bg-[#f2f2f5] p-3 grid grid-cols-1 md:grid-cols-[auto_200px_auto_1fr] gap-x-4 gap-y-2 items-center text-[13px]">
        <span className="font-medium">Date *</span>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <span className="font-medium">Note</span>
        <Input placeholder="Damage Note" value={note} onChange={(e) => setNote(e.target.value)} />
        {editDoc && <span className="md:col-span-4 text-warning font-medium">Editing {editDoc.number}</span>}
      </div>
      <div className="bg-[#d4d4d4] p-3 min-h-[260px] overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="text-left font-medium">
              <th className="pb-1 w-[46%]">Product *</th><th className="pb-1">Cart</th><th className="pb-1">PCS</th><th className="pb-1">Qty *</th><th className="pb-1 text-center w-24">Action</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const p = prod(l.productId)
              return (
                <tr key={l.key}>
                  <td className="pr-2 py-1 align-top">
                    <Combo value={l.productId} onChange={(v) => setLine(i, 'productId', v)} placeholder="--Select Product--" options={opts} />
                    {p && <div className="text-[11px] text-gray-700 mt-0.5">{stockText(p)}</div>}
                  </td>
                  <td className="pr-2 py-1 align-top"><Input type="number" min="0" placeholder="Cartoon" value={l.cart} onChange={(e) => setLine(i, 'cart', e.target.value)} /></td>
                  <td className="pr-2 py-1 align-top"><Input type="number" min="0" placeholder="PCS" value={l.pcs} onChange={(e) => setLine(i, 'pcs', e.target.value)} /></td>
                  <td className="pr-2 py-1 align-top"><Input type="number" min="0" placeholder="Quantity" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} /></td>
                  <td className="py-1 align-top">
                    {i === 0
                      ? <Button color="success" className="w-full" title="Add a line" onClick={() => setLines((ls) => [...ls, emptyLine()])}><Plus size={16} /></Button>
                      : <Button color="danger" className="w-full" title="Remove line" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}><Trash2 size={15} /></Button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {error && <p className="text-danger text-[13px] mt-3">{error}</p>}
      <div className="flex gap-1 mt-3">
        <Button disabled={saving} onClick={save}>{editDoc ? 'Update' : 'Save'}</Button>
        <Button color="secondary" onClick={() => nav('/damages')}>Close</Button>
      </div>
    </div>
  )
}

// All Damages: monthly summary cards, the list (Damage ID, quantity, items,
// value, note) and a product-wise damage ledger.
export function DamageList() {
  const nav = useNavigate()
  const allow = useCan()
  const s = useDb()
  const [f, setF] = useState({ from: monthStart(), to: today() })
  const [a, setA] = useState(f)
  const [view, setView] = useState(null)
  const rows = s.damages
    .filter((d) => inRange(d.date, a.from, a.to))
    .map((d) => ({ ...d, qtyTotal: round2(d.items.reduce((x, it) => x + num(it.qty), 0)), itemCount: d.items.length, value: num(d.invoiceAmount) || round2(d.items.reduce((x, it) => x + num(it.total), 0)) }))
    .slice().reverse()
  const remove = (d) => confirm(`Delete ${d.number}? The quantity goes back into stock.`) && db.removeDocument('damages', d.id)
  const columns = [
    { key: 'sl', label: 'SL', render: (_, i) => i + 1, sortable: false },
    { key: 'number', label: 'Damage ID', render: (d) => <button className="text-primary hover:underline" onClick={() => setView(d)}>{d.number}</button> },
    { key: 'date', label: 'Date', render: (d) => displayDate(d.date) },
    { key: 'qtyTotal', label: 'Quantity (SFT)', align: 'right' },
    { key: 'itemCount', label: 'Items', align: 'right' },
    { key: 'value', label: 'Damage Value', align: 'right', render: (d) => money(d.value) },
    { key: 'note', label: 'Note' },
    {
      key: 'action', label: 'Action', render: (d) => (
        <div className="flex gap-1">
          <Button color="info" className="!px-2 !py-1" title="View" onClick={() => setView(d)}><Eye size={14} /></Button>
          {allow.edit && <Button color="primary" className="!px-2 !py-1" title="Edit" onClick={() => nav(`/damages/create?edit=${d.id}`)}><Pencil size={14} /></Button>}
          {allow.delete && <Button color="danger" className="!px-2 !py-1" title="Delete" onClick={() => remove(d)}><Trash2 size={14} /></Button>}
        </div>
      ),
    },
  ]
  const totals = { qty: round2(rows.reduce((x, d) => x + d.qtyTotal, 0)), items: rows.reduce((x, d) => x + d.itemCount, 0), value: rows.reduce((x, d) => x + d.value, 0) }
  const period = a.from === monthStart() && a.to === today() ? 'This month' : `${displayDate(a.from) || '…'} to ${displayDate(a.to) || '…'}`
  const cards = [
    ['Total Damage Entries', rows.length, AlertTriangle, 'bg-danger/10 text-danger'],
    ['Total Damaged Items', `${totals.items} lines · ${totals.qty} qty`, Boxes, 'bg-warning/15 text-[#b07d24]'],
    ['Total Damage Value', money(totals.value), CircleDollarSign, 'bg-primary/10 text-primary'],
  ]
  return (
    <>
      <PageHeader title="All Damages" />
      <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Summary · {period}</p>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {cards.map(([label, value, Icon, tone]) => (
          <div key={label} className="bg-white rounded shadow-sm p-4 flex items-center justify-between">
            <div><p className="text-[12px] text-gray-500">{label}</p><p className="text-xl font-semibold text-gray-700 mt-1">{value}</p></div>
            <span className={`w-11 h-11 rounded-full flex items-center justify-center ${tone}`}><Icon size={20} /></span>
          </div>
        ))}
      </div>
      <Card>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <Field label="From Date"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="To Date"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          <Button onClick={() => setA(f)}><Search size={15} /> Search</Button>
          <Button color="secondary" onClick={() => { const all = { from: '', to: '' }; setF(all); setA(all) }}>Show all dates</Button>
        </div>
        <DataTable columns={columns} rows={rows}
          footer={rows.length > 0 && (
            <tr className="border-t">
              <td colSpan={3} className="px-3 py-2 text-right">Total</td>
              <td className="px-3 py-2 text-right">{totals.qty}</td><td className="px-3 py-2 text-right">{totals.items}</td>
              <td className="px-3 py-2 text-right">{money(totals.value)}</td><td /><td />
            </tr>
          )} />
      </Card>
      <DamageLedger />
      <Modal open={!!view} onClose={() => setView(null)} title={view && `Damage ${view.number}`} wide>
        {view && <InvoicePrint doc={{ ...view, noPayments: true }} challan={false} kind="purchase" title="Damage" />}
      </Modal>
    </>
  )
}

// Product-wise damage history for a date range
function DamageLedger() {
  const s = useDb()
  const [f, setF] = useState({ productId: '', from: '', to: today() })
  const [a, setA] = useState(null)
  const p = a && s.products.find((x) => x.id === a.productId)
  const rows = a ? s.damages
    .filter((d) => inRange(d.date, a.from, a.to))
    .flatMap((d) => d.items.filter((it) => it.productId === a.productId).map((it, i) => ({ id: `${d.id}-${i}`, date: d.date, number: d.number, note: d.note, qty: num(it.qty), cart: it.cart, pcs: it.pcs, rate: num(it.rate), value: num(it.total) })))
    .sort((x, y) => x.date.localeCompare(y.date)) : []
  const tQty = round2(rows.reduce((x, r) => x + r.qty, 0))
  const tVal = rows.reduce((x, r) => x + r.value, 0)
  const cell = 'border border-gray-300 px-2 py-1'
  return (
    <Card title="Product Damage Ledger">
      <div className="flex flex-wrap gap-3 items-end mb-4 print:hidden">
        <Field label="Product">
          <Combo className="w-72" value={f.productId} onChange={(v) => setF({ ...f, productId: v })} placeholder="--Select Product--"
            options={s.products.map((x) => ({ value: x.id, label: `${x.code} - ${x.name}` }))} />
        </Field>
        <Field label="From Date"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To Date"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Button disabled={!f.productId} onClick={() => setA(f)}><Search size={15} /> Search</Button>
        {a && <Button color="success" onClick={() => window.print()}><Printer size={15} /> Print</Button>}
      </div>
      {a && (
        <div className="print-area overflow-x-auto text-[12px]">
          <p className="font-semibold mb-2">{p?.code} - {p?.name} · {displayDate(a.from) || 'Beginning'} to {displayDate(a.to) || 'Today'}</p>
          <table className="w-full min-w-[640px] border-collapse">
            <thead className="bg-gray-50">
              <tr>{['Date', 'Damage ID', 'Note', 'Cart', 'PCS', `Qty (${p?.kind === 'Tiles' ? 'SFT' : 'PCS'})`, 'Rate', 'Value'].map((h) => <th key={h} className={`${cell} text-left`}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={cell}>{displayDate(r.date)}</td><td className={cell}>{r.number}</td><td className={cell}>{r.note}</td>
                  <td className={cell}>{r.cart || ''}</td><td className={cell}>{r.pcs || ''}</td>
                  <td className={`${cell} text-right`}>{round2(r.qty)}</td><td className={`${cell} text-right`}>{round2(r.rate)}</td><td className={`${cell} text-right`}>{money(r.value)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className={`${cell} text-center text-gray-500 py-3`}>No damage of this product in the period.</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="font-semibold bg-gray-50">
                <tr><td colSpan={5} className={`${cell} text-right`}>Total ({rows.length} entries)</td><td className={`${cell} text-right`}>{tQty}</td><td className={cell} /><td className={`${cell} text-right`}>{money(tVal)}</td></tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Card>
  )
}
