import express from 'express';

import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 4000;

/** Build an Express application without starting a network listener. */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use((_request, response) => {
    response.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  return app;
}

/** Start the API and return the Node HTTP server for lifecycle control. */
export function startServer({
  app = createApp(),
  port = Number(process.env.PORT) || DEFAULT_PORT,
  host = '0.0.0.0',
} = {}) {
  return app.listen(port, host, () => {
    process.stdout.write(`Server listening on ${host}:${port}\n`);
  });
}

const isDirectExecution = process.argv[1]
  && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  startServer();
}
