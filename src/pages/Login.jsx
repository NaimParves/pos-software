import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { SHOP } from '../config/shop'
import { login, useUser } from '../store/auth'

export default function Login() {
  const nav = useNavigate()
  const user = useUser()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/home" replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const res = await login(phone.trim(), password, remember)
    setBusy(false)
    if (res.ok) nav('/home')
    else setError(res.error)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div
        className="relative lg:w-[55%] h-56 lg:h-auto bg-cover bg-center"
        style={{ backgroundImage: 'linear-gradient(rgba(20,22,30,.72),rgba(20,22,30,.72)), url(https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1400&q=70)' }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center">
          <p className="italic text-2xl lg:text-3xl">Welcome To</p>
          <h1 className="font-['Playfair_Display'] text-3xl lg:text-5xl font-bold mt-2">POINT OF SALES</h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white px-6 lg:px-10">
        <div className="flex-1 flex flex-col justify-center lg:justify-start lg:pt-10 max-w-xl w-full mx-auto py-10">
          <h2 className="font-['Playfair_Display'] text-2xl text-center text-gray-800 font-bold">{SHOP.name}</h2>
          <p className="text-center text-sm text-gray-600 mt-1 mb-10">Use credentials to access your account.</p>
          {import.meta.env.VITE_DEMO && (
            <div className="-mt-6 mb-6 rounded border border-warning/50 bg-warning/10 px-4 py-3 text-[13px] text-gray-700">
              <b>Demo version</b> with sample data. Sign in with phone <b>admin</b> and password <b>admin123</b>.
              Changes are saved only in your own browser.
              <button type="button" className="block mt-1 text-primary underline" onClick={() => { setPhone('admin'); setPassword('admin123') }}>Fill in demo login</button>
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone Number" className="w-full bg-[#f5f5f5] border border-gray-200 rounded px-4 py-2.5 text-sm focus:outline-none focus:border-success" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-[#f5f5f5] border border-gray-200 rounded px-4 py-2.5 text-sm focus:outline-none focus:border-success" />
            {error && <p className="text-danger text-sm">{error}</p>}
            <div className="flex justify-between text-sm text-gray-600">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
              </label>
              <button type="button" onClick={() => alert('Please contact your super admin to reset your password.')} className="hover:text-gray-800">Forgot password?</button>
            </div>
            <button type="submit" disabled={busy} className="w-full disabled:opacity-60 border-2 border-success text-success text-xs uppercase tracking-wide font-medium rounded py-2.5 hover:bg-success hover:text-white transition">
              {busy ? 'Signing in…' : 'Sign in now'}
            </button>
          </form>
          <p className="text-center text-gray-600 mt-6">Don't have an account? Please<br />contact your super admin.</p>
        </div>
        <p className="text-right text-sm text-gray-600 py-4">©{new Date().getFullYear()} {SHOP.name} | {SHOP.phone}</p>
      </div>
    </div>
  )
}
