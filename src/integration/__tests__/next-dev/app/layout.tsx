import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Next.js MDX Test',
  description: 'Integration test for Next.js MDX support',
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang='en'>
      <body>{children}</body>
    </html>
  )
}
