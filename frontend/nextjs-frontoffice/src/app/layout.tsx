import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import { SiteTheme } from '@/components/theme/SiteTheme'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

// Re-applies the last known front-office theme BEFORE first paint, so pages don't
// flash the default colors while <SiteTheme/> refreshes it from the API.
// Keep the key / id in sync with components/theme/SiteTheme.tsx.
const THEME_PREPAINT = `try{var c=localStorage.getItem('site-theme-css');if(c){var s=document.createElement('style');s.id='site-theme';s.textContent=c;document.head.appendChild(s)}}catch(e){}`

export const metadata: Metadata = {
  title: { default: 'Medianet Incubateur', template: '%s | Medianet Incubateur' },
  description: "Plateforme d'incubation de startups Medianet",
}

/** Root shell for the frontoffice (porteur/mentor/jury portal): theme provider +
 *  global toasts. Per-page chrome (navbar, sidebar) lives in AppShell, not here. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_PREPAINT }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SiteTheme />
          {children}
          <Toaster position="top-right" toastOptions={{ className: 'text-sm font-medium', style: { borderRadius: '12px' } }} />
        </ThemeProvider>
      </body>
    </html>
  )
}
