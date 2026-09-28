'use client'
/**
 * Account settings — name, phone, sign-in methods and password.
 * Backend: GET /api/auth/me, PUT /api/auth/profile (firstName, lastName, phone,
 * currentPassword?, newPassword?). Accounts created with Google have no password
 * they know: they can SET one here (no current password) or via « Mot de passe oublié ».
 * `?complete=1` (sent after a Google sign-in with missing details) highlights what to fill in.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Loader2, Save, User as UserIcon, KeyRound, Mail, ShieldCheck, Briefcase, Sparkles, GraduationCap,
  Phone, CheckCircle2, AlertTriangle, LogIn,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore, useUser, frontofficeRolesOf, type FrontofficeRole } from '@/store/auth.store'
import { getInitials } from '@/lib/utils'
import type { User } from '@/types'

const ROLE_META: Record<FrontofficeRole, { label: string; icon: any; color: string }> = {
  PORTEUR: { label: 'Porteur', icon: Briefcase,     color: 'text-brand-600 dark:text-brand-400'     },
  MENTOR:  { label: 'Mentor',  icon: Sparkles,      color: 'text-emerald-600 dark:text-emerald-400' },
  JURY:    { label: 'Juré',    icon: GraduationCap, color: 'text-amber-600 dark:text-amber-400'     },
}

/** Backend validation errors come back as { error } (400) or { message } (403). */
const apiError = (e: any, fallback: string) => e?.response?.data?.message ?? e?.response?.data?.error ?? fallback

/** Google "G" mark, so the sign-in method is recognisable. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.4 35.3 44 30 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  )
}

export default function AccountPage() {
  const storeUser = useUser()
  const setAuth = useAuthStore((s) => s.setAuth)
  const token = useAuthStore((s) => s.token)
  /** Fresh account from /me (phone, hasPassword, authProvider); falls back to the session copy. */
  const [account, setAccount] = useState<User | null>(null)
  const user = account ?? storeUser
  const [complete, setComplete] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwForm, setShowPwForm] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPw,      setSavingPw]      = useState(false)

  useEffect(() => {
    setComplete(new URLSearchParams(window.location.search).get('complete') === '1')
    authApi.me().then((r) => setAccount(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '')
      setLastName(user.lastName ?? '')
      setPhone(user.phone ?? '')
    }
  }, [user?.id, account])

  if (!user) {
    return (
      <AppShell>
        <div className="flex h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />Chargement…
        </div>
      </AppShell>
    )
  }

  const roles = frontofficeRolesOf(user)
  const isGoogle = user.authProvider === 'GOOGLE'
  const hasPassword = user.hasPassword !== false
  const missingPhone = roles.includes('PORTEUR') && !(user.phone ?? '').trim()
  const profileChanged = firstName !== (user.firstName ?? '') || lastName !== (user.lastName ?? '') || phone !== (user.phone ?? '')

  /** Keep the page and the session in sync with what the server returned. */
  const applyAccount = (data: User) => {
    setAccount(data)
    if (token) setAuth(data, token)
  }

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) { toast.error('Le prénom et le nom sont requis'); return }
    if (roles.includes('PORTEUR') && !phone.trim()) { toast.error('Le numéro de téléphone est requis'); return }
    setSavingProfile(true)
    try {
      const r = await authApi.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() })
      applyAccount(r.data)
      toast.success('Profil mis à jour')
    } catch (e: any) {
      toast.error(apiError(e, 'Erreur lors de la mise à jour'))
    } finally { setSavingProfile(false) }
  }

  const resetPwForm = () => { setShowPwForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }

  const handleSavePassword = async () => {
    if (hasPassword && !currentPassword) { toast.error('Le mot de passe actuel est requis'); return }
    if (newPassword.length < 8) { toast.error('Le mot de passe doit contenir au moins 8 caractères'); return }
    if (newPassword !== confirmPassword) { toast.error('Les mots de passe ne correspondent pas'); return }
    setSavingPw(true)
    try {
      const r = await authApi.updateProfile({
        firstName: (user.firstName ?? firstName).trim(), lastName: (user.lastName ?? lastName).trim(),
        ...(hasPassword ? { currentPassword } : {}), newPassword,
      })
      applyAccount(r.data)
      toast.success(hasPassword ? 'Mot de passe modifié' : 'Mot de passe défini — vous pouvez aussi vous connecter par email')
      resetPwForm()
    } catch (e: any) {
      toast.error(apiError(e, 'Le mot de passe n’a pas pu être modifié'))
    } finally { setSavingPw(false) }
  }

  const todo = [missingPhone && 'votre numéro de téléphone', !hasPassword && 'un mot de passe (facultatif)'].filter(Boolean)

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header card with avatar */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <MagicCard className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-accent text-xl font-bold text-white shadow-lg">
                {getInitials(`${user.firstName} ${user.lastName}`)}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-black text-foreground">{user.firstName} {user.lastName}</h1>
                <p className="inline-flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />{user.email}
                </p>
                {roles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {roles.map((r) => {
                      const Icon = ROLE_META[r].icon
                      return (
                        <span key={r} className={`inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-bold ${ROLE_META[r].color}`}>
                          <Icon className="h-3 w-3" />{ROLE_META[r].label}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </MagicCard>
        </motion.div>

        {/* After a Google sign-in: what's still missing */}
        {todo.length > 0 && (complete || missingPhone) && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold text-foreground">Complétez votre compte</p>
              <p className="text-muted-foreground">Il manque {todo.join(' et ')}.</p>
            </div>
          </div>
        )}

        {/* Profile info */}
        <MagicCard className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-brand-500" />
            <h2 className="font-bold text-foreground">Informations personnelles</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="firstName">Prénom</label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="lastName">Nom</label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
              <Input value={user.email} disabled />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground" htmlFor="phone">
                <Phone className="h-3 w-3" />Téléphone
                {missingPhone && <span className="font-semibold text-amber-600 dark:text-amber-400">· à renseigner</span>}
              </label>
              <Input id="phone" type="tel" value={phone} placeholder="+216 12 345 678" autoComplete="tel"
                onChange={(e) => setPhone(e.target.value)}
                className={missingPhone ? 'border-amber-500/60 focus-visible:ring-amber-500' : undefined} />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">L&apos;email ne peut pas être modifié — contactez l&apos;administrateur.</p>
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={!profileChanged || savingProfile} variant="brand" className="gap-1.5">
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingProfile ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </MagicCard>

        {/* Sign-in methods + password */}
        <MagicCard className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand-500" />
              <h2 className="font-bold text-foreground">Connexion &amp; mot de passe</h2>
            </div>
            {!showPwForm && (
              <Button variant="outline" size="sm" onClick={() => setShowPwForm(true)} className="gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />{hasPassword ? 'Changer le mot de passe' : 'Définir un mot de passe'}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {isGoogle && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-foreground">
                <GoogleMark />Connexion Google
              </span>
            )}
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${hasPassword
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-border bg-card text-muted-foreground'}`}>
              {hasPassword ? <CheckCircle2 className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
              {hasPassword ? 'Email + mot de passe' : 'Pas encore de mot de passe'}
            </span>
          </div>

          {showPwForm ? (
            <div className="space-y-3">
              {hasPassword ? (
                <div>
                  <label className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground" htmlFor="currentPassword">
                    Mot de passe actuel
                    <Link href="/forgot-password" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">Mot de passe oublié ?</Link>
                  </label>
                  <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••" autoComplete="current-password" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Votre compte a été créé avec Google. Définissez un mot de passe pour pouvoir aussi vous connecter avec votre email.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="newPassword">
                    {hasPassword ? 'Nouveau mot de passe' : 'Mot de passe'}
                  </label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="8 caractères minimum" autoComplete="new-password" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="confirmPassword">Confirmer</label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password" />
                </div>
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600 dark:text-red-400">Les mots de passe ne correspondent pas.</p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={resetPwForm}>Annuler</Button>
                <Button onClick={handleSavePassword} disabled={savingPw} variant="brand" className="gap-1.5">
                  {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {savingPw ? 'Enregistrement…' : hasPassword ? 'Modifier' : 'Définir'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {hasPassword
                ? 'Vous pouvez changer votre mot de passe à tout moment.'
                : 'Vous vous connectez avec Google. Ajoutez un mot de passe pour aussi pouvoir vous connecter avec votre email.'}
            </p>
          )}
        </MagicCard>
      </div>
    </AppShell>
  )
}
