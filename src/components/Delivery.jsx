import { useState } from 'react'
import { Badge, Button, Modal } from './ui'
import { db } from '../store/db'
import { round2 } from '../utils/format'

// Which invoice lines have been handed over. Older invoices only have
// `delivered: true/false`, which counts as all or none of the lines.
export function deliveryState(doc) {
  const n = doc.items?.length || 0
  const lines = Array.isArray(doc.deliveredLines)
    ? doc.items.map((_, i) => !!doc.deliveredLines[i])
    : Array(n).fill(!!doc.delivered)
  const done = lines.filter(Boolean).length
  return { n, done, lines, pct: n ? Math.round((done * 100) / n) : 0, all: n > 0 && done === n }
}

function Bar({ pct, className = '' }) {
  return (
    <span className={`block h-2 rounded-full bg-gray-200 overflow-hidden ${className}`}>
      <span className="block h-full rounded-full bg-info transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
    </span>
  )
}

// "Delivery Confirm" cell: Pending -> progress bar -> Delivered.
// Clicking opens the product list with a tick box per line. The ticks are
// saved on the invoice, so List of Sales and List of Challans always agree.
export function DeliveryButton({ doc, collection = 'sales' }) {
  const [open, setOpen] = useState(false)
  const [ticks, setTicks] = useState([])
  const st = deliveryState(doc)

  const show = () => { setTicks(st.lines); setOpen(true) }
  const save = (next) => {
    setTicks(next)
    db.update(collection, doc.id, { deliveredLines: next, delivered: next.length > 0 && next.every(Boolean) })
  }
  const live = open ? deliveryState({ ...doc, deliveredLines: ticks }) : st

  return (
    <>
      <button onClick={show} title="Tick the delivered products" className="text-left">
        {st.all ? <Badge>Delivered</Badge>
          : st.done === 0 ? <Badge color="warning">Pending</Badge>
            : (
              <span className="inline-flex flex-col gap-0.5 w-24" aria-label={`${st.done} of ${st.n} delivered`}>
                <Bar pct={st.pct} />
                <span className="text-[11px] text-info">{st.done}/{st.n} delivered</span>
              </span>
            )}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Delivery — ${doc.number} (${doc.contactName || ''})`} wide>
        <div className="flex items-center gap-3 mb-3 text-[13px]">
          <Bar pct={live.pct} className="flex-1 !h-3" />
          <span className={live.all ? 'text-success font-semibold' : 'text-gray-600'}>
            {live.all ? 'Delivered' : `${live.done} of ${live.n} delivered`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px] border">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 w-10">
                  <input type="checkbox" aria-label="Tick all" checked={live.all} onChange={(e) => save(doc.items.map(() => e.target.checked))} />
                </th>
                <th className="px-3 py-2 text-left">SL</th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Size</th>
                <th className="px-3 py-2 text-right">Cart</th>
                <th className="px-3 py-2 text-right">PCS</th>
                <th className="px-3 py-2 text-right">SFT/Qty</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((it, i) => (
                <tr key={i} className={`border-t cursor-pointer ${ticks[i] ? 'bg-success/10' : 'hover:bg-gray-50'}`}
                  onClick={() => save(ticks.map((t, j) => (j === i ? !t : t)))}>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" aria-label={`Delivered ${it.name}`} checked={!!ticks[i]} readOnly className="pointer-events-none" />
                  </td>
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2">{it.code ? `${it.code} - ` : ''}{it.name}</td>
                  <td className="px-3 py-2">{it.size}</td>
                  <td className="px-3 py-2 text-right">{it.cart || ''}</td>
                  <td className="px-3 py-2 text-right">{it.pcs || ''}</td>
                  <td className="px-3 py-2 text-right">{round2(it.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-4"><Button color="secondary" onClick={() => setOpen(false)}>Close</Button></div>
      </Modal>
    </>
  )
}

// After an invoice is edited, keep the ticks of lines that are still there
// with the same product and no more quantity than before.
export function carryDeliveryTicks(oldDoc, newItems) {
  if (!oldDoc) return { deliveredLines: newItems.map(() => false), delivered: false }
  const old = deliveryState(oldDoc)
  const used = new Set()
  const deliveredLines = newItems.map((it) => {
    const j = oldDoc.items.findIndex((o, k) => !used.has(k) && o.productId === it.productId && Number(it.qty) <= Number(o.qty))
    if (j < 0) return false
    used.add(j)
    return old.lines[j]
  })
  return { deliveredLines, delivered: deliveredLines.length > 0 && deliveredLines.every(Boolean) }
}
