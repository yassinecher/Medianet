import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: 'Medianet Incubateur', template: '%s | Medianet Incubateur' },
  description: "Plateforme d'incubation de startups Medianet",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-right" toastOptions={{ className: 'text-sm font-medium', style: { borderRadius: '12px' } }} />
        </ThemeProvider>
      </body>
    </html>
  )
}
