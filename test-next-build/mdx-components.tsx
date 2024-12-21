'use client'

import React from 'react'
import type { ComponentType, ReactNode } from 'react'

interface MDXComponents {
  [key: string]: ComponentType<any>
}

interface HeadingProps {
  children: ReactNode
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }: HeadingProps) => <h1 style={{ fontSize: '2.5rem' }}>{children}</h1>,
    ...components,
  }
}
