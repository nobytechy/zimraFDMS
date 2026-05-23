import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import Logo from '@/components/Logo'

export default function Login() {
  const { signInMerchant } = useAuth()
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const nav = useNavigate()

  const onSubmit = async (data) => {
    setBusy(true)
    const { error } = await signInMerchant({ phone: data.phone, password: data.password })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Welcome back')
    nav('/dashboard')
  }

  return (
    <div className="min-h-screen bg-zim-ink-50 grid place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 inline-flex"><Logo /></Link>
        <div className="rounded-2xl border border-zim-ink-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-zim-ink-900">Sign in</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="0774 603 865" {...register('phone', { required: true })} />
              {errors.phone && <p className="mt-1 text-xs text-zim-red-700">Required.</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-10" type={showPw ? 'text' : 'password'} {...register('password', { required: true })} />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zim-ink-400 hover:text-zim-ink-700">
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-zim-red-700">Required.</p>}
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-base">
              {busy ? 'Signing in…' : <>Sign in <ArrowRight size={16}/></>}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-zim-ink-500">
            New here? <Link to="/signup" className="font-semibold text-zim-red-700 hover:text-zim-red-800">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
