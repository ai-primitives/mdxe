import React from 'react'
import { ThingLayout } from './layouts/ThingLayout.js'

export interface LayoutProps {
  children: React.ReactNode
  frontmatter: Record<string, unknown>
  metadata: Record<string, unknown>
}

export interface ComponentProps {
  children?: React.ReactNode
  [key: string]: unknown
}

interface TypeConfig {
  layout?: React.ComponentType<LayoutProps>
  components?: Record<string, React.ComponentType<ComponentProps>>
  inherits?: string[]
}

type TypeDefinitions = Record<string, TypeConfig>

export const types: TypeDefinitions = {
  'schema.org/Thing': {
    layout: ThingLayout,
  },
  'mdx.org.ai/Product': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/BlogPost': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/Agent': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/API': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/App': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/Assistant': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/Blog': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/Component': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/Function': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/Workflow': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/Directory': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/Eval': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/Package': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/Prompt': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/Startup': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/StateMachine': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/Tool': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/WebPage': {
    inherits: ['schema.org/Thing'],
  },
  'mdx.org.ai/Worker': {
    inherits: ['schema.org/Thing'],
  },
}

export function getTypeConfig(type: string): TypeConfig {
  const config = types[type] || {}
  const inherited = (config.inherits || []).map((t) => types[t] || {})

  return {
    layout: config.layout || inherited.find((t) => t.layout)?.layout,
    components: {
      ...inherited.reduce((acc, t) => ({ ...acc, ...(t.components || {}) }), {}),
      ...(config.components || {}),
    },
  } as TypeConfig
}
