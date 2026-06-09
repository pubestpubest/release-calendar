import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Release Calendar',
  description: 'Sprint task planner for FE, BE, and Mobile teams',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
