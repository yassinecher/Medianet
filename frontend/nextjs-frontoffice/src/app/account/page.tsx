'use client'
/**
 * Account settings — first/last name + password change.
 * Backend: PUT /api/auth/profile (firstName, lastName, currentPassword, newPassword).
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Save, User as UserIcon, KeyRound, Mail, ShieldCheck, Briefcase, Sparkles, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore, useUser, frontofficeRolesOf, type FrontofficeRole } from '@/store/auth.store'
import { getInitials } from '@/lib/utils'

const ROLE_META: Record<FrontofficeRole, { label: string; icon: any; color: string }> = {
  PORTEUR: { label: 'Porteur', icon: Briefcase,     color: 'text-brand-600 dark:text-brand-400'     },
  MENTOR:  { label: 'Mentor',  icon: Sparkles,      color: 'text-emerald-600 dark:text-emerald-400' },
  JURY:    { label: 'Juré',    icon: GraduationCap, color: 'text-amber-600 dark:text-amber-400'     },
}

export default function AccountPage() {
  const user = useUser()
  const setAuth = useAuthStore((s) => s.setAuth)
  const token = useAuthStore((s) => s.token)

  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwForm, setShowPwForm] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPw,      setSavingPw]      = useState(false)

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '')
      setLastName(user.lastName ?? '')
    }
  }, [user?.id])

  const profileChanged = user && (firstName !== (user.firstName ?? '') || lastName !== (user.lastName ?? ''))

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Le prénom et le nom sont requis')
      return
    }
    setSavingProfile(true)
    try {
      const r = await authApi.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() })
      if (r.data && token) setAuth(r.data, token)
      toast.success('Profil mis à jour ✓')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erreur lors de la mise à jour')
    } finally { setSavingProfile(false) }
  }

  const handleChangePassword = async () => {
    if (!currentPassword) { toast.error('Le mot de passe actuel est requis'); return }
    if (newPassword.length < 8) { toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères'); return }
    if (newPassword !== confirmPassword) { toast.error('Les mots de passe ne correspondent pas'); return }
    setSavingPw(true)
    try {
      await authApi.updateProfile({
        firstName: firstName.trim(), lastName: lastName.trim(),
        currentPassword, newPassword,
      })
      toast.success('Mot de passe modifié ✓')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPwForm(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Mot de passe actuel incorrect ?')
    } finally { setSavingPw(false) }
  }

  if (!user) {
    return (
      <AppShell>
        <div className="flex h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />Chargement…
        </div>
      </AppShell>
    )
  }

  const roles = frontofficeRolesOf(user)

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header card with avatar */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <MagicCard className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 text-white text-xl font-bold shadow-lg">
                {getInitials(`${user.firstName} ${user.lastName}`)}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-black text-foreground truncate">{user.firstName} {user.lastName}</h1>
                <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5 truncate">
                  <Mail className="h-3.5 w-3.5" />{user.email}
                </p>
                {roles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {roles.map((r) => {
                      const Icon = ROLE_META[r].icon
                      return (
                        <span key={r} className={`inline-flex items-center gap-1 rounded-full bg-card border border-border px-2 py-0.5 text-[10px] font-bold ${ROLE_META[r].color}`}>
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

        {/* Profile info */}
        <MagicCard className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-brand-500" />
            <h2 className="font-bold text-foreground">Informations personnelles</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Prénom</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
            <Input value={user.email} disabled />
            <p className="text-[10px] text-muted-foreground mt-1">L'email ne peut pas être modifié — contactez l'administrateur.</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={!profileChanged || savingProfile} variant="brand" className="gap-1.5">
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingProfile ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </MagicCard>

        {/* Password */}
        <MagicCard className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand-500" />
              <h2 className="font-bold text-foreground">Mot de passe</h2>
            </div>
            {!showPwForm && (
              <Button variant="outline" size="sm" onClick={() => setShowPwForm(true)} className="gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />Changer le mot de passe
              </Button>
            )}
          </div>

          {showPwForm ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Mot de passe actuel</label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nouveau mot de passe</label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="8 caractères minimum" autoComplete="new-password" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Confirmer</label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password" />
                </div>
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600 dark:text-red-400">⚠ Les mots de passe ne correspondent pas.</p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setShowPwForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }}>
                  Annuler
                </Button>
                <Button onClick={handleChangePassword} disabled={savingPw} variant="brand" className="gap-1.5">
                  {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {savingPw ? 'Modification…' : 'Modifier'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Mot de passe défini lors de votre inscription. Vous pouvez le changer à tout moment.
            </p>
          )}
        </MagicCard>
      </div>
    </AppShell>
  )
}
