'use client'
import { useEffect, useRef } from 'react'
import Script from 'next/script'

// PUBLIC OAuth client id — baked at build time (NEXT_PUBLIC_*). Safe to ship to
// the browser; it is designed to be public. The client SECRET is never used by
// this flow, and never touches the frontend.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

type ButtonText = 'signin_with' | 'signup_with' | 'continue_with'

/**
 * Renders the official "Sign in with Google" button (Google Identity Services).
 * On success it hands the ID token (GIS calls it the "credential") to
 * {@link onCredential}, which should POST it to the backend and store the
 * returned session. Renders nothing when no client id is configured, so the
 * pages degrade gracefully to email+password.
 */
export function GoogleSignInButton({
  onCredential,
  text = 'continue_with',
  disabled,
}: {
  onCredential: (idToken: string) => void | Promise<void>
  text?: ButtonText
  disabled?: boolean
}) {
  const holder = useRef<HTMLDivElement>(null)
  // Keep the latest callback without re-initialising GIS on every render.
  const cb = useRef(onCredential)
  cb.current = onCredential

  useEffect(() => {
    if (!CLIENT_ID) return
    let tries = 0
    const timer = setInterval(() => {
      const g = (window as any).google
      if (g?.accounts?.id && holder.current) {
        clearInterval(timer)
        g.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp: any) => { if (resp?.credential) cb.current(resp.credential) },
          ux_mode: 'popup',
          auto_select: false,
        })
        holder.current.innerHTML = ''
        g.accounts.id.renderButton(holder.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'pill',
          logo_alignment: 'left',
          width: 320,
        })
      } else if (++tries > 40) {
        clearInterval(timer) // give up after ~10s (script blocked / offline)
      }
    }, 250)
    return () => clearInterval(timer)
  }, [text])

  if (!CLIENT_ID) return null

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <div
        className="flex justify-center"
        style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
      >
        <div ref={holder} />
      </div>
    </>
  )
}

/** A labelled « ou » divider, to place between the form and the Google button. */
export function OrDivider({ label = 'ou' }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
