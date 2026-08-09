import { createClient, logger, retry, bearerAuth } from '@hsblabs/http-command';

export const httpbinClient = createClient({
  baseUrl: 'https://httpbin.org',
  middleware: [
    retry({ maxAttempts: 3 }),
    logger((event) => {
      if (event.phase === 'response') {
        console.log(`[httpbin] ${event.method} ${event.url} - ${event.status} (${event.durationMs}ms)`);
      }
    }),
  ],
});

// Example of a client with bearer authentication
export const httpbinAuthClient = createClient({
  baseUrl: 'https://httpbin.org',
  middleware: [
    bearerAuth('my-secret-token'),
    retry({ maxAttempts: 3 }),
    logger((event) => {
      if (event.phase === 'response') {
        console.log(`[httpbin-auth] ${event.method} ${event.url} - ${event.status}`);
      }
    }),
  ],
});
