import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { DataStoreProvider } from '@/contexts/DataStore'

export const metadata: Metadata = {
  title: 'ResearchOS — The Operating System for Every Research Lab',
  description: 'From first idea to published paper — one intelligent platform for every researcher, every discipline, every lab.',
  keywords: 'research, lab management, paper library, experiment tracking, AI, academic, university',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <DataStoreProvider>
              {children}
            </DataStoreProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
