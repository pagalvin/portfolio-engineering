import { buildApp } from './app.js'
import { loadWorkspaceEnv } from './lib/loadWorkspaceEnv.js'
import { startHelpRefresh } from './lib/helpRefresh.js'

loadWorkspaceEnv()

async function start(): Promise<void> {
  const app = await buildApp()
  const port = Number(process.env.PORT ?? '3001')
  const host = process.env.HOST ?? '127.0.0.1'

  try {
    await app.listen({ host, port })
    // Content availability is not a prerequisite for accepting sessions.
    startHelpRefresh({ logger: app.log })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void start()
