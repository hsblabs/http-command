import { createClient, logger, retry } from '@hsblabs/http-command';

export const animechanClient = createClient({
  baseUrl: 'https://api.animechan.io/v1',
  middleware: [
    retry({ maxAttempts: 3 }),
    logger((event) => {
      if (event.phase === 'response') {
        console.log(`[Animechan] ${event.method} ${event.url} - ${event.status} (${event.durationMs}ms)`);
      }
    }),
  ],
});
