'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Loader2, Mail, Shield, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { authApi, api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BorderBeam } from '@/components/magicui/border-beam'
import { Particles } from '@/components/magicui/particles'
import { Skeleton } from '@/components/ui/skeleton'

interface InvitationDetails {
  id: number
  token: string
  type: string
  status: string
  recipientEmail: string
  recipientName?: string
  subject: string
  message?: string
  programmeName?: string
  phaseName?: string
}

const ROLE_LABEL: Record<string, string> = {
  JURY: 'Juré',
  MENTOR: 'Mentor',
  PORTEUR: 'Porteur',
  ADMIN: 'Administrateur',
}

export default function InvitationRegisterPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '', confirmPassword: '', phone: '' })

  useEffect(() => {
    // Public token lookup (no auth needed)
    api.get<InvitationDetails>(`/api/notifications/invitations/token/${token}`)
      .then((r) => {
        setInvitation(r.data)
        // Pre-fill recipient name if we have one
        if (r.data.recipientName) {
          const parts = r.data.recipientName.trim().split(/\s+/)
          setForm((f) => ({
            ...f,
            firstName: parts[0] ?? '',
            lastName: parts.slice(1).join(' ') ?? '',
          }))
        }
      })
      .catch(() => setError('Ce lien d\'invitation est invalide ou a expiré.'))
      .finally(() => setLoading(false))
  }, [token])

  const u = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) {
      toast.error('Mot de passe : minimum 8 caractères')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    setSubmitting(true)
    try {
      const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/api/auth/register-from-invitation`, {
        token,
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password,
        phone: form.phone || undefined,
      })
      setAuth(data, data.token)
      toast.success('Compte créé avec succès ! Bienvenue 🎉')
      router.push('/dashboard')
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Erreur lors de la création du compte'
      toast.error(msg)
    } finally { setSubmitting(false) }
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="absolute inset-0"><Particles quantity={50} color="#6272f6" /></div>
        <div className="mesh-gradient absolute inset-0" />
        <div className="relative z-10 w-full max-w-md space-y-4">
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (error || !invitation) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="absolute inset-0"><Particles quantity={50} color="#6272f6" /></div>
        <div className="mesh-gradient absolute inset-0" />
        <div className="relative z-10 w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-foreground">Invitation invalide</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error ?? "Ce lien n'est pas reconnu."}</p>
            <Link href="/login"><Button className="mt-6">Aller à la connexion</Button></Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Already-consumed ────────────────────────────────────────────────────
  if (invitation.status === 'ACCEPTED') {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="absolute inset-0"><Particles quantity={50} color="#6272f6" /></div>
        <div className="mesh-gradient absolute inset-0" />
        <div className="relative z-10 w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-foreground">Invitation déjà utilisée</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Vous avez déjà créé votre compte à partir de ce lien. Connectez-vous pour accéder à la plateforme.
            </p>
            <Link href="/login"><Button className="mt-6">Se connecter</Button></Link>
          </div>
        </div>
      </div>
    )
  }

  const roleLabel = ROLE_LABEL[invitation.type] ?? invitation.type

  // ── Form ────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="absolute inset-0"><Particles quantity={50} color="#6272f6" /></div>
      <div className="mesh-gradient absolute inset-0" />

      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 w-full max-w-md">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-2xl">
          <BorderBeam colorFrom="#a78bfa" colorTo="#6272f6" duration={8} />

          <div className="mb-6 text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/30">
                <Shield className="h-6 w-6 text-white" />
              </div>
            </div>
            <span className="inline-block rounded-full bg-brand-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              Invitation {roleLabel}
            </span>
            <h1 className="mt-3 text-2xl font-bold text-foreground">Finaliser votre inscription</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Vous avez été invité(e) à rejoindre Medianet Incubateur.
            </p>
          </div>

          {/* Invitation context */}
          <div className="mb-6 rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3.5 w-3.5 text-brand-500 shrink-0" />
              <span className="text-muted-foreground text-xs">Email :</span>
              <span className="font-semibold text-foreground truncate">{invitation.recipientEmail}</span>
            </div>
            {invitation.programmeName && (
              <p className="text-xs text-muted-foreground">
                📦 Programme : <span className="font-medium text-foreground">{invitation.programmeName}</span>
              </p>
            )}
            {invitation.message && (
              <p className="text-xs text-muted-foreground italic line-clamp-3 whitespace-pre-line">"{invitation.message}"</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Prénom</label>
                <Input value={form.firstName} onChange={(e) => u('firstName', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nom</label>
                <Input value={form.lastName} onChange={(e) => u('lastName', e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Téléphone (optionnel)</label>
              <Input type="tel" placeholder="+216…" value={form.phone} onChange={(e) => u('phone', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mot de passe</label>
              <Input type="password" minLength={8} placeholder="Min. 8 caractères"
                value={form.password} onChange={(e) => u('password', e.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Confirmer le mot de passe</label>
              <Input type="password" minLength={8}
                value={form.confirmPassword} onChange={(e) => u('confirmPassword', e.target.value)} required />
              {form.confirmPassword && form.confirmPassword !== form.password && (
                <p className="text-xs text-red-500">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            <Button type="submit" disabled={submitting}
              className="w-full bg-gradient-to-r from-brand-600 to-purple-600 text-white">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? 'Création...' : `Créer mon compte ${roleLabel}`}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            En créant un compte, vous acceptez nos conditions d'utilisation. Votre email et votre rôle ({roleLabel}) sont définis par l'invitation.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
