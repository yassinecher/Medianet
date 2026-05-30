'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, Save, Loader2, Moon, Sun, Globe2, Shield, Bell } from 'lucide-react'
import { useTheme } from 'next-themes'
import toast from 'react-hot-toast'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth.store'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const user = useAuthStore((s) => s.user)

  const [platformForm, setPlatformForm] = useState({
    siteName: 'Medianet Incubateur',
    apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
    maxCandidatures: '500',
    ollamaModel: 'llama3.2',
  })
  const [savingPlatform, setSavingPlatform] = useState(false)

  const [notifForm, setNotifForm] = useState({
    emailFrom: 'noreply@medianet.dz',
    emailEnabled: true,
    inviteExpireDays: '7',
  })
  const [savingNotif, setSavingNotif] = useState(false)

  const handleSavePlatform = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPlatform(true)
    await new Promise((r) => setTimeout(r, 800))
    setSavingPlatform(false)
    toast.success('Paramètres sauvegardés')
  }

  const handleSaveNotif = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingNotif(true)
    await new Promise((r) => setTimeout(r, 800))
    setSavingNotif(false)
    toast.success('Paramètres de notification sauvegardés')
  }

  const upPlatform = (k: string, v: string) => setPlatformForm((f) => ({ ...f, [k]: v }))
  const upNotif = (k: string, v: string | boolean) => setNotifForm((f) => ({ ...f, [k]: v }))

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6 text-brand-500" />Paramètres
          </h1>
          <p className="text-muted-foreground">Configuration de la plateforme</p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Theme */}
          <MagicCard className="p-5">
            <h2 className="mb-4 font-semibold flex items-center gap-2">
              {theme === 'dark' ? <Moon className="h-4 w-4 text-brand-400" /> : <Sun className="h-4 w-4 text-amber-500" />}
              Apparence
            </h2>
            <div className="flex gap-3">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button key={t} onClick={() => setTheme(t)}
                  className={`flex-1 rounded-lg border py-3 text-sm font-medium transition-all capitalize ${theme === t ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'border-border bg-muted text-muted-foreground hover:text-foreground'}`}>
                  {t === 'light' ? 'Clair' : t === 'dark' ? 'Sombre' : 'Système'}
                </button>
              ))}
            </div>
          </MagicCard>

          {/* Admin info */}
          <MagicCard className="p-5">
            <h2 className="mb-4 font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand-500" />Compte administrateur
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-purple-600 text-white font-bold">
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-foreground">{user?.firstName} {user?.lastName}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <span className="mt-1 inline-block rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                  Administrateur
                </span>
              </div>
            </div>
          </MagicCard>

          {/* Platform settings */}
          <MagicCard className="p-5">
            <h2 className="mb-4 font-semibold flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-brand-500" />Paramètres plateforme
            </h2>
            <form onSubmit={handleSavePlatform} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nom de la plateforme</label>
                <Input value={platformForm.siteName} onChange={(e) => upPlatform('siteName', e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">URL de l'API Gateway</label>
                <Input value={platformForm.apiUrl} onChange={(e) => upPlatform('apiUrl', e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Modèle Ollama</label>
                <Input placeholder="llama3.2" value={platformForm.ollamaModel} onChange={(e) => upPlatform('ollamaModel', e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Limite candidatures</label>
                <Input type="number" value={platformForm.maxCandidatures} onChange={(e) => upPlatform('maxCandidatures', e.target.value)} />
              </div>
              <Button type="submit" variant="brand" className="w-full" disabled={savingPlatform}>
                {savingPlatform ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingPlatform ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </form>
          </MagicCard>

          {/* Notification settings */}
          <MagicCard className="p-5">
            <h2 className="mb-4 font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand-500" />Notifications & Invitations
            </h2>
            <form onSubmit={handleSaveNotif} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Adresse email expéditeur</label>
                <Input type="email" value={notifForm.emailFrom} onChange={(e) => upNotif('emailFrom', e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Durée de validité invitation (jours)</label>
                <Input type="number" min="1" max="30" value={notifForm.inviteExpireDays} onChange={(e) => upNotif('inviteExpireDays', e.target.value)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Emails activés</p>
                  <p className="text-xs text-muted-foreground">Envoyer les invitations par email</p>
                </div>
                <button type="button"
                  onClick={() => upNotif('emailEnabled', !notifForm.emailEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${notifForm.emailEnabled ? 'bg-brand-500' : 'bg-muted'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${notifForm.emailEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <Button type="submit" variant="brand" className="w-full" disabled={savingNotif}>
                {savingNotif ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingNotif ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </form>
          </MagicCard>
        </div>
      </div>
    </AdminLayout>
  )
}
