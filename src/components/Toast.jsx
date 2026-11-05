import { useSyncExternalStore } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

// Small notification boxes shown at the top-right of the screen.
// Use from anywhere: toast.success('Saved'), toast.error('Something went wrong')
let items = []
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
const dismiss = (id) => { items = items.filter((t) => t.id !== id); emit() }

function push(type, message, ms = 3500) {
  const id = Math.random().toString(36).slice(2)
  items = [...items, { id, type, message }]
  emit()
  setTimeout(() => dismiss(id), ms)
}

export const toast = {
  success: (m) => push('success', m),
  error: (m) => push('error', m, 6000),
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items)
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2rem)] print:hidden">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`flex items-start gap-2 rounded shadow-lg px-4 py-3 text-[13px] text-white ${t.type === 'success' ? 'bg-success' : 'bg-danger'}`}
        >
          {t.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="opacity-80 hover:opacity-100"><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}
