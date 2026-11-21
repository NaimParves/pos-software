import { Printer } from 'lucide-react'
import { DEALER_BRANDS, INVOICE_TERMS } from '../config/shop'
import { paint } from '../config/templates'
import { Button } from './ui'
import { useCollection } from '../store/db'
import { useShop, useTemplate } from '../store/shop'
import { displayDate, round2 } from '../utils/format'
import { amountInWords } from '../utils/words'

// 816.666 -> "816.67", 2400 -> "2400" (no forced decimals, like the shop's printed invoices)
const n = (v) => String(round2(v))
// "S-0010" -> "000010"
const docNo = (num) => String(num || '').replace(/\D/g, '').padStart(6, '0')

const hideBroken = (e) => { e.currentTarget.style.display = 'none' }

// Dealer logos sized to share the row, whatever their number or shape
export function DealerLogos({ dealers }) {
  if (!dealers?.length) return null
  const share = `${Math.floor(100 / dealers.length) - 2}%`
  return (
    <div className="flex-1 flex items-center justify-around gap-3 min-w-0">
      {dealers.map((b, i) => (
        <img key={`${b.name}-${i}`} src={b.logo} alt={b.name} onError={hideBroken} className="max-h-[56px] object-contain" style={{ maxWidth: share }} />
      ))}
    </div>
  )
}

// Printable A4 invoice / memo. `challan` prints a delivery challan (no prices).
// kind: template category (see config/templates.js); the chosen design,
// colour or gradient, banner, dealer logos, terms and notes come from Basic
// Settings > Template Settings. `template` overrides the saved design (live preview).
export default function InvoicePrint({ doc, challan = false, kind = 'sale', title, template, hideButton = false }) {
  const products = useCollection('products')
  const shop = useShop()
  const saved = useTemplate(kind)
  const t = template || saved
  const color = t.color || '#ec6a1f'
  const fill = paint(t)
  const design = t.design || 'classic'
  const isReturn = kind === 'salesReturn' || kind === 'directReturn'

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
  const labor = Number(doc.laborCost || 0)

  // Totals block. Returns: Invoice Amount (value of the goods returned),
  // Previous Discount (their share of the original discount), Return Amount,
  // Return Paid, the customer's Previous Due and Total Due = Previous Due - Return Paid.
  const returnRows = [
    ['Invoice Amount', Number(doc.subTotal ?? payable + discount)],
    ['Previous Discount', Number(doc.less ?? discount)],
    ['Return Amount', payable],
    ['Return Paid', paid],
    ['Previous Due', prevDue],
    ['Total Due', Math.max(0, prevDue - paid)],
  ]
  const summary = isReturn ? returnRows : doc.noPayments ? [
    ['Labor Cost', labor],
    ...(Number(doc.vat) ? [['VAT', doc.vat]] : []),
    ['Total', payable + discount],
    ['Discount', discount],
    ['Payable', payable],
  ] : [
    ['Labor Cost', labor],
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
  // Two Column Layout: adjustments on the left, the main bill and balance on the right
  const twoCol = isReturn
    ? { left: ['Return Calculation', returnRows.slice(0, 3)], right: ['Payment & Balance', returnRows.slice(3)] }
    : doc.noPayments
      ? { left: ['Adjustments', [['(+) Labor Cost', labor], ['(−) Discount', discount]]], right: ['Main Summary', [['Total', payable + discount], ['Payable', payable]]] }
      : {
        left: ['Adjustments', [['(+) Labor Cost', labor], ...(Number(doc.vat) ? [['(+) VAT', doc.vat]] : []), ['(−) Discount', discount], ['(+) Previous Due', prevDue], ['(=) Total Due', totalDue]]],
        right: ['Main Summary', [['Total', payable + discount], ['Payable', payable], ['Paid', paid], ['Due Balance', totalDue - paid]]],
      }

  // Discount note (and the header note, where the form has one) printed under the totals
  const notes = [doc.discountNote, doc.note].map((x) => String(x || '').trim()).filter(Boolean)
  const cols = challan
    ? ['NO', 'Size', 'Grade', 'Product Code', 'Boxes', 'Pcs', 'Quantity/Square Feet']
    : ['NO', 'Size', 'Grade', 'Product Code', 'Boxes', 'Pcs', 'Quantity/Square Feet', 'Rate', 'Amount']
  const docTitle = challan ? 'Challan' : t.title || title || 'Invoice'
  const simple = design === 'simple'
  const cell = `border ${simple ? 'border-gray-400' : 'border-gray-500'} px-2 py-[3px]`
  const headBg = simple ? { background: '#f3f4f6', color: '#111827' } : { background: fill, color: '#fff' }
  const mobiles = shop.mobiles?.length ? shop.mobiles : [shop.phone]
  const contactLine = [shop.email, shop.website].filter(Boolean).join(' | ')
  const dealers = t.dealers ?? DEALER_BRANDS
  const showDealers = t.showDealers !== false && dealers.length > 0
  const terms = (t.terms ?? INVOICE_TERMS).filter((x) => String(x).trim())
  const showTerms = t.showTerms !== false && terms.length > 0
  const highlight = (label) => ['Payable', 'Return Amount', 'Due Balance', 'Total Due'].includes(label)

  // An uploaded banner replaces the whole header: only the banner is printed there
  const header = t.banner ? (
    <div className="mt-2"><img src={t.banner} alt="" onError={hideBroken} className="w-full max-h-48 object-contain" /></div>
  ) : {
    classic: (
      <div className="relative border-2 mt-4" style={t.gradient ? { borderImage: `${fill} 1` } : { borderColor: color }}>
        <span className="absolute left-1/2 -translate-x-1/2 -top-[14px] bg-white border-2 border-[#2f3a4a] rounded-[50%] px-6 py-0.5 text-[12px] tracking-wide uppercase">{docTitle}</span>
        <div className="flex items-center gap-3 px-3 pt-5 pb-2">
          {shop.logo && <img src={shop.logo} alt="" onError={hideBroken} className="w-[78px] h-auto shrink-0" />}
          <h1 className="flex-1 text-center font-bold leading-[1.15] text-[34px]" style={{ color }}>{shop.name}</h1>
          <div className="shrink-0 text-center font-bold text-[15px] leading-6 pr-2">
            <div>MOBILE</div>
            {mobiles.map((m) => <div key={m} className="text-[17px]">{m}</div>)}
          </div>
        </div>
        <div className="border-t border-gray-400 text-center font-semibold text-[13px] py-1">
          {shop.address}{contactLine && <span className="font-normal"> · {contactLine}</span>}
        </div>
        {(t.headerNote || shop.dealer) && <div className="border-t border-gray-300 text-center text-[12px] py-0.5">{t.headerNote || shop.dealer}</div>}
      </div>
    ),
    modern: (
      <div className="mt-2">
        <div className="flex items-center gap-4 px-5 py-4 text-white" style={{ background: fill }}>
          {shop.logo && <img src={shop.logo} alt="" onError={hideBroken} className="h-16 max-w-[160px] object-contain bg-white rounded p-1" />}
          <div className="flex-1">
            <h1 className="font-bold text-[28px] leading-tight">{shop.name}</h1>
            <p className="text-[12px] opacity-90">{shop.address}</p>
            <p className="text-[12px] opacity-90">{[mobiles.join(', '), contactLine].filter(Boolean).join(' | ')}</p>
          </div>
          <div className="text-right">
            <p className="uppercase tracking-widest text-[13px] font-semibold bg-white/20 rounded px-3 py-1">{docTitle}</p>
          </div>
        </div>
        {(t.headerNote || shop.dealer) && <div className="text-center text-[12px] py-1 border-b" style={{ color }}>{t.headerNote || shop.dealer}</div>}
      </div>
    ),
    simple: (
      <div className="text-center mt-2 pb-2 border-b-2 border-gray-800">
        <h1 className="font-bold text-[24px] text-gray-900">{shop.name}</h1>
        <p className="text-[12px]">{shop.address}</p>
        <p className="text-[12px]">{[mobiles.join(', '), contactLine].filter(Boolean).join(' | ')}</p>
        {(t.headerNote || shop.dealer) && <p className="text-[12px] italic">{t.headerNote || shop.dealer}</p>}
        <p className="mt-1 inline-block border border-gray-800 px-4 text-[12px] font-semibold uppercase tracking-wider">{docTitle}</p>
      </div>
    ),
  }[design] || null

  const box = (heading, rows, right) => (
    <table className="w-full border-collapse text-[13px]">
      <thead><tr><th colSpan={2} className={`${cell} text-left font-semibold`} style={right && !simple ? headBg : { background: '#f3f4f6' }}>{heading}</th></tr></thead>
      <tbody>
        {rows.map(([label, value], i) => {
          const strong = right && i === rows.length - 1
          return (
            <tr key={label} className={strong || label.startsWith('(=)') ? 'font-bold' : ''} style={strong && !simple ? { background: fill, color: '#fff' } : undefined}>
              <td className={cell}>{label}</td><td className={`${cell} text-right w-28`}>{n(value)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  return (
    <div>
      {!hideButton && (
        <div className="flex justify-end mb-3 print:hidden">
          <Button onClick={() => window.print()}><Printer size={15} /> Print</Button>
        </div>
      )}

      <div className="print-area invoice-a4 bg-white text-[13px] text-gray-800 mx-auto" style={{ fontFamily: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif' }}>
        {header}

        {/* dealers / numbers row */}
        <div className="flex items-end justify-between gap-3 mt-3 px-8">
          <div className="shrink-0">
            {showDealers && (
              <div className="inline-block text-white font-bold text-[17px] px-1.5 py-1 mb-4" style={{ background: simple ? '#374151' : fill }}>Dealers:</div>
            )}
            <div className="text-[11px] tracking-wide"><b>{challan ? 'Challan No' : `${docTitle} No`} :</b> {docNo(doc.number)}</div>
            {doc.challanNo && <div className="text-[11px] tracking-wide"><b>Challan Number :</b> {doc.challanNo}</div>}
          </div>
          {showDealers ? <DealerLogos dealers={dealers} /> : <div className="flex-1" />}
          <div className="shrink-0 text-[11px] tracking-wide"><b>Date:</b> {displayDate(doc.date)}</div>
        </div>

        {/* customer / supplier */}
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
              <tr style={headBg}>
                {cols.map((c) => <th key={c} className="border border-gray-500 px-1 py-[3px] font-semibold whitespace-nowrap">{c}</th>)}
              </tr>
            </thead>
            <tbody className="text-center">
              {lines.map((l, i) => (
                <tr key={i} className={design === 'modern' && i % 2 ? 'bg-gray-50' : ''}>
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
                {!challan && <><td className={cell} /><td className={cell}>{n(lines.reduce((a, l) => a + Number(l.total || 0), 0))}</td></>}
              </tr>
              {!challan && !t.twoColumn && summary.map(([label, value]) => (
                <tr key={label} className="font-bold" style={highlight(label) && !simple ? { background: `${color}22` } : undefined}>
                  <td colSpan={8} className={`${cell} text-right`}>{label}</td>
                  <td className={cell}>{n(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!challan && t.twoColumn && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              {box(...twoCol.left, false)}
              {box(...twoCol.right, true)}
            </div>
          )}

          {notes.length > 0 && (
            <div className="flex mt-4 border border-gray-600 text-[14px]">
              <div className="bg-gray-200 border-r border-gray-600 px-4 py-1 font-semibold text-gray-600">Note</div>
              <div className="px-3 py-1 whitespace-pre-wrap">{notes.join(' | ')}</div>
            </div>
          )}

          {!challan && (
            <div className={`flex ${notes.length ? 'mt-2' : 'mt-6'} border border-gray-600 text-[14px] font-semibold`}>
              <div className="bg-gray-200 border-r border-gray-600 px-4 py-1 text-gray-600">In Words</div>
              <div className="px-3 py-1">{amountInWords(payable, shop.currencyWord)}</div>
            </div>
          )}

          {showTerms && (
            <ol className="list-decimal border-2 mt-11 pl-10 pr-3 py-2 font-semibold text-[14px] leading-6" style={{ borderColor: simple ? '#374151' : color }}>
              {terms.map((x, i) => <li key={i}>{x}</li>)}
            </ol>
          )}
          {t.footerNote && <p className="text-center text-[12px] mt-4 whitespace-pre-wrap">{t.footerNote}</p>}
        </div>

        {/* signatures */}
        <div className="flex justify-between items-end mt-32 pb-6 px-1 text-[12px] font-semibold tracking-wide">
          <span className="border-t border-gray-700 pt-1 pr-6 ml-6">{challan ? "Receiver's Signature" : "Customer's Signature"}</span>
          <span className="border-t border-gray-700 pt-1 pl-6">For-{shop.name}</span>
        </div>
      </div>
    </div>
  )
}
