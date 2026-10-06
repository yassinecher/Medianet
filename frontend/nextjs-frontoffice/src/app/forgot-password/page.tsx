'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BorderBeam } from '@/components/magicui/border-beam'
import { AuthShell } from '@/components/brand/AuthShell'

/**
 * « Mot de passe oublié » — asks for the email and sends a reset link. Also how
 * an account created with Google gets a password. The answer is the same
 * whether or not the address has an account.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email.trim())
      setSentTo(email.trim())
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.response?.data?.error ?? 'Envoi impossible, réessayez.')
    } finally { setLoading(false) }
  }

  return (
    <AuthShell>
      <div className="relative rounded-2xl border border-border bg-card p-7 shadow-xl sm:p-8">
        <BorderBeam />
        {sentTo ? (
          <div className="space-y-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MailCheck className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-bold text-foreground">Vérifiez votre boîte mail</h1>
            <p className="text-sm text-muted-foreground">
              Si un compte existe pour <b className="text-foreground">{sentTo}</b>, vous allez recevoir un lien pour
              choisir un nouveau mot de passe. Il est valable 1 heure.
            </p>
            <p className="text-xs text-muted-foreground">Rien reçu ? Vérifiez les courriers indésirables, ou réessayez dans une minute.</p>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" onClick={() => setSentTo(null)}>Renvoyer un lien</Button>
              <Link href="/login" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                Retour à la connexion
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-foreground">Mot de passe oublié</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Indiquez l&apos;adresse email de votre compte : nous vous enverrons un lien pour choisir un
                nouveau mot de passe. Compte créé avec Google ? Ce lien vous permet aussi d&apos;en définir un.
              </p>
            </div>
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="email">Email</label>
                <Input id="email" type="email" placeholder="vous@example.com" value={email} required autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading || !email.trim()}
                className="w-full text-white" style={{ background: 'var(--banner-bg, linear-gradient(90deg,#0084c7,#00a3e0))' }}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Envoyer le lien
              </Button>
            </form>
            <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />Retour à la connexion
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  )
}
