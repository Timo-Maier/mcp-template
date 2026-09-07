'use strict';

require('@sap/xsenv').loadEnv();

const { createApp } = require('./core/server');
const { SERVICES } = require('./constants');
const logger = require('./core/lib/logger');

const port = parseInt(process.env.PORT ?? '4004', 10);
const app = createApp();

app.listen(port, () => {
  logger.info(`[server] MCP server listening on port ${port}`);
  for (const [name, { destination, path }] of Object.entries(SERVICES)) {
    logger.info(`[server] Service '${name}': ${destination}${path}`);
  }
});
