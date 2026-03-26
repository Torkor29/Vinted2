import { createLogger } from './logger.js';

const log = createLogger('retry');

/**
 * Retry with exponential backoff.
 * Detects silent failures (empty arrays/objects) as retriable.
 */
export async function withRetry(fn, {
  attempts = 3,
  backoffMs = 2000,
  label = 'operation',
  isSilentFailure = null,
} = {}) {
  let lastError;

  for (let i = 1; i <= attempts; i++) {
    try {
      const result = await fn();

      // Detect silent failures (empty response from Vinted when session is dead)
      if (isSilentFailure && isSilentFailure(result)) {
        log.warn(`${label}: silent failure detected (attempt ${i}/${attempts})`);
        if (i < attempts) {
          await sleep(backoffMs * i);
          continue;
        }
        return { success: false, silentFailure: true, data: result };
      }

      return { success: true, data: result };
    } catch (error) {
      lastError = error;
      log.warn(`${label}: attempt ${i}/${attempts} failed - ${error.message}`);

      if (i < attempts) {
        const delay = backoffMs * Math.pow(1.5, i - 1) + Math.random() * 1000;
        await sleep(delay);
      }
    }
  }

  log.error(`${label}: all ${attempts} attempts failed`);
  return { success: false, error: lastError };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { sleep };
