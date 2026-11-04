import { ConfigError, loadConfig } from './config.ts';
import { jsonLogger } from './logger.ts';
import { createCollabServer } from './server.ts';

async function main(): Promise<void> {
  const server = createCollabServer(loadConfig(process.env), jsonLogger);
  const address = await server.start();
  jsonLogger('collab.listening', { host: address.address, port: address.port });

  const shutdown = (signal: NodeJS.Signals): void => {
    jsonLogger('collab.stopping', { signal });
    server.stop().then(
      () => {
        process.exitCode = 0;
      },
      (error: unknown) => {
        jsonLogger('collab.stop_failed', { message: String(error) });
        process.exitCode = 1;
      },
    );
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  const message = error instanceof ConfigError ? error.message : String(error);
  jsonLogger('collab.fatal', { message });
  process.exitCode = 1;
});
