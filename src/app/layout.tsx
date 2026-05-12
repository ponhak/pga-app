import type { Metadata } from 'next'
import { Oswald, DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'
import { NavBar } from '@/components/NavBar'
import { BottomTabBar } from '@/components/BottomTabBar'
import { Toaster } from '@/components/ui/sonner'

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'PGA Schager',
  description: 'Friendly golf tournament tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background" style={{ fontFamily: 'var(--font-body)' }}>
        <NavBar />
        <main className="flex-1 max-w-2xl mx-auto w-full pb-20">
          {children}
        </main>
        <BottomTabBar />
        <Toaster />
      </body>
    </html>
  )
}
