'use client'

import React from 'react'
import '../styles/custom.css'

export const metadata = {
  title: 'MDX Test App',
  description: 'Testing MDX integration with Next.js'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
