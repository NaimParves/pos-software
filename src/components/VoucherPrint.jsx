import { Printer } from 'lucide-react'
import { Button } from './ui'
import { useShop, useTemplate } from '../store/shop'
import { displayDate, money } from '../utils/format'
import { amountInWords } from '../utils/words'

const hideBroken = (e) => { e.currentTarget.style.display = 'none' }

// Money receipt / payment voucher for payments, advances, settlements and loans.
// rec: { number, date, contactName, phone, address, amount, discount, method, info, note }
// kind: template category; the design comes from Template Settings.
export default function VoucherPrint({ rec, kind = 'receive', title = 'Money Receipt', partyLabel = 'Received From', template, hideButton = false }) {
  const shop = useShop()
  const saved = useTemplate(kind)
  const t = template || saved
  const color = t.color || '#ec6a1f'
  const design = t.design || 'classic'
  const simple = design === 'simple'
  const docTitle = t.title || title
  const amount = Number(rec.amount || 0)
  const discount = Number(rec.discount || 0)
  const contactLine = [shop.phone, shop.email, shop.website].filter(Boolean).join(' | ')
  const row = (label, value) => (
    <div className="flex border-b border-dashed border-gray-400 py-1.5">
      <span className="w-40 font-semibold shrink-0">{label}</span><span className="flex-1">{value}</span>
    </div>
  )

  return (
    <div>
      {!hideButton && (
        <div className="flex justify-end mb-3 print:hidden">
          <Button onClick={() => window.print()}><Printer size={15} /> Print</Button>
        </div>
      )}
      <div className="print-area invoice-a4 bg-white text-[14px] text-gray-800 mx-auto">
        {design === 'modern' ? (
          <div className="flex items-center gap-4 px-5 py-4 text-white" style={{ background: color }}>
            {(t.banner || shop.logo) && <img src={t.banner || shop.logo} alt="" onError={hideBroken} className="h-14 max-w-[150px] object-contain bg-white rounded p-1" />}
            <div className="flex-1">
              <h1 className="font-bold text-[24px] leading-tight">{shop.name}</h1>
              <p className="text-[12px] opacity-90">{shop.address}</p>
              <p className="text-[12px] opacity-90">{contactLine}</p>
            </div>
            <p className="uppercase tracking-widest text-[13px] font-semibold bg-white/20 rounded px-3 py-1">{docTitle}</p>
          </div>
        ) : (
          <div className={`text-center pb-2 ${simple ? 'border-b-2 border-gray-800' : 'border-2 pt-3'}`} style={simple ? undefined : { borderColor: color }}>
            {t.banner && <img src={t.banner} alt="" onError={hideBroken} className="mx-auto max-h-20 mb-1" />}
            <div className="flex items-center justify-center gap-3">
              {!simple && shop.logo && <img src={shop.logo} alt="" onError={hideBroken} className="h-14" />}
              <h1 className="font-bold text-[26px]" style={simple ? undefined : { color }}>{shop.name}</h1>
            </div>
            <p className="text-[12px]">{shop.address}</p>
            <p className="text-[12px]">{contactLine}</p>
            <p className="mt-2 inline-block border px-5 py-0.5 text-[13px] font-semibold uppercase tracking-wider" style={simple ? { borderColor: '#1f2937' } : { borderColor: color, color }}>{docTitle}</p>
          </div>
        )}
        {(t.headerNote || shop.dealer) && <p className="text-center text-[12px] mt-1">{t.headerNote || shop.dealer}</p>}

        <div className="flex justify-between mt-5 px-2 text-[13px]">
          <span><b>Voucher No :</b> {rec.number}</span>
          <span><b>Date :</b> {displayDate(rec.date)}</span>
        </div>
        <div className="mt-3 px-2">
          {row(partyLabel, <>{rec.contactName}{rec.phone ? ` (${rec.phone})` : ''}</>)}
          {rec.address && row('Address', rec.address)}
          {row('Amount', <b>{money(amount)} {shop.currency}</b>)}
          {discount > 0 && row('Discount', `${money(discount)} ${shop.currency}`)}
          {row('In Words', amountInWords(amount, shop.currencyWord))}
          {row('Paid Through', [rec.method, rec.info].filter(Boolean).join(' - ') || 'Cash')}
          {rec.note && row('Note', rec.note)}
          {rec.balanceAfter !== undefined && row('Balance', money(rec.balanceAfter))}
        </div>
        {t.footerNote && <p className="text-center text-[12px] mt-4 whitespace-pre-wrap">{t.footerNote}</p>}
        <div className="flex justify-between items-end mt-24 pb-6 px-4 text-[12px] font-semibold">
          <span className="border-t border-gray-700 pt-1 px-4">Receiver&apos;s Signature</span>
          <span className="border-t border-gray-700 pt-1 px-4">For-{shop.name}</span>
        </div>
      </div>
    </div>
  )
}
