# MCP Server Template — SAP BTP

A Node.js MCP (Model Context Protocol) server template for SAP BTP Cloud Foundry. It exposes OData backend APIs to AI agents (e.g. Claude) via HTTP with XSUAA authentication and principal propagation.

## Architecture

```
MCP Client (Claude / AI agent)
  │  HTTP POST /mcp  (Bearer JWT from XSUAA)
  ▼
MCP Server (this app, running on BTP CF)
  │  validates JWT via @sap/xssec
  │  exchanges JWT for backend token via Destination Service (OAuth2UserTokenExchange)
  ▼
OData Backend (S/4HANA, BTP, etc.)
```

Each deployed instance wraps **one** OData backend via a single named SAP Destination.

## Prerequisites

- Node.js 20+
- SAP BTP subaccount with:
  - XSUAA service instance (`xsuaa` plan: `application`)
  - Destination service instance
  - A configured Destination pointing to your OData backend
- Cloud Foundry CLI (`cf`) logged in to your target space

## Project Structure

```
src/
  index.js                        ← Entrypoint — loads env, starts HTTP server
  constants.js                    ← ⭐ Configure DESTINATION_NAME and SERVICE_PATH here
  core/
    server.js                     ← Express app, /mcp and /health endpoints
    lib/
      mcp.js                      ← Registers tools with the MCP SDK
      xsuaa.js                    ← XSUAA JWT validation middleware
      logger.js                   ← Pino logger
  lib/
    odata.js                      ← Generic OData HTTP client (uses SAP Cloud SDK)
  tools/
    index.js                      ← ⭐ Register tools here
    discover-metadata/            ← Built-in: fetches $metadata and formats it for LLMs
    query-entity/                 ← Built-in: queries an entity set with OData options
    get-entity-by-key/            ← Built-in: fetches a single record by primary key
scripts/
  bind-services.sh                ← Fetches CF service keys and writes default-env.json
  build-srv.sh                    ← Copies src/ to gen/ for MTA deployment
mta.yaml                          ← MTA deployment descriptor
xs-security.json                  ← XSUAA app security descriptor
default-env.json.example          ← Template for local credentials file
```

## Getting Started

### 1. Configure destination and service path

Edit `src/constants.js` — this is the primary configuration file:

```js
const DESTINATION_NAME = 'MY_ODATA_DESTINATION'; // name of your SAP Destination
const SERVICE_PATH = '/sap/opu/odata/sap/MY_SRV'; // OData service root path
```

`DESTINATION_NAME` must match the name of an existing SAP Destination in your BTP subaccount. `SERVICE_PATH` is the base path that all tool requests are prefixed with.

### 2. Install dependencies

```bash
npm install
```

### 3. Set up local credentials

The app reads BTP service credentials from `default-env.json` (loaded by `@sap/xsenv`). This file is git-ignored and must never be committed.

**Option A — automated (recommended):** pull credentials directly from CF service keys:

```bash
npm run bind-services
```

This script (`scripts/bind-services.sh`) creates service keys for `mcp-xsuaa` and `mcp-destination` in your logged-in CF space and writes `default-env.json` automatically. Requires `cf` CLI to be logged in and the service instances to exist.

**Option B — manual:** copy the example and fill in the values:

```bash
cp default-env.json.example default-env.json
# Edit default-env.json and fill in clientid, clientsecret, url, etc.
```

### 4. Run locally

```bash
npm run dev        # starts with --watch (auto-restarts on file changes)
npm start          # plain node
npm run inspect    # launches MCP Inspector UI for interactive testing
```

The server listens on `http://localhost:4004` by default. Override with the `PORT` environment variable.

### 5. Add custom tools

Open `src/tools/index.js` and add an entry to the `tools` array:

```js
const tools = [
  require('./discover-metadata'),
  require('./query-entity'),
  require('./get-entity-by-key'),

  require('./my-custom-tool'),   // ← add your tool here
];
```

Create the tool as a directory under `src/tools/`:

```
src/tools/my-custom-tool/
  index.js    ← exports { tool, handler }
  handler.js  ← implements the handler function
```

`index.js` defines the tool name, description, and input schema:

```js
'use strict';
const { handleMyTool } = require('./handler');

module.exports = {
  tool: {
    name: 'my_custom_tool',
    description: 'What this tool does — shown to the AI agent.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'The sales order ID.' },
        top:     { type: 'number', description: 'Max results to return.' },
      },
      required: ['orderId'],
    },
  },
  handler: handleMyTool,
};
```

`handler.js` receives the validated args and the user's JWT for principal propagation:

```js
'use strict';
const { odataGet } = require('../../lib/odata');
const { SERVICE_PATH } = require('../../constants');

async function handleMyTool({ orderId, top }, userJwt) {
  const data = await odataGet(`${SERVICE_PATH}/A_SalesOrder`, userJwt, {
    $filter: `SalesOrder eq '${orderId}'`,
    $top: String(top ?? 10),
  });
  return JSON.stringify(data, null, 2);
}

module.exports = { handleMyTool };
```

### 6. Add an MCP server to Claude Desktop

To use this server from the Claude Desktop app, add it to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-btp-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-template/src/index.js"],
      "env": {}
    }
  }
}
```

For a deployed instance on BTP CF, use the `url` transport instead:

```json
{
  "mcpServers": {
    "my-btp-mcp": {
      "type": "http",
      "url": "https://<app-url>.cfapps.<region>.hana.ondemand.com/mcp"
    }
  }
}
```

## Built-in Tools

### `discover_metadata`

Fetches the OData `$metadata` document from `SERVICE_PATH/$metadata` and returns a structured summary of entity types, properties, and navigation properties. Call this first to understand what entities are available.

### `query_entity`

Queries an entity set collection. Supports `$filter`, `$expand`, `$select`, `$top`, `$skip`, and `$orderby`.

```
query_entity({ entity: "A_SalesOrder", $filter: "SalesOrderType eq 'OR'", $top: 5 })
```

### `get_entity_by_key`

Fetches a single record by primary key. For composite keys, use comma-separated `Field=Value` pairs.

```
get_entity_by_key({ entity: "A_SalesOrder", key: "0000000001" })
get_entity_by_key({ entity: "A_SalesOrderItem", key: "SalesOrder=0000000001,SalesOrderItem=10" })
```

## Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /mcp` | XSUAA JWT (Bearer) | MCP JSON-RPC endpoint |
| `GET /mcp` | XSUAA JWT (Bearer) | MCP SSE stream endpoint |
| `GET /health` | None | Returns `{ "status": "ok" }` |

## Deploy to BTP Cloud Foundry

```bash
# First time: create service instances
cf create-service xsuaa application mcp-xsuaa -c xs-security.json
cf create-service destination lite mcp-destination

# Build and deploy via MTA
npm run build
cf deploy mta_archives/mcp-server-template_1.0.0.mtar
```

Or without MTA:

```bash
npm run build
cf push
```

## Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with file-watch (auto-restart) |
| `npm start` | Start production server |
| `npm run inspect` | Open MCP Inspector for interactive testing |
| `npm run bind-services` | Pull CF service keys → write `default-env.json` |
| `npm run build` | Copy `src/` to `gen/` for deployment |
| `npm test` | Run tests with Vitest |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
