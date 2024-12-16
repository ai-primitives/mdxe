import React from 'react'

interface LayoutProps {
  children: React.ReactNode
  meta?: {
    title?: string
    description?: string
  }
}

export default function CustomLayout({ children, meta }: LayoutProps) {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {meta?.title && <h1 className="text-3xl font-bold mb-4">{meta.title}</h1>}
      {meta?.description && <p className="text-gray-600 mb-8">{meta.description}</p>}
      <div className="prose">{children}</div>
    </div>
  )
}
