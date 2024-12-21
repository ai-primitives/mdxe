'use client'

import React from 'react'
import type { ComponentType, ReactNode } from 'react'

// This file allows you to provide custom React components
// to be used in MDX files. You can import and use any
// React component you want, including components from
// other libraries.

interface MDXComponents {
  [key: string]: ComponentType<any>
}

interface HeadingProps {
  children: ReactNode
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Allows customizing built-in components, e.g. to add styling.
    h1: ({ children }: HeadingProps) => <h1 style={{ fontSize: '2.5rem' }}>{children}</h1>,
    ...components,
  }
}
