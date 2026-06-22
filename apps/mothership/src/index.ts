import { createLogger } from '@sim/logger'
import { loadEnv } from '@/env'
import { createMothershipApp, createMothershipNodeServer } from '@/server'

const logger = createLogger('MothershipEntrypoint')
const SHUTDOWN_TIMEOUT_MS = 10_000

async function main(): Promise<void> {
  const env = loadEnv()
  const app = createMothershipApp(env)
  const server = createMothershipNodeServer(app)

  server.listen(env.PORT, env.HOST, () => {
    logger.info('Mothership server listening', {
      host: env.HOST,
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
    })
  })

  const shutdown = () => {
    logger.info('Mothership shutdown requested')
    app.startShutdown()
    server.close(() => {
      logger.info('Mothership server closed')
      process.exit(0)
    })
    setTimeout(() => {
      logger.error('Forced Mothership shutdown after timeout')
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  logger.error('Failed to start Mothership server', error)
  process.exit(1)
})
