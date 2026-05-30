'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react'
import { api, notificationsApi } from '@/lib/api'
import { Particles } from '@/components/magicui/particles'
import { BorderBeam } from '@/components/magicui/border-beam'
import { Button } from '@/components/ui/button'

type State = 'loading' | 'redirecting' | 'success' | 'error'

const ACCOUNT_TYPES = new Set(['JURY', 'MENTOR', 'PORTEUR'])

export default function RsvpAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [state, setState] = useState<State>('loading')
  const [type, setType] = useState<string | null>(null)

  useEffect(() => {
    // Look up the invitation first — for account-creation invites,
    // we redirect to the registration page rather than auto-accepting.
    api.get(`/api/notifications/invitations/token/${token}`)
      .then(async (r) => {
        const inv = r.data
        setType(inv.type)
        if (ACCOUNT_TYPES.has(inv.type)) {
          setState('redirecting')
          router.replace(`/invitations/${token}/register`)
          return
        }
        // Plain event RSVP — accept immediately.
        await notificationsApi.rsvpAccept(token)
        setState('success')
      })
      .catch(() => setState('error'))
  }, [token, router])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <div className="absolute inset-0"><Particles quantity={40} color={state === 'success' ? '#34d399' : '#6272f6'} /></div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 w-full max-w-sm px-4">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-center shadow-2xl">
          <BorderBeam colorFrom={state === 'success' ? '#34d399' : '#6272f6'} colorTo={state === 'success' ? '#6ee7b7' : '#a78bfa'} />

          {state === 'loading' && (
            <>
              <Loader2 className="mx-auto h-14 w-14 animate-spin text-brand-500" />
              <h1 className="mt-4 text-xl font-bold">Vérification…</h1>
            </>
          )}

          {state === 'redirecting' && (
            <>
              <Mail className="mx-auto h-14 w-14 text-brand-500" />
              <h1 className="mt-4 text-xl font-bold">Redirection vers l'inscription…</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Cette invitation requiert la création d'un compte {type ? `(${type})` : ''}.
              </p>
            </>
          )}

          {state === 'success' && (
            <>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
              </motion.div>
              <h1 className="mt-4 text-xl font-bold text-foreground">Présence confirmée !</h1>
              <p className="mt-2 text-sm text-muted-foreground">Merci d'avoir confirmé votre participation.</p>
            </>
          )}

          {state === 'error' && (
            <>
              <XCircle className="mx-auto h-14 w-14 text-red-500" />
              <h1 className="mt-4 text-xl font-bold text-foreground">Lien invalide</h1>
              <p className="mt-2 text-sm text-muted-foreground">Ce lien a expiré ou est incorrect.</p>
              <Link href="/login"><Button variant="ghost" className="mt-4">Aller à la connexion</Button></Link>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
