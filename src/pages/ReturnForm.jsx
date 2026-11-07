import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Plus, Trash2 } from 'lucide-react'
import { Button, Input, Select, Modal } from '../components/ui'
import Combo from '../components/Combo'
import InvoicePrint from '../components/InvoicePrint'
import { toast } from '../components/Toast'
import { db, useCollection, useDb, contactBalance } from '../store/db'
import { useCan } from '../store/permissions'
import { INVOICE_MODES } from '../config/invoiceModes'
import { PAYMENT_METHODS } from '../config/shop'
import { displayDate, money, num, round2, sftPerPiece, today } from '../utils/format'

// Sales Return / Direct Return / Purchase Return.
// With an invoice (sales & purchase return) the invoice's lines are shown
// locked, and only the returned Cart / PCS / Return SFT can be typed.
// Below: Less (what is kept back), Ret. Amount and Return Paid (cash given
// back now; the rest is taken off the party's due).

const unitsOf = (p) => ({ per: num(p?.pcsPerCart) || 1, sft: p?.kind === 'Tiles' ? sftPerPiece(p.size) : 0 })
const toCartPcs = (qty, p) => {
  const { per, sft } = unitsOf(p)
  const pieces = sft ? Math.round(num(qty) / sft) : num(qty)
  return { cart: Math.floor(pieces / per) || '', pcs: pieces % per || '' }
}
const toQty = (cart, pcs, p) => {
  const { per, sft } = unitsOf(p)
  const pieces = num(cart) * per + num(pcs)
  return pieces ? (sft ? round2(pieces * sft) : pieces) : ''
}
const EPS = 0.005

export default function ReturnForm({ mode }) {
  const [params] = useSearchParams()
  const editId = params.get('edit') || ''
  const sourceParam = params.get('source') || ''
  const allow = useCan(INVOICE_MODES[mode].listPath)
  if (editId && !allow.edit) {
    return <div className="bg-white rounded shadow-sm p-6 text-[13px] text-gray-600">Your role is not allowed to edit this. Ask an admin to allow it on Set Permission.</div>
  }
  return <ReturnEditor key={editId || sourceParam || 'new'} mode={mode} editId={editId} sourceParam={sourceParam} />
}

function ReturnEditor({ mode, editId, sourceParam }) {
  const cfg = INVOICE_MODES[mode]
  const nav = useNavigate()
  const { pathname } = useLocation()
  const state = useDb()
  const products = useCollection('products')
  const contacts = useCollection('contacts')
  const parties = contacts.filter((c) => cfg.party.includes(c.type))
  const isSupplier = cfg.party.includes('supplier')
  const partyLabel = isSupplier ? 'Supplier' : 'Customer'
  const productById = (id) => products.find((p) => p.id === id)
  const sources = cfg.source ? state[cfg.source] : []

  const [editDoc] = useState(() => (editId ? state[cfg.collection].find((d) => d.id === editId) || null : null))
  const e0 = editDoc || {}

  // How much of each line of an invoice was already returned (other returns only)
  const returnedBefore = (src) => {
    const out = src.items.map(() => 0)
    state[cfg.collection]
      .filter((r) => r.sourceId === src.id && r.id !== editDoc?.id)
      .forEach((r) => r.items.forEach((it) => {
        const i = Number.isInteger(it.sourceIndex) ? it.sourceIndex : src.items.findIndex((s) => s.productId === it.productId)
        if (i >= 0) out[i] += num(it.qty)
      }))
    return out
  }

  // Lines for a chosen invoice: locked sold part + editable return part
  const linesFromSource = (src, filled = []) => {
    const before = returnedBefore(src)
    return src.items.map((it, i) => {
      const prev = filled.find((f) => (Number.isInteger(f.sourceIndex) ? f.sourceIndex === i : f.productId === it.productId))
      const p = productById(it.productId)
      const qty = prev ? prev.qty : ''
      return {
        key: Math.random(), sourceIndex: i, productId: it.productId, name: it.name, code: it.code, size: it.size, kind: it.kind,
        sold: { qty: num(it.qty), cart: it.cart, pcs: it.pcs, rate: num(it.rate), discount: it.discount, discountType: it.discountType, total: num(it.total) },
        // price per SFT/PCS after the line discount
        rate: num(it.qty) ? num(it.total) / num(it.qty) : num(it.rate),
        left: round2(num(it.qty) - before[i]),
        qty, ...(prev ? { cart: prev.cart ?? toCartPcs(qty, p).cart, pcs: prev.pcs ?? toCartPcs(qty, p).pcs } : { cart: '', pcs: '' }),
      }
    })
  }
  const emptyDirect = () => ({ key: Math.random(), productId: '', rate: '', cart: '', pcs: '', qty: '' })

  const startSource = editDoc?.sourceId || (!editDoc ? sourceParam : '')
  const firstSource = startSource ? sources.find((d) => d.id === startSource) || null : null

  const [sourceId, setSourceId] = useState(firstSource?.id || '')
  const [contactId, setContactId] = useState(e0.contactId ?? firstSource?.contactId ?? '')
  const [date, setDate] = useState(e0.date || today())
  const [note, setNote] = useState(e0.note || '')
  const [lines, setLines] = useState(() => {
    if (firstSource) return linesFromSource(firstSource, editDoc?.items || [])
    if (editDoc) return editDoc.items.map((it) => ({ ...emptyDirect(), ...it, key: Math.random() }))
    return cfg.source ? [] : [emptyDirect()]
  })
  const [less, setLess] = useState(e0.less ?? '')
  const [retPaid, setRetPaid] = useState(e0.paid ?? '')
  const [method, setMethod] = useState(e0.payments?.[0]?.method || 'Cash')
  const [payNote, setPayNote] = useState(e0.payments?.[0]?.note || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [printDoc, setPrintDoc] = useState(null)

  const source = sources.find((d) => d.id === sourceId) || null
  const locked = !!source // lines come from an invoice
  const contact = contacts.find((c) => c.id === contactId)
  const balanceState = editDoc ? { ...state, [cfg.collection]: state[cfg.collection].filter((d) => d.id !== editDoc.id) } : state
  const prevDue = contact ? contactBalance(contact, balanceState) : 0
  const sourceOpts = sources
    .filter((d) => !contactId || d.contactId === contactId)
    .slice().reverse()
    .map((d) => ({ value: d.id, label: `${d.number} | ${displayDate(d.date)} | ${d.contactName} | ${money(d.invoiceAmount)}` }))

  const chooseSource = (id) => {
    setSourceId(id)
    setError('')
    const src = sources.find((d) => d.id === id)
    if (!src) { setLines([]); return }
    setContactId(src.contactId || '')
    setLines(linesFromSource(src))
  }

  const setLine = (i, field, value) => setLines((ls) => ls.map((l, idx) => {
    if (idx !== i) return l
    const next = { ...l, [field]: value }
    const p = productById(next.productId)
    if (field === 'productId') next.rate = p ? p[cfg.priceKey || 'sellPrice'] : ''
    if (field === 'cart' || field === 'pcs') next.qty = toQty(next.cart, next.pcs, p)
    if (field === 'qty') Object.assign(next, toCartPcs(value, p))
    return next
  }))

  const totals = useMemo(() => {
    const amount = (l) => round2(num(l.qty) * num(l.rate))
    const value = round2(lines.reduce((a, l) => a + amount(l), 0))
    const lessAmt = round2(num(less))
    const retAmount = Math.round(value - lessAmt)
    const paid = round2(num(retPaid))
    return { amount, value, less: lessAmt, retAmount, paid, toDue: round2(retAmount - paid) }
  }, [lines, less, retPaid])

  const reset = () => {
    setSourceId(''); setContactId(''); setNote(''); setLess(''); setRetPaid(''); setPayNote(''); setError('')
    setLines(cfg.source ? [] : [emptyDirect()])
  }

  const save = async (print) => {
    if (cfg.source && !locked && !editDoc) { setError(`Select the ${isSupplier ? 'purchase' : 'sales'} invoice the goods came from.`); return }
    const items = lines.filter((l) => l.productId && num(l.qty) > 0)
    if (!items.length) { setError('Enter the returned quantity (Cart / PCS / Return SFT) for at least one product.'); return }
    const over = items.find((l) => locked && num(l.qty) > l.left + EPS)
    if (over) { setError(`${over.name}: only ${over.left} can be returned (sold ${over.sold.qty}, already returned ${round2(over.sold.qty - over.left)}).`); return }
    if (!locked && items.some((l) => !(num(l.rate) >= 0) || l.rate === '')) { setError('Every product needs a rate.'); return }
    if (totals.less < 0 || totals.less > totals.value) { setError('Less must be between 0 and the return value.'); return }
    if (totals.paid < 0 || totals.paid > totals.retAmount) { setError('Return Paid cannot be more than the Ret. Amount.'); return }
    if (saving) return
    setSaving(true)
    setError('')
    const body = {
      date, note,
      sourceId: locked ? source.id : '', sourceNumber: locked ? source.number : '',
      contactId: contactId || '',
      contactName: contact ? contact.name : locked ? source.contactName : cfg.walkIn,
      phone: contact ? contact.phone : locked ? source.phone || '' : '',
      address: contact ? contact.address : locked ? source.address || '' : '',
      items: items.map((l) => {
        const p = productById(l.productId) || {}
        return {
          productId: l.productId, name: p.name || l.name, code: p.code || l.code, size: p.size ?? l.size, grade: p.grade, kind: p.kind || l.kind,
          qty: num(l.qty), cart: l.cart, pcs: l.pcs, rate: round2(l.rate), discount: 0, discountType: '%', total: totals.amount(l),
          ...(locked ? { sourceIndex: l.sourceIndex } : {}),
        }
      }),
      subTotal: totals.value, vat: 0, less: totals.less, discount: totals.less, discountNote: totals.less ? 'Less' : '',
      laborCost: 0, invoiceAmount: totals.retAmount, previousDue: prevDue,
      payments: totals.paid > 0 ? [{ amount: totals.paid, method, info: '', note: payNote }] : [],
      paid: totals.paid, given: totals.paid, change: 0, due: totals.toDue,
    }
    const doc = editDoc ? await db.updateDocument(cfg.collection, editDoc.id, body) : await db.saveDocument(cfg.collection, body)
    setSaving(false)
    if (!doc) return
    toast.success(`${cfg.title} ${doc.number} ${editDoc ? 'updated' : 'saved'} successfully.`)
    if (editDoc) {
      if (print) setPrintDoc({ ...doc, title: cfg.title, afterClose: cfg.listPath })
      else nav(cfg.listPath)
      return
    }
    reset()
    if (print) setPrintDoc({ ...doc, title: cfg.title, afterClose: sourceParam ? pathname : '' })
    else if (sourceParam) nav(pathname, { replace: true }) // drop ?source= so the next return starts empty
  }

  const lockedCls = '!bg-gray-100 !text-gray-600'

  return (
    <>
      <div className="bg-white rounded shadow-sm p-4 mb-6">
        <h4 className="text-[15px] font-semibold uppercase text-gray-700 mb-3">{cfg.title}</h4>

        {/* header */}
        <div className="bg-[#f2f2f5] p-3 grid grid-cols-1 md:grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-2 items-center text-[13px]">
          <span className="font-medium">Return Date *</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="font-medium">{partyLabel}</span>
          <Combo value={contactId} onChange={(v) => { setContactId(v); if (locked && !editDoc && source.contactId !== v) chooseSource('') }} placeholder={cfg.walkIn}
            options={[{ value: '', label: cfg.walkIn }, ...parties.map((c) => ({ value: c.id, label: `${c.name} - ${c.phone}` }))]} />
          {cfg.source && (
            <>
              <span className="font-medium">{isSupplier ? 'Purchase' : 'Sales'} Number *</span>
              <Select value={sourceId} onChange={(e) => chooseSource(e.target.value)} placeholder="--Select Invoice--" options={sourceOpts} disabled={!!editDoc} />
            </>
          )}
          <span className="font-medium">Note</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
          {contact && (
            <div className="md:col-span-4 text-gray-600">
              {contact.address} {contact.phone && `| ${contact.phone}`} | Current balance: <b>{money(prevDue)}</b>
            </div>
          )}
          {editDoc && <div className="md:col-span-4 font-medium text-warning">Editing {editDoc.number}{editDoc.sourceNumber ? ` (return of ${editDoc.sourceNumber})` : ''}</div>}
        </div>

        {/* lines */}
        <div className="bg-[#d4d4d4] p-3 min-h-[160px] overflow-x-auto">
          {cfg.source && !locked && !editDoc ? (
            <p className="text-[13px] text-gray-700 py-10 text-center">Select the {isSupplier ? 'purchase' : 'sales'} invoice to load its products.</p>
          ) : (
            <table className="w-full min-w-[980px] text-[13px]">
              <thead>
                <tr className="text-left font-medium">
                  <th className="pb-1 w-[26%]">Product *</th>
                  {locked ? <>
                    <th className="pb-1">{isSupplier ? 'Purchased' : 'Sold'} SFT/Qty</th>
                    <th className="pb-1">Discount</th>
                    <th className="pb-1">Amount</th>
                  </> : <th className="pb-1">Rate *</th>}
                  <th className="pb-1 pl-3 border-l-2 border-danger/60">Cart</th>
                  <th className="pb-1">PCS</th>
                  <th className="pb-1">Return SFT/Qty</th>
                  <th className="pb-1">Return Amount</th>
                  {!locked && <th className="pb-1 text-center">Action</th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const p = productById(l.productId)
                  const tooMuch = locked && num(l.qty) > l.left + EPS
                  return (
                    <tr key={l.key}>
                      <td className="pr-2 py-1 align-top">
                        {locked
                          ? <div className="relative"><Input value={`${l.code ? `${l.code} - ` : ''}${l.name || ''}${l.size ? ` (${l.size})` : ''}`} readOnly className={`${lockedCls} !pl-7`} title="From the invoice (locked)" /><Lock size={13} className="absolute left-2 top-2.5 text-gray-400" /></div>
                          : <Combo value={l.productId} onChange={(v) => setLine(i, 'productId', v)} placeholder="--Select Product--"
                              options={products.filter((x) => x.status === 'Active').map((x) => ({ value: x.id, label: `${x.code} - ${x.name}${x.size ? ` (${x.size})` : ''}` }))} />}
                        {locked && <div className="text-[11px] text-gray-600 mt-0.5">Can return: {l.left} {p?.kind === 'Tiles' ? 'SFT' : 'PCS'}</div>}
                      </td>
                      {locked ? <>
                        <td className="pr-2 py-1 align-top"><Input value={`${l.sold.qty}${l.sold.cart ? ` (${l.sold.cart} ct${l.sold.pcs ? ` ${l.sold.pcs} pc` : ''})` : ''}`} readOnly className={lockedCls} /></td>
                        <td className="pr-2 py-1 align-top"><Input value={num(l.sold.discount) ? `${l.sold.discount} ${l.sold.discountType === '%' ? '%' : 'BDT'}` : '0'} readOnly className={lockedCls} /></td>
                        <td className="pr-2 py-1 align-top"><Input value={money(l.sold.total)} readOnly className={lockedCls} /></td>
                      </> : (
                        <td className="pr-2 py-1 align-top"><Input type="number" placeholder="Rate" value={l.rate} onChange={(e) => setLine(i, 'rate', e.target.value)} /></td>
                      )}
                      <td className="pr-2 pl-3 py-1 align-top border-l-2 border-danger/60"><Input type="number" min="0" placeholder="Cartoon" value={l.cart} onChange={(e) => setLine(i, 'cart', e.target.value)} /></td>
                      <td className="pr-2 py-1 align-top"><Input type="number" min="0" placeholder="PCS" value={l.pcs} onChange={(e) => setLine(i, 'pcs', e.target.value)} /></td>
                      <td className="pr-2 py-1 align-top"><Input type="number" min="0" placeholder="0" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} className={tooMuch ? '!border-danger' : ''} /></td>
                      <td className="pr-2 py-1 align-top"><Input value={totals.amount(l) ? money(totals.amount(l)) : ''} readOnly /></td>
                      {!locked && (
                        <td className="py-1 align-top">
                          <Button color="danger" className="w-full" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : [emptyDirect()]))}><Trash2 size={15} /></Button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {!locked && !cfg.source && (
            <Button color="success" className="mt-2 !px-6" onClick={() => setLines((ls) => [...ls, emptyDirect()])}><Plus size={16} /></Button>
          )}
        </div>

        {/* totals */}
        <div className="bg-[#f2f2f5] p-4 grid md:grid-cols-3 gap-x-8 gap-y-2 text-[13px]">
          <div className="space-y-2">
            {locked ? <>
              <p className="flex items-center gap-1 font-semibold text-gray-600"><Lock size={13} /> {source.number} ({displayDate(source.date)})</p>
              <Row label={isSupplier ? 'Pur. Amount' : 'Sale Amount'}><Input value={money(source.subTotal)} readOnly className={lockedCls} /></Row>
              <Row label="Discount"><Input value={money(source.discount)} readOnly className={lockedCls} /></Row>
              <Row label="Net Payable"><Input value={money(source.invoiceAmount)} readOnly className={lockedCls} /></Row>
              <Row label="Paid"><Input value={money(source.paid)} readOnly className={lockedCls} /></Row>
            </> : (
              <p className="text-gray-500">{cfg.source ? 'The invoice totals show here once an invoice is selected.' : 'Direct return: products returned without an invoice.'}</p>
            )}
          </div>
          <div className="space-y-2">
            <Row label="Return Value"><Input value={money(totals.value)} readOnly /></Row>
            <Row label="Less"><Input type="number" min="0" placeholder="0" value={less} onChange={(e) => setLess(e.target.value)} onFocus={(e) => e.target.select()} /></Row>
            <Row label="Ret. Amount"><Input value={money(totals.retAmount)} readOnly className="!font-semibold" /></Row>
            <Row label="Return Paid"><Input type="number" min="0" placeholder="0" value={retPaid} onChange={(e) => setRetPaid(e.target.value)} onFocus={(e) => e.target.select()} /></Row>
          </div>
          <div className="space-y-2">
            <Row label="Paid Through"><Select value={method} onChange={(e) => setMethod(e.target.value)} options={PAYMENT_METHODS} /></Row>
            <Row label="Pay Note"><Input placeholder="note" value={payNote} onChange={(e) => setPayNote(e.target.value)} /></Row>
            <Row label="Adjust in Due"><Input value={money(totals.toDue)} readOnly /></Row>
            {contact && <Row label="Balance After"><Input value={money(prevDue - totals.toDue)} readOnly /></Row>}
          </div>
          <p className="md:col-span-3 text-[12px] text-gray-500">
            Less = amount kept back from the return. Ret. Amount = Return Value − Less. Return Paid = cash {isSupplier ? 'received from the supplier' : 'given back to the customer'} now; the rest is taken off the {partyLabel.toLowerCase()}&apos;s due.
          </p>
        </div>

        {error && <p className="text-danger text-[13px] mt-3">{error}</p>}
        <div className="flex gap-1 mt-3">
          <Button disabled={saving} onClick={() => save(false)}>{editDoc ? 'Update' : 'Save'}</Button>
          <Button disabled={saving} color="success" onClick={() => save(true)}>{editDoc ? 'Update' : 'Save'} &amp; Print</Button>
          <Button color="secondary" onClick={() => nav(cfg.listPath)}>Close</Button>
        </div>
      </div>

      <Modal open={!!printDoc} onClose={() => { const to = printDoc?.afterClose; setPrintDoc(null); if (to) nav(to, { replace: true }) }} title="Print" wide>
        {printDoc && <InvoicePrint doc={printDoc} />}
      </Modal>
    </>
  )
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3">
      <span className="text-right font-medium">{label}</span>
      {children}
    </div>
  )
}
