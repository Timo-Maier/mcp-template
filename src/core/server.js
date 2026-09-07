'use strict';

const express = require('express');
const pinoHttp = require('pino-http');
const {
  StreamableHTTPServerTransport,
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const logger = require('./lib/logger');
const { setupAuth } = require('./lib/xsuaa');
const { buildMcpServer } = require('./lib/mcp');

function getUserJwt(req) {
  const auth = req.headers['authorization'];
  if (!auth) return undefined;
  const spaceIndex = auth.indexOf(' ');
  if (spaceIndex === -1) return undefined;
  const scheme = auth.slice(0, spaceIndex);
  if (scheme.toLowerCase() !== 'bearer') {
    logger.warn(
      '[server] Authorization header present but scheme is not Bearer — JWT not forwarded'
    );
    return undefined;
  }
  const token = auth.slice(spaceIndex + 1);
  return token.length > 0 ? token : undefined;
}

function createApp() {
  const app = express();

  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // setupAuth(app);

  // A new McpServer is created per request because each request carries a different user JWT,
  // which must be captured in the tool handler closures for principal propagation to the OData backend.
  // The transport is explicitly closed after the response finishes to prevent handle/memory leaks.
  app.post('/mcp', async (req, res) => {
    const userJwt = getUserJwt(req);
    const mcpServer = buildMcpServer(userJwt);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('finish', () => transport.close());

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logger.error({ err }, '[mcp] Request error');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  app.get('/mcp', async (req, res) => {
    const userJwt = getUserJwt(req);
    const mcpServer = buildMcpServer(userJwt);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('finish', () => transport.close());

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      logger.error({ err }, '[mcp] SSE stream error');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  return app;
}

module.exports = { createApp };
