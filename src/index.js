'use strict';

require('@sap/xsenv').loadEnv();

const { createApp } = require('./core/server');
const { DESTINATION_NAME } = require('./constants');
const logger = require('./core/lib/logger');

const port = parseInt(process.env.PORT ?? '4004', 10);
const app = createApp();

app.listen(port, () => {
  logger.info(`[server] MCP server listening on port ${port}`);
  logger.info(`[server] Destination: ${DESTINATION_NAME}`);
});
