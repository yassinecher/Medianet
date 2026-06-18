'use client'
/**
 * Public join page — a porteur added someone as a team member; the tokenized
 * email link lands here. The invitee sets a password to create their account,
 * which is then linked to the organisation. No prior login required.
 */
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Building2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { orgInvitationsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Invite { organizationName?: string; email?: string; memberName?: string; alreadyAccepted?: boolean }

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const token = Array.isArray(params.token) ? params.token[0] : (params.token as string)
  const setAuth = useAuthStore((s) => s.setAuth)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<Invite | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    orgInvitationsApi.get(token)
      .then((r) => {
        setInvite(r.data)
        const parts = (r.data?.memberName ?? '').trim().split(' ')
        setForm((f) => ({ ...f, firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }))
      })
      .catch((e) => setError(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Invitation invalide ou expirée.'))
      .finally(() => setLoading(false))
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) { toast.error('Mot de passe : 8 caractères minimum'); return }
    setSubmitting(true)
    try {
      const { data } = await orgInvitationsApi.accept(token, form)
      setAuth(data, data.token)
      toast.success('Bienvenue dans l’équipe !')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.response?.data?.error ?? 'Échec de la création du compte')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-muted/40 to-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" /><p className="text-sm">Chargement de l&apos;invitation…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="rounded-full bg-rose-500/10 p-3"><AlertTriangle className="h-7 w-7 text-rose-500" /></div>
            <h1 className="text-lg font-bold text-foreground">Invitation indisponible</h1>
            <p className="max-w-xs text-sm text-muted-foreground">{error}</p>
          </div>
        ) : invite?.alreadyAccepted ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="rounded-full bg-emerald-500/10 p-3"><CheckCircle2 className="h-7 w-7 text-emerald-500" /></div>
            <h1 className="text-lg font-bold text-foreground">Invitation déjà utilisée</h1>
            <p className="text-sm text-muted-foreground">Ce compte existe déjà — connectez-vous.</p>
            <Button variant="brand" onClick={() => router.push('/login')}>Se connecter</Button>
          </div>
        ) : (
          <>
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15 text-brand-600">
                <Building2 className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Rejoindre {invite?.organizationName ?? 'l’organisation'}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Créez votre compte pour rejoindre l&apos;équipe{invite?.email ? ` (${invite.email})` : ''}.
              </p>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Prénom</label>
                  <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nom</label>
                  <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input value={invite?.email ?? ''} disabled className="opacity-70" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Mot de passe</label>
                <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="8 caractères minimum" required />
              </div>
              <Button type="submit" variant="brand" className="w-full gap-1.5" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Créer mon compte et rejoindre
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
