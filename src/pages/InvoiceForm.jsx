import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Input, Select, Modal, Field } from '../components/ui'
import Combo from '../components/Combo'
import InvoicePrint from '../components/InvoicePrint'
import { toast } from '../components/Toast'
import { ProductForm } from './Products'
import { db, useCollection, useDb, contactBalance } from '../store/db'
import { INVOICE_MODES, LABOR_PER_CARTOON, ROUND_TOTAL } from '../config/invoiceModes'
import { PAYMENT_METHODS } from '../config/shop'
import { num, round2, sftPerPiece, today, money } from '../utils/format'

const emptyLine = () => ({ key: Math.random(), productId: '', qty: '', cart: '', pcs: '', rate: '', discountType: '%', discount: '', total: 0 })
const emptyPay = () => ({ amount: 0, method: 'Cash', info: '', note: '' })

// Recalculate cartoon / pcs / sft / total for one line after a field changes.
function recalc(line, product, changed) {
  const l = { ...line }
  if (product) {
    const per = num(product.pcsPerCart) || 1
    const sft = product.kind === 'Tiles' ? sftPerPiece(product.size) : 0
    if (changed === 'qty') {
      const pieces = sft ? Math.round(num(l.qty) / sft) : num(l.qty)
      l.cart = Math.floor(pieces / per) || ''
      l.pcs = pieces % per || ''
    } else if (changed === 'cart' || changed === 'pcs') {
      const pieces = num(l.cart) * per + num(l.pcs)
      l.qty = pieces ? (sft ? round2(pieces * sft) : pieces) : ''
    }
  }
  const gross = num(l.qty) * num(l.rate)
  const disc = l.discountType === '%' ? (gross * num(l.discount)) / 100 : num(l.discount)
  l.total = round2(gross - disc)
  return l
}

// The money handed over ("Given") is shared out over the payment rows. The
// change returned to the customer is taken off the stored rows (cash first)
// so cash/bank books only count the money the shop actually kept.
function netPayments(rows, change) {
  let left = round2(change)
  const out = rows.map((p) => ({ ...p, amount: num(p.amount) }))
  const order = [...out.keys()].sort((a, b) => (out[b].method === 'Cash') - (out[a].method === 'Cash'))
  for (const i of order) {
    if (left <= 0) break
    const take = Math.min(out[i].amount, left)
    out[i].amount = round2(out[i].amount - take)
    left = round2(left - take)
  }
  return out.filter((p) => p.amount > 0)
}

// ?edit=<id> opens a saved invoice for editing; a new key resets the form
export default function InvoiceForm({ mode }) {
  const [params] = useSearchParams()
  const editId = params.get('edit') || ''
  return <InvoiceEditor key={editId || 'new'} mode={mode} editId={editId} />
}

function InvoiceEditor({ mode, editId }) {
  const cfg = INVOICE_MODES[mode]
  const nav = useNavigate()
  const state = useDb()
  const products = useCollection('products')
  const contacts = useCollection('contacts')
  const parties = cfg.party ? contacts.filter((c) => cfg.party.includes(c.type)) : []
  const references = contacts.filter((c) => c.type === 'reference')
  const productOpts = products.filter((p) => p.status === 'Active').map((p) => ({ value: p.id, label: `${p.code} - ${p.name}${p.size ? ` (${p.size})` : ''}` }))

  // when editing, start from the saved invoice
  const [editDoc] = useState(() => (editId ? state[cfg.collection].find((d) => d.id === editId) || null : null))
  const e0 = editDoc || {}
  const startPays = e0.givenPayments?.length ? e0.givenPayments : e0.payments?.length ? e0.payments : [emptyPay()]

  const [contactId, setContactId] = useState(e0.contactId || '')
  const [walk, setWalk] = useState(e0.contactId ? { name: '', address: '', phone: '' } : { name: e0.contactName && e0.contactName !== cfg.walkIn ? e0.contactName : '', address: e0.address || '', phone: e0.phone || '' })
  const [refId, setRefId] = useState(e0.referenceId || '')
  const [date, setDate] = useState(e0.date || today())
  const [note, setNote] = useState(e0.note || '')
  const [sourceId, setSourceId] = useState(e0.sourceId || '')
  const [lines, setLines] = useState(() => (e0.items?.length ? e0.items.map((it) => ({ ...emptyLine(), ...it, key: Math.random() })) : [emptyLine()]))
  const [vatType, setVatType] = useState(e0.vatType || (editDoc ? 'BDT' : '%'))
  const [vat, setVat] = useState(e0.vatInput ?? (editDoc ? e0.vat || '' : ''))
  const [discType, setDiscType] = useState(e0.discType || 'BDT')
  const [disc, setDisc] = useState(e0.discInput ?? (editDoc ? e0.discount || 0 : 0))
  const [discNote, setDiscNote] = useState(e0.discountNote || '')
  const [autoLabor, setAutoLabor] = useState(editDoc ? e0.autoLabor ?? false : true)
  const [labor, setLabor] = useState(editDoc ? e0.laborCost || '' : '')
  const [given, setGiven] = useState(editDoc ? e0.given || round2(startPays.reduce((a, p) => a + num(p.amount), 0)) : 0)
  const [sms, setSms] = useState(!!e0.sms)
  const [pays, setPays] = useState(() => startPays.map((p) => ({ ...emptyPay(), ...p })))
  const [quickAdd, setQuickAdd] = useState(false)
  const [addProduct, setAddProduct] = useState(false)
  const [printDoc, setPrintDoc] = useState(null)
  const [error, setError] = useState('')

  const productById = (id) => products.find((p) => p.id === id)
  const contact = contacts.find((c) => c.id === contactId)
  // previous balance, not counting the invoice being edited
  const balanceState = editDoc ? { ...state, [cfg.collection]: state[cfg.collection].filter((d) => d.id !== editDoc.id) } : state
  const prevDue = contact ? contactBalance(contact, balanceState) : 0

  // Given and the Paid rows always agree: typing in Given fills the payment
  // rows, typing in a Paid row updates Given to the total of the rows.
  const changeGiven = (v) => {
    setGiven(v)
    setPays((ps) => {
      if (ps.length === 1) return [{ ...ps[0], amount: v }]
      const others = ps.slice(1).reduce((a, p) => a + num(p.amount), 0)
      return [{ ...ps[0], amount: round2(Math.max(0, num(v) - others)) }, ...ps.slice(1)]
    })
  }
  const setPay = (i, field, value) => {
    setPays((ps) => {
      const next = ps.map((x, j) => (j === i ? { ...x, [field]: value } : x))
      if (field === 'amount') setGiven(round2(next.reduce((a, p) => a + num(p.amount), 0)))
      return next
    })
  }
  const removePay = (i) => {
    setPays((ps) => {
      const next = ps.filter((_, j) => j !== i)
      setGiven(round2(next.reduce((a, p) => a + num(p.amount), 0)))
      return next
    })
  }

  // a product created from the pop-up goes straight into the invoice
  const onProductAdded = (p) => {
    setAddProduct(false)
    if (p.status !== 'Active') return
    const rate = p[cfg.priceKey || 'sellPrice']
    setLines((ls) => {
      const i = ls.findIndex((l) => !l.productId)
      const line = recalc({ ...(i >= 0 ? ls[i] : emptyLine()), productId: p.id, rate }, p, 'productId')
      return i >= 0 ? ls.map((l, idx) => (idx === i ? line : l)) : [...ls, line]
    })
  }

  const setLine = (i, field, value) => {
    setLines((ls) => ls.map((l, idx) => {
      if (idx !== i) return l
      let next = { ...l, [field]: value }
      if (field === 'productId') {
        const p = productById(value)
        next = { ...next, rate: p ? p[cfg.priceKey || 'sellPrice'] : '' }
      }
      return recalc(next, productById(next.productId), field)
    }))
  }

  const totals = useMemo(() => {
    const subTotal = round2(lines.reduce((a, l) => a + num(l.total), 0))
    let pieces = 0, cartoons = 0, sft = 0
    lines.forEach((l) => {
      const p = productById(l.productId)
      if (!p) return
      pieces += num(l.cart) * (num(p.pcsPerCart) || 1) + num(l.pcs)
      cartoons += num(l.cart)
      if (p.kind === 'Tiles') sft += num(l.qty)
    })
    const vatAmt = vatType === '%' ? (subTotal * num(vat)) / 100 : num(vat)
    const discAmt = discType === '%' ? (subTotal * num(disc)) / 100 : num(disc)
    const laborAmt = cfg.labor ? (autoLabor ? cartoons * LABOR_PER_CARTOON : num(labor)) : 0
    const raw = subTotal + vatAmt - discAmt + laborAmt
    const invoiceAmount = ROUND_TOTAL ? Math.round(raw) : round2(raw)
    const payable = round2(invoiceAmount + (cfg.stock !== 0 && cfg.party ? prevDue : 0)) // T/Payable
    const givenAmt = cfg.payments ? round2(num(given)) : 0
    const rowsTotal = cfg.payments ? round2(pays.reduce((a, p) => a + num(p.amount), 0)) : 0
    const change = round2(Math.max(0, givenAmt - Math.max(0, payable)))
    const paid = round2(givenAmt - change) // what the shop keeps
    const due = round2(invoiceAmount - paid) // below 0 = part of the previous due was paid off
    return { subTotal, pieces, cartoons, sft: round2(sft), vatAmt, discAmt, laborAmt, invoiceAmount, payable, given: givenAmt, rowsTotal, change, paid, due }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, vat, vatType, disc, discType, labor, autoLabor, pays, given, prevDue, products])

  // Returns: pick an earlier invoice to copy its lines
  const sourceDocs = cfg.source ? state[cfg.source].filter((d) => !contactId || d.contactId === contactId) : []
  const loadSource = (id) => {
    setSourceId(id)
    const doc = state[cfg.source].find((d) => d.id === id)
    if (!doc) return
    setContactId(doc.contactId || '')
    setLines(doc.items.map((it) => recalc({ ...emptyLine(), ...it }, productById(it.productId), 'qty')))
  }

  const reset = () => {
    setContactId(''); setWalk({ name: '', address: '', phone: '' }); setRefId(''); setNote(''); setSourceId('')
    setLines([emptyLine()]); setVat(''); setDisc(0); setDiscNote(''); setLabor(''); setGiven(0); setPays([emptyPay()]); setError(''); setSms(false)
  }

  const [saving, setSaving] = useState(false)
  const save = async (print) => {
    const items = lines.filter((l) => l.productId && num(l.qty) > 0)
    if (!items.length) { setError('Add at least one product with a quantity.'); return }
    if (cfg.payments && totals.rowsTotal !== totals.given) {
      setError(`The Paid amounts add up to ${money(totals.rowsTotal)} but Given is ${money(totals.given)}. They must be the same.`); return
    }
    if (saving) return
    setSaving(true)
    setError('')
    const enteredPays = cfg.payments ? pays.filter((p) => num(p.amount) > 0).map((p) => ({ ...p, amount: num(p.amount) })) : []
    const body = {
      date, note, sourceId,
      contactId: contactId || '',
      contactName: contact ? contact.name : walk.name || cfg.walkIn || '',
      phone: contact ? contact.phone : walk.phone,
      address: contact ? contact.address : walk.address,
      referenceId: refId,
      items: items.map(({ key, ...l }) => {
        const p = productById(l.productId) || {}
        return { ...l, name: p.name, code: p.code, size: p.size, grade: p.grade, kind: p.kind, qty: num(l.qty), rate: num(l.rate) }
      }),
      subTotal: totals.subTotal, vat: totals.vatAmt, discount: totals.discAmt, discountNote: discNote.trim(),
      vatType, vatInput: vat, discType, discInput: disc, autoLabor,
      laborCost: totals.laborAmt, invoiceAmount: totals.invoiceAmount, previousDue: prevDue,
      payments: netPayments(enteredPays, totals.change), givenPayments: enteredPays,
      paid: totals.paid, due: totals.due, given: totals.given, change: totals.change, sms,
      delivered: editDoc ? !!editDoc.delivered : false,
    }
    const doc = editDoc ? await db.updateDocument(cfg.collection, editDoc.id, body) : await db.saveDocument(cfg.collection, body)
    setSaving(false)
    if (!doc) return // error already shown
    toast.success(`${cfg.title} ${doc.number} ${editDoc ? 'updated' : 'saved'} successfully.`)
    if (editDoc) {
      if (print) setPrintDoc({ ...doc, title: cfg.title, afterClose: cfg.listPath })
      else nav(cfg.listPath)
      return
    }
    reset()
    if (print) setPrintDoc({ ...doc, title: cfg.title })
  }

  const partyLabel = cfg.party?.includes('supplier') ? 'Supplier' : 'Customer'
  const isWalkIn = cfg.party && !contactId

  return (
    <>
      <div className="bg-white rounded shadow-sm p-4 mb-6">
        {/* header */}
        <div className="bg-[#f2f2f5] p-3 grid grid-cols-1 md:grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto_1fr] gap-x-4 gap-y-2 items-center text-[13px]">
          {cfg.party && (
            <>
              <span className="font-medium">{partyLabel} *</span>
              <div className="flex gap-1">
                <Combo className="flex-1" value={contactId} onChange={setContactId} placeholder={cfg.walkIn}
                  options={[{ value: '', label: cfg.walkIn }, ...parties.map((c) => ({ value: c.id, label: `${c.name} - ${c.phone}` }))]} />
                <Button onClick={() => setQuickAdd(true)} className="!px-4"><Plus size={16} /></Button>
              </div>
            </>
          )}
          {cfg.reference ? (
            <>
              <span className="font-medium">Ref.</span>
              <Combo value={refId} onChange={setRefId} placeholder="Select Reference" options={[{ value: '', label: 'Select Reference' }, ...references.map((r) => ({ value: r.id, label: r.name }))]} />
            </>
          ) : cfg.source ? (
            <>
              <span className="font-medium">Invoice</span>
              <Select value={sourceId} onChange={(e) => loadSource(e.target.value)} placeholder="--Load from invoice--"
                options={sourceDocs.map((d) => ({ value: d.id, label: `${d.number} (${d.contactName})` }))} />
            </>
          ) : cfg.party ? (
            <>
              <span className="font-medium">Paya.</span>
              <Input value={money(prevDue)} disabled />
            </>
          ) : null}
          <span className="font-medium">{cfg.party ? (cfg.reference ? 'Rec.' : 'Note') : 'Note'}</span>
          {cfg.reference ? <Input value={editDoc ? editDoc.number : state[cfg.collection].length + 1} disabled /> : <Input value={note} onChange={(e) => setNote(e.target.value)} />}
          <span className="font-medium">Date *</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          {isWalkIn && cfg.reference && (
            <>
              <span className="font-medium">Name</span>
              <Input placeholder={`${partyLabel} Name`} value={walk.name} onChange={(e) => setWalk({ ...walk, name: e.target.value })} />
              <span className="font-medium">Address</span>
              <Input placeholder="Address" value={walk.address} onChange={(e) => setWalk({ ...walk, address: e.target.value })} />
              <span className="font-medium">Pho.</span>
              <Input placeholder="Phone" value={walk.phone} onChange={(e) => setWalk({ ...walk, phone: e.target.value })} />
              <span />
              <div />
            </>
          )}
          {contact && (
            <div className="md:col-span-8 text-gray-600">
              {contact.address} {contact.phone && `| ${contact.phone}`} | Previous balance: <b>{money(prevDue)}</b>
            </div>
          )}
          <div className="md:col-span-8 flex gap-2">
            <Button color="success" onClick={() => setLines((ls) => [...ls, emptyLine()])} className="!px-6"><Plus size={16} /></Button>
            <Button onClick={() => setAddProduct(true)} title="Create a new product">Add Product</Button>
            {editDoc && <span className="self-center ml-auto font-medium text-warning">Editing {editDoc.number}</span>}
          </div>
        </div>

        {/* lines */}
        <div className="bg-[#d4d4d4] p-3 min-h-[200px] overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="text-left font-medium">
                <th className="pb-1 w-[24%]">Product *</th>
                <th className="pb-1">SFT/Qty *</th>
                <th className="pb-1">Cart</th>
                <th className="pb-1">PCS</th>
                <th className="pb-1">Rate *</th>
                <th className="pb-1 w-20"></th>
                <th className="pb-1">Discount</th>
                <th className="pb-1">Total</th>
                <th className="pb-1 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const p = productById(l.productId)
                return (
                  <tr key={l.key}>
                    <td className="pr-2 py-1">
                      <Combo value={l.productId} onChange={(v) => setLine(i, 'productId', v)} placeholder="--Select Product--" options={productOpts} />
                      {p && <div className="text-[11px] text-gray-600 mt-0.5">Stock: {round2(p.stock)} {p.kind === 'Tiles' ? 'SFT' : 'PCS'}</div>}
                    </td>
                    <td className="pr-2 py-1 align-top"><Input type="number" placeholder="SFT/Quantity" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} /></td>
                    <td className="pr-2 py-1 align-top"><Input type="number" placeholder="Cartoon" value={l.cart} onChange={(e) => setLine(i, 'cart', e.target.value)} /></td>
                    <td className="pr-2 py-1 align-top"><Input type="number" placeholder="PCS" value={l.pcs} onChange={(e) => setLine(i, 'pcs', e.target.value)} /></td>
                    <td className="pr-2 py-1 align-top"><Input type="number" placeholder="Rate" value={l.rate} onChange={(e) => setLine(i, 'rate', e.target.value)} /></td>
                    <td className="pr-2 py-1 align-top"><Select value={l.discountType} onChange={(e) => setLine(i, 'discountType', e.target.value)} options={['%', 'BDT']} /></td>
                    <td className="pr-2 py-1 align-top"><Input type="number" placeholder="Discount" value={l.discount} onChange={(e) => setLine(i, 'discount', e.target.value)} /></td>
                    <td className="pr-2 py-1 align-top"><Input placeholder="Total" value={l.total || ''} readOnly /></td>
                    <td className="py-1 align-top">
                      <Button color="danger" className="w-full" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : [emptyLine()]))}><Trash2 size={15} /></Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* totals */}
        <div className="bg-[#f2f2f5] p-4 grid md:grid-cols-3 gap-x-8 gap-y-2 text-[13px]">
          <div className="space-y-2">
            <Row label="Sub Total"><Input value={totals.subTotal || ''} readOnly /></Row>
            <Row label="VAT">
              <div className="flex gap-1"><Select className="!w-20" value={vatType} onChange={(e) => setVatType(e.target.value)} options={['%', 'BDT']} /><Input type="number" value={vat} onChange={(e) => setVat(e.target.value)} /></div>
            </Row>
            {mode === 'sale' && <>
              <Row label="Total SFT"><Input value={totals.sft || ''} readOnly /></Row>
              <Row label="Total Cartoon"><Input value={totals.cartoons || ''} readOnly /></Row>
              <Row label="Auto Labor Cost"><input type="checkbox" checked={autoLabor} onChange={(e) => setAutoLabor(e.target.checked)} /></Row>
            </>}
          </div>
          <div className="space-y-2">
            <Row label="Discount">
              <div className="flex gap-1"><Select className="!w-20" value={discType} onChange={(e) => setDiscType(e.target.value)} options={['BDT', '%']} /><Input type="number" value={disc} onChange={(e) => setDisc(e.target.value)} /></div>
            </Row>
            <Row label="Dis. Note"><Input placeholder="Discount Note" value={discNote} onChange={(e) => setDiscNote(e.target.value)} /></Row>
            {mode === 'sale' && <>
              <Row label="Total PCS"><Input value={totals.pieces} readOnly /></Row>
              <Row label="Labor Cost"><Input type="number" placeholder="Labour Cost" value={autoLabor ? totals.laborAmt : labor} disabled={autoLabor} onChange={(e) => setLabor(e.target.value)} /></Row>
            </>}
          </div>
          <div className="space-y-2">
            <Row label="Invoice Amount"><Input value={totals.invoiceAmount || ''} readOnly /></Row>
            {cfg.payments && <>
              <Row label="T/Payable"><Input value={totals.payable || ''} readOnly /></Row>
              <Row label="Given"><Input type="number" value={given} onChange={(e) => changeGiven(e.target.value)} onFocus={(e) => e.target.select()} /></Row>
              <Row label="Change"><Input value={totals.change} readOnly className={totals.change > 0 ? '!font-semibold !text-success' : ''} /></Row>
              <Row label="Invoice Due"><Input placeholder="Due Amount" value={Math.max(0, totals.due)} readOnly /></Row>
            </>}
            {cfg.party && <label className="flex items-center gap-2 font-medium pt-1">Send SMS <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} /></label>}
          </div>
        </div>

        {/* payments */}
        {cfg.payments && (
          <div className="bg-[#d4d4d4] p-3 mt-0 overflow-x-auto">
            <table className="w-full min-w-[700px] text-[13px]">
              <thead>
                <tr className="text-left font-medium">
                  <th className="pb-1">Paid *</th><th className="pb-1">Paid Through *</th><th className="pb-1">Acc/Info</th><th className="pb-1">Note</th><th className="pb-1 text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody>
                {pays.map((p, i) => (
                  <tr key={i}>
                    <td className="pr-2 py-1"><Input type="number" value={p.amount} onChange={(e) => setPay(i, 'amount', e.target.value)} onFocus={(e) => e.target.select()} /></td>
                    <td className="pr-2 py-1"><Select value={p.method} onChange={(e) => setPay(i, 'method', e.target.value)} options={PAYMENT_METHODS} /></td>
                    <td className="pr-2 py-1"><Input placeholder="Account Information" value={p.info} onChange={(e) => setPay(i, 'info', e.target.value)} /></td>
                    <td className="pr-2 py-1"><Input placeholder="note" value={p.note} onChange={(e) => setPay(i, 'note', e.target.value)} /></td>
                    <td className="py-1">
                      {i === 0
                        ? <Button color="success" className="w-full" onClick={() => setPays((ps) => [...ps, emptyPay()])}><Plus size={16} /></Button>
                        : <Button color="danger" className="w-full" onClick={() => removePay(i)}><Trash2 size={15} /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totals.rowsTotal !== totals.given && (
              <p className="text-danger text-[12px] mt-1">Paid total ({money(totals.rowsTotal)}) must be equal to Given ({money(totals.given)}).</p>
            )}
          </div>
        )}

        {error && <p className="text-danger text-[13px] mt-3">{error}</p>}
        <div className="flex gap-1 mt-3">
          <Button disabled={saving} onClick={() => save(false)}>{editDoc ? 'Update' : 'Save'}</Button>
          <Button disabled={saving} color="success" onClick={() => save(true)}>{editDoc ? 'Update' : 'Save'} &amp; Print</Button>
          <Button color="secondary" onClick={() => nav(cfg.listPath)}>Close</Button>
        </div>
      </div>

      <QuickContact open={quickAdd} type={cfg.party?.[0]} onClose={() => setQuickAdd(false)} onSaved={(c) => { setContactId(c.id); setQuickAdd(false) }} />
      <Modal open={addProduct} onClose={() => setAddProduct(false)} title="Add New Product" wide>
        {addProduct && <ProductForm compact onSaved={onProductAdded} onCancel={() => setAddProduct(false)} />}
      </Modal>
      <Modal open={!!printDoc} onClose={() => { const to = printDoc?.afterClose; setPrintDoc(null); if (to) nav(to) }} title="Print" wide>
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

export function QuickContact({ open, type = 'customer', onClose, onSaved }) {
  const [f, setF] = useState({ name: '', phone: '', address: '' })
  const save = async () => {
    if (!f.name.trim()) return
    const c = await db.insert('contacts', { ...f, type, organization: '', altPhone: '', nid: '', openingBalance: 0 })
    if (!c) return
    setF({ name: '', phone: '', address: '' })
    onSaved(c)
  }
  return (
    <Modal open={open} onClose={onClose} title={`Add ${type}`}>
      <div className="space-y-3">
        <Field label="Name" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Mobile Number"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Address"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <div className="flex gap-1"><Button onClick={save}>Save</Button><Button color="secondary" onClick={onClose}>Close</Button></div>
      </div>
    </Modal>
  )
}
