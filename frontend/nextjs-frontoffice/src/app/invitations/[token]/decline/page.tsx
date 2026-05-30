'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ThumbsDown, XCircle, Loader2 } from 'lucide-react'
import { notificationsApi } from '@/lib/api'
import { Particles } from '@/components/magicui/particles'
import { BorderBeam } from '@/components/magicui/border-beam'

export default function RsvpDeclinePage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    notificationsApi.rsvpDecline(token).then(() => setState('success')).catch(() => setState('error'))
  }, [token])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <div className="absolute inset-0"><Particles quantity={40} color="#f87171" /></div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 w-full max-w-sm px-4">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-center shadow-2xl">
          <BorderBeam colorFrom="#f87171" colorTo="#fca5a5" />
          {state === 'loading' && <><Loader2 className="mx-auto h-14 w-14 animate-spin text-brand-500" /><h1 className="mt-4 text-xl font-bold">Traitement…</h1></>}
          {state === 'success' && (
            <><motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
              <ThumbsDown className="mx-auto h-14 w-14 text-amber-500" />
            </motion.div>
            <h1 className="mt-4 text-xl font-bold text-foreground">Réponse enregistrée</h1>
            <p className="mt-2 text-sm text-muted-foreground">Merci de nous avoir informés. Nous espérons vous voir prochainement.</p></>
          )}
          {state === 'error' && <><XCircle className="mx-auto h-14 w-14 text-red-500" /><h1 className="mt-4 text-xl font-bold">Lien invalide</h1><p className="mt-2 text-sm text-muted-foreground">Ce lien a expiré ou est incorrect.</p></>}
        </div>
      </motion.div>
    </div>
  )
}
