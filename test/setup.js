// test/setup.js
// Global Vitest setup — referenced by vitest.config.js#test.setupFiles.
// Silences pino logger before any test loads src/core/server.js; the pino
// instance in src/core/lib/logger.js reads process.env.LOG_LEVEL at
// construction time. Suppresses console.error so intentional error-path tests
// (OData 4xx/5xx, auth failures) do not pollute stderr during green runs.
/* global beforeEach, afterEach, vi */

process.env.LOG_LEVEL = 'silent';

let consoleErrorSpy;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});
