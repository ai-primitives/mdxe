import React from 'react'
import type { LayoutProps } from '../types.js'

export const ThingLayout: React.FC<LayoutProps> = ({ children, frontmatter, metadata }) => {
  return (
    <div className='max-w-4xl mx-auto px-4 py-8'>
      <dl className='grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 mb-8'>
        {Object.entries(frontmatter).map(([key, value]) => (
          <div key={key} className='border-b border-gray-200 pb-2'>
            <dt className='text-sm font-medium text-gray-500'>{key}</dt>
            <dd className='mt-1 text-sm text-gray-900'>{String(value)}</dd>
          </div>
        ))}
      </dl>
      <article className='prose prose-slate max-w-none'>{children}</article>
    </div>
  )
}
