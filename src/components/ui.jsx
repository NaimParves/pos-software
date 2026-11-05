import { X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { findMenuTrail } from '../config/menu'

export function PageHeader({ title, trail }) {
  const { pathname } = useLocation()
  const crumbs = trail || findMenuTrail(pathname) || [title]
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
      <h4 className="text-[15px] font-semibold uppercase text-gray-700">{title}</h4>
      <div className="text-[13px] text-gray-500">
        {crumbs.slice(-2).map((c, i, arr) => (
          <span key={i}>
            <span className={i === arr.length - 1 ? 'text-gray-400' : ''}>{c}</span>
            {i < arr.length - 1 && <span className="mx-2">/</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Card({ title, children, className = '', actions }) {
  return (
    <div className={`bg-white rounded shadow-sm mb-6 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 pt-5">
          {title && <h5 className="text-[15px] font-medium text-gray-700">{title}</h5>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

const inputCls =
  'w-full border border-gray-300 rounded px-3 py-[7px] text-[13px] text-gray-700 bg-white focus:outline-none focus:border-primary disabled:bg-gray-100 placeholder:text-gray-400'

export function Field({ label, required, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="block text-[13px] font-medium text-gray-700 mb-1.5">
          {label} {required && <span>*</span>}
        </span>
      )}
      {children}
    </label>
  )
}

export function Input({ className = '', ...props }) {
  return <input className={`${inputCls} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${inputCls} ${className}`} rows={3} {...props} />
}

export function Select({ options = [], placeholder, className = '', ...props }) {
  return (
    <select className={`${inputCls} ${className}`} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const value = typeof o === 'object' ? o.value : o
        const label = typeof o === 'object' ? o.label : o
        return <option key={value} value={value}>{label}</option>
      })}
    </select>
  )
}

const btnColors = {
  primary: 'bg-primary hover:bg-[#485ec4] text-white',
  success: 'bg-success hover:bg-[#2ca67a] text-white',
  danger: 'bg-danger hover:bg-[#cf5a5a] text-white',
  secondary: 'bg-[#74788d] hover:bg-[#636678] text-white',
  info: 'bg-info hover:bg-[#448cce] text-white',
  warning: 'bg-warning hover:bg-[#cd993f] text-white',
  outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700',
}

export function Button({ color = 'primary', className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded px-3 py-[7px] text-[13px] transition disabled:opacity-50 ${btnColors[color]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto print:static print:bg-white print:p-0">
      <div className={`bg-white rounded shadow-lg w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} mt-10 print:mt-0 print:shadow-none`}>
        <div className="flex items-center justify-between border-b px-5 py-3 print:hidden">
          <h5 className="font-medium text-gray-700">{title}</h5>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Badge({ children, color = 'success' }) {
  const c = {
    success: 'bg-success/15 text-success',
    danger: 'bg-danger/15 text-danger',
    warning: 'bg-warning/20 text-[#b07d24]',
    info: 'bg-info/15 text-info',
  }[color]
  return <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${c}`}>{children}</span>
}
