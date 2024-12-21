import React from 'react'

export const metadata = {
  title: 'MDX Watch Mode Test',
  description: 'Testing MDX watch mode functionality'
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
