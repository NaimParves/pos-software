import { User } from 'lucide-react'

// Summary card used on every page with a summary row (accounts, loans,
// dashboards, damages, payroll): a soft colour, a meaningful icon, the amount
// in bold with the ৳ sign, and a short caption. tone: indigo | green | amber |
// red | sky | gray.
const TONES = {
  indigo: { card: 'bg-indigo-50 border-indigo-200', icon: 'bg-indigo-500', text: 'text-indigo-900' },
  green: { card: 'bg-emerald-50 border-emerald-200', icon: 'bg-emerald-500', text: 'text-emerald-900' },
  amber: { card: 'bg-amber-50 border-amber-200', icon: 'bg-amber-500', text: 'text-amber-900' },
  red: { card: 'bg-rose-50 border-rose-200', icon: 'bg-rose-500', text: 'text-rose-900' },
  sky: { card: 'bg-sky-50 border-sky-200', icon: 'bg-sky-500', text: 'text-sky-900' },
  gray: { card: 'bg-white border-gray-200', icon: 'bg-gray-400', text: 'text-gray-800' },
}

export const taka = (v) => `৳ ${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function StatCard({ label, value, caption, icon: Icon, tone = 'gray', currency = true, action }) {
  const t = TONES[tone] || TONES.gray
  return (
    <div className={`rounded-lg border shadow-sm p-4 flex items-start justify-between gap-3 ${t.card}`}>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-gray-600">{label}</p>
        <p className={`text-[20px] font-bold mt-1 leading-tight ${t.text}`}>{currency ? taka(value) : value}</p>
        {caption && <p className="text-[11px] text-gray-500 mt-0.5">{caption}</p>}
        {action}
      </div>
      {Icon && <span className={`w-10 h-10 rounded-lg text-white flex items-center justify-center shrink-0 ${t.icon}`}><Icon size={19} /></span>}
    </div>
  )
}

// First card: who is selected (name, mobile) or a clear prompt when nobody is
export function PersonCard({ person, emptyText, badge }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 flex items-center gap-3 relative">
      {badge && person && <span className="absolute top-2 right-2 text-[10px] font-medium text-success border border-success/40 rounded px-1.5">{badge}</span>}
      <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${person ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
        {person?.image ? <img src={person.image} alt="" className="w-11 h-11 rounded-full object-cover" /> : <User size={20} />}
      </span>
      <div className="min-w-0 text-[13px]">
        {person ? (
          <>
            <p className="font-bold text-[15px] text-gray-800 truncate">{person.name}</p>
            <p className="text-gray-500 truncate">{person.phone ? `Phone: ${person.phone}` : 'No phone number'}</p>
            {person.address && <p className="text-gray-400 truncate">{person.address}</p>}
          </>
        ) : <p className="text-gray-500">{emptyText}</p>}
      </div>
    </div>
  )
}
