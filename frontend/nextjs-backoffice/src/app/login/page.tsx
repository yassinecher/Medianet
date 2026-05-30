'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BorderBeam } from '@/components/magicui/border-beam'

export default function AdminLoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.login(form.email, form.password)
      // AuthResponse is flat: { token, userId, email, firstName, lastName, role, roles, permissions }
      if (data.role !== 'ADMIN' && !data.roles?.includes('ADMIN')) {
        toast.error('Accès refusé — réservé aux administrateurs.')
        return
      }
      setAuth(data, data.token)
      toast.success('Bienvenue dans la console admin')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Identifiants incorrects')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle, #6272f640 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Animate only y so the card is always visible (no opacity:0 flash) */}
      <motion.div
        initial={{ y: 16 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl shadow-slate-200/60 dark:shadow-black/40">
          <BorderBeam colorFrom="#6272f6" colorTo="#a78bfa" duration={8} />

          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mb-5 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-700 shadow-lg shadow-brand-500/30">
                <Shield className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Console Admin</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Accès réservé aux administrateurs Medianet
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Email administrateur
              </label>
              <Input
                type="email"
                placeholder="admin@medianet.dz"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Mot de passe
              </label>
              <div className="relative">
                <Input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="pr-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  onClick={() => setShowPwd(!showPwd)}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="mt-2 w-full bg-gradient-to-r from-brand-600 to-purple-700 text-white hover:from-brand-700 hover:to-purple-800 shadow-md shadow-brand-500/20"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Authentification...' : 'Accéder à la console'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Porteurs de projets →{' '}
            <a href="http://localhost:3000/login" className="text-brand-500 hover:underline">
              Frontoffice
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
