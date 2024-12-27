/// <reference types="node" />

declare global {
  const setTimeout: (callback: () => void, ms: number) => NodeJS.Timeout
  const clearTimeout: (timeoutId: NodeJS.Timeout) => void
}

export {}
