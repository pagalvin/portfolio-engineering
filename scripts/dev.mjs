import { spawn } from 'node:child_process'

const API_HEALTH_URL = 'http://127.0.0.1:3001/health'
const HEALTH_CHECK_TIMEOUT_MS = 60_000
const HEALTH_CHECK_INTERVAL_MS = 500

const children = new Set()
let isShuttingDown = false

function spawnCommand(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
    ...options,
  })

  children.add(child)

  child.stdout?.on('data', (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`)
  })

  child.stderr?.on('data', (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`)
  })

  child.on('exit', () => {
    children.delete(child)
  })

  return child
}

function runCommand(label, command, args) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(label, command, args)

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          `${label} exited with ${signal ? `signal ${signal}` : `code ${code}`}`,
        ),
      )
    })
  })
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function waitForApiHealth(apiProcess) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < HEALTH_CHECK_TIMEOUT_MS) {
    if (apiProcess.exitCode !== null) {
      throw new Error('API process exited before becoming healthy.')
    }

    try {
      const response = await fetch(API_HEALTH_URL, {
        cache: 'no-store',
      })

      if (response.ok) {
        return
      }
    } catch {
      // API is still starting.
    }

    await delay(HEALTH_CHECK_INTERVAL_MS)
  }

  throw new Error(`API did not become healthy at ${API_HEALTH_URL}.`)
}

function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true

  for (const child of children) {
    child.kill()
  }

  process.exitCode = exitCode
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

try {
  await runCommand('prepare', 'corepack', [
    'pnpm',
    '-r',
    '--filter',
    './packages/*',
    '--if-present',
    'build',
  ])

  const apiProcess = spawnCommand('api', 'corepack', [
    'pnpm',
    '--filter',
    '@portfolio-engineering/api',
    'dev',
  ])

  await waitForApiHealth(apiProcess)
  console.log(`[dev] API is healthy at ${API_HEALTH_URL}; starting frontend.`)

  const frontendProcess = spawnCommand('frontend', 'corepack', [
    'pnpm',
    '--filter',
    '@portfolio-engineering/frontend',
    'dev',
  ])

  for (const child of [apiProcess, frontendProcess]) {
    child.on('exit', (code, signal) => {
      if (!isShuttingDown) {
        console.error(
          `[dev] Child process exited unexpectedly: ${
            signal ? `signal ${signal}` : `code ${code}`
          }`,
        )
        shutdown(code ?? 1)
      }
    })
  }
} catch (error) {
  console.error(
    error instanceof Error ? `[dev] ${error.message}` : '[dev] Startup failed.',
  )
  shutdown(1)
}
