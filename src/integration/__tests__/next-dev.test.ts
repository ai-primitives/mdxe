import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { spawn, type ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import { setTimeout } from 'node:timers/promises'
import net from 'net'

const TEST_PORT = 3123
const TEST_DIR = path.join(process.cwd(), 'src/integration/__tests__/next-dev')
const CONTENT_PATH = path.join(TEST_DIR, 'content/test.mdx')

const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => {
      resolve(false)
    })
    server.once('listening', () => {
      server.close()
      resolve(true)
    })
    server.listen(port)
  })
}

const waitForServerReady = async (process: ChildProcess, timeoutMs = 30000): Promise<void> => {
  const startTime = Date.now()
  let isReady = false

  return new Promise((resolve, reject) => {
    const checkTimeout = () => {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Timeout waiting for Next.js dev server after ${timeoutMs}ms`))
      }
    }

    const checkInterval = setInterval(checkTimeout, 1000)

    if (!process.stdout) {
      clearInterval(checkInterval)
      reject(new Error('Failed to start Next.js dev server - no stdout available'))
      return
    }

    // Multiple ready indicators
    const readyIndicators = ['ready', 'compiled successfully', 'compiled client and server successfully']

    process.stdout.on('data', (data: Buffer) => {
      const output = data.toString()
      console.log(`Next.js server output: ${output}`)

      if (readyIndicators.some((indicator) => output.toLowerCase().includes(indicator))) {
        isReady = true
        clearInterval(checkInterval)
        resolve()
      }
    })

    process.stderr?.on('data', (data: Buffer) => {
      const error = data.toString()
      console.error(`Next.js server error: ${error}`)
      if (error.includes('EADDRINUSE')) {
        clearInterval(checkInterval)
        reject(new Error(`Port ${TEST_PORT} is already in use`))
      }
    })

    process.on('error', (error) => {
      clearInterval(checkInterval)
      reject(error)
    })

    process.on('exit', (code) => {
      if (!isReady) {
        clearInterval(checkInterval)
        reject(new Error(`Next.js server exited with code ${code} before becoming ready`))
      }
    })
  })
}

describe('next-dev integration', () => {
  let nextProcess: ChildProcess

  beforeAll(async () => {
    // Check if port is available
    const portAvailable = await isPortAvailable(TEST_PORT)
    if (!portAvailable) {
      throw new Error(`Port ${TEST_PORT} is not available. Please ensure no other processes are using it.`)
    }

    console.log('Starting Next.js dev server...')
    nextProcess = spawn('pnpm', ['exec', 'next', 'dev', '-p', TEST_PORT.toString()], {
      cwd: TEST_DIR,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    try {
      await waitForServerReady(nextProcess)
      console.log('Next.js server is ready!')
    } catch (error) {
      // Clean up process on error
      nextProcess.kill('SIGTERM')
      throw error
    }
  })

  afterAll(async () => {
    if (nextProcess) {
      // Send SIGTERM first for graceful shutdown
      nextProcess.kill('SIGTERM')
      await setTimeout(1000) // Give it a second to shut down gracefully

      // Force kill if still running
      if (!nextProcess.killed) {
        nextProcess.kill('SIGKILL')
      }
    }
  })

  test('file changes trigger reload and content updates', async () => {
    // Initial content check with retry
    let initialHtml = ''
    for (let i = 0; i < 3; i++) {
      try {
        const initialResponse = await fetch(`http://localhost:${TEST_PORT}/test`)
        initialHtml = await initialResponse.text()
        if (initialHtml.includes('Test Content')) break
        await setTimeout(1000)
      } catch (error) {
        if (i === 2) throw error
        await setTimeout(1000)
      }
    }
    expect(initialHtml).toContain('Test Content')

    // Modify MDX file
    const newContent = '# Updated Content\n\nThis content was updated during testing.'
    await fs.writeFile(CONTENT_PATH, newContent)

    // Wait for rebuild with retry
    let updatedHtml = ''
    for (let i = 0; i < 5; i++) {
      await setTimeout(1000)
      try {
        const updatedResponse = await fetch(`http://localhost:${TEST_PORT}/test`)
        updatedHtml = await updatedResponse.text()
        if (updatedHtml.includes('Updated Content')) break
      } catch (error) {
        if (i === 4) throw error
      }
    }

    expect(updatedHtml).toContain('Updated Content')
    expect(updatedHtml).toContain('This content was updated during testing')
  })
})
