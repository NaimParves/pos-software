import { Printer } from 'lucide-react'
import { SHOP, DEALER_BRANDS, INVOICE_TERMS } from '../config/shop'
import { Button } from './ui'
import { useCollection } from '../store/db'
import { displayDate, round2 } from '../utils/format'
import { amountInWords } from '../utils/words'

const ORANGE = '#ec6a1f'
// 816.666 -> "816.67", 2400 -> "2400" (no forced decimals, like the shop's printed invoices)
const n = (v) => String(round2(v))
// "S-0010" -> "000010"
const docNo = (num) => String(num || '').replace(/\D/g, '').padStart(6, '0')

const hideBroken = (e) => { e.currentTarget.style.display = 'none' }

// Printable A4 invoice. `challan` prints a delivery challan: same layout, no prices.
export default function InvoicePrint({ doc, challan = false }) {
  const products = useCollection('products')
  const lines = doc.items.map((it) => {
    const p = products.find((x) => x.id === it.productId) || {}
    const tiles = (it.kind || p.kind) === 'Tiles' || !!(it.size || p.size)
    return {
      ...it,
      size: it.size || p.size || '',
      grade: it.grade || p.grade || '',
      code: it.code || p.code || it.name,
      unit: tiles ? 'SFT' : 'PCS',
    }
  })
  const totalCart = lines.reduce((a, l) => a + Number(l.cart || 0), 0)
  const totalPcs = lines.reduce((a, l) => a + Number(l.pcs || 0), 0)
  const totalSft = lines.filter((l) => l.unit === 'SFT').reduce((a, l) => a + Number(l.qty || 0), 0)
  const totalOther = lines.filter((l) => l.unit !== 'SFT').reduce((a, l) => a + Number(l.qty || 0), 0)

  const discount = Number(doc.discount || 0)
  const payable = Number(doc.invoiceAmount || 0)
  const prevDue = Number(doc.previousDue || 0)
  const totalDue = payable + prevDue
  const paid = Number(doc.paid || 0)
  const summary = [
    ['Labor Cost', doc.laborCost || 0],
    ...(Number(doc.vat) ? [['VAT', doc.vat]] : []),
    ['Total', payable + discount],
    ['Discount', discount],
    ['Payable', payable],
    ['Previous Due', prevDue],
    ['Total Due', totalDue],
    ['Paid', paid],
    ['Due Balance', totalDue - paid],
    // when the customer handed over more than the total, show what was given back
    ...(Number(doc.change) > 0 ? [['Given', doc.given], ['Change', doc.change]] : []),
  ]
  // Discount note (and the header note, where the form has one) printed under the totals
  const notes = [doc.discountNote, doc.note].map((x) => String(x || '').trim()).filter(Boolean)
  const cols = challan
    ? ['NO', 'Size', 'Grade', 'Product Code', 'Boxes', 'Pcs', 'Quantity/Square Feet']
    : ['NO', 'Size', 'Grade', 'Product Code', 'Boxes', 'Pcs', 'Quantity/Square Feet', 'Rate', 'Amount']
  const cell = 'border border-gray-500 px-2 py-[3px]'

  return (
    <div>
      <div className="flex justify-end mb-3 print:hidden">
        <Button onClick={() => window.print()}><Printer size={15} /> Print</Button>
      </div>

      <div className="print-area invoice-a4 bg-white text-[13px] text-gray-800 mx-auto" style={{ fontFamily: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif' }}>
        {/* header */}
        <div className="relative border-2 mt-4" style={{ borderColor: ORANGE }}>
          <span className="absolute left-1/2 -translate-x-1/2 -top-[14px] bg-white border-2 border-[#2f3a4a] rounded-[50%] px-6 py-0.5 text-[12px] tracking-wide uppercase">
            {challan ? 'Challan' : 'Invoice'}
          </span>
          <div className="flex items-center gap-3 px-3 pt-5 pb-2">
            {SHOP.logo && <img src={SHOP.logo} alt="" onError={hideBroken} className="w-[78px] h-auto shrink-0" />}
            <h1 className="flex-1 text-center font-bold leading-[1.15] text-[34px]" style={{ color: ORANGE }}>{SHOP.name}</h1>
            <div className="shrink-0 text-center font-bold text-[15px] leading-6 pr-2">
              <div>MOBILE</div>
              {(SHOP.mobiles || [SHOP.phone]).map((m) => <div key={m} className="text-[17px]">{m}</div>)}
            </div>
          </div>
          <div className="border-t border-gray-400 text-center font-semibold text-[13px] py-1">{SHOP.address}</div>
        </div>

        {/* dealers row */}
        <div className="flex items-end justify-between gap-3 mt-3 px-8">
          <div className="shrink-0">
            {DEALER_BRANDS.length > 0 && (
              <div className="inline-block text-white font-bold text-[17px] px-1.5 py-1 mb-4" style={{ background: ORANGE }}>Dealers:</div>
            )}
            <div className="text-[11px] tracking-wide"><b>{challan ? 'Challan No' : 'Invoice No'} :</b> {docNo(doc.number)}</div>
          </div>
          <div className="flex-1 flex items-center justify-around gap-4">
            {DEALER_BRANDS.map((b) => (
              <img key={b.name} src={b.logo} alt={b.name} onError={hideBroken} className="max-h-[60px] max-w-[130px] object-contain" />
            ))}
          </div>
          <div className="shrink-0 text-[11px] tracking-wide"><b>Date:</b> {displayDate(doc.date)}</div>
        </div>

        {/* customer */}
        <div className="px-8 mt-6 space-y-1">
          <div className="flex gap-6">
            <div className="flex-1 border border-gray-600 px-1.5 py-1"><b>Name :</b> {doc.contactName}</div>
            <div className="w-[32%] border border-gray-600 px-1.5 py-1"><b>Mobile :</b> {doc.phone}</div>
          </div>
          <div className="border border-gray-600 px-1.5 py-1"><b>Address :</b> {doc.address}</div>
        </div>

        {/* items */}
        <div className="px-8 mt-1">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="text-white" style={{ background: ORANGE }}>
                {cols.map((c) => <th key={c} className="border border-gray-500 px-1 py-[3px] font-semibold whitespace-nowrap">{c}</th>)}
              </tr>
            </thead>
            <tbody className="text-center">
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className={cell}>{i + 1}</td>
                  <td className={cell}>{l.size}</td>
                  <td className={cell}>{l.grade}</td>
                  <td className={cell}>{l.code}</td>
                  <td className={cell}>{Number(l.cart || 0)}</td>
                  <td className={cell}>{Number(l.pcs || 0)}</td>
                  <td className={cell}>{n(l.qty)} {l.unit}</td>
                  {!challan && <>
                    <td className={cell}>{n(l.rate)}</td>
                    <td className={cell}>{n(l.total)}</td>
                  </>}
                </tr>
              ))}
              <tr className="font-bold">
                <td colSpan={4} className={`${cell} text-right`}>Total</td>
                <td className={cell}>{totalCart} Cart</td>
                <td className={cell}>{totalPcs} PCS</td>
                <td className={cell}>
                  {totalSft ? `${n(totalSft)} SFT` : ''}{totalSft && totalOther ? ' + ' : ''}{totalOther ? `${n(totalOther)} PCS` : ''}
                </td>
                {!challan && <><td className={cell} /><td className={cell} /></>}
              </tr>
              {!challan && summary.map(([label, value]) => (
                <tr key={label} className="font-bold">
                  <td colSpan={8} className={`${cell} text-right`}>{label}</td>
                  <td className={cell}>{n(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {notes.length > 0 && (
            <div className="flex mt-4 border border-gray-600 text-[14px]">
              <div className="bg-gray-200 border-r border-gray-600 px-4 py-1 font-semibold text-gray-600">Note</div>
              <div className="px-3 py-1 whitespace-pre-wrap">{notes.join(' | ')}</div>
            </div>
          )}

          {!challan && (
            <div className={`flex ${notes.length ? 'mt-2' : 'mt-6'} border border-gray-600 text-[14px] font-semibold`}>
              <div className="bg-gray-200 border-r border-gray-600 px-4 py-1 text-gray-600">In Words</div>
              <div className="px-3 py-1">{amountInWords(payable, SHOP.currencyWord)}</div>
            </div>
          )}

          {INVOICE_TERMS.length > 0 && (
            <ol className="list-decimal border-2 mt-11 pl-10 pr-3 py-2 font-semibold text-[14px] leading-6" style={{ borderColor: ORANGE }}>
              {INVOICE_TERMS.map((t) => <li key={t}>{t}</li>)}
            </ol>
          )}
        </div>

        {/* signatures */}
        <div className="flex justify-between items-end mt-32 pb-6 px-1 text-[12px] font-semibold tracking-wide">
          <span className="border-t border-gray-700 pt-1 pr-6 ml-6">{challan ? "Receiver's Signature" : "Customer's Signature"}</span>
          <span className="border-t border-gray-700 pt-1 pl-6">For-{SHOP.name}</span>
        </div>
      </div>
    </div>
  )
}
