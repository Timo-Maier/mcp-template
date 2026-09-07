// test/integration/mcp-tools.test.js
// Integration tests for the POST /mcp route — verifies that the three OData
// tools are registered and reachable via the MCP JSON-RPC protocol.
// proxyquire stubs @sap/xsenv, @sap/xssec, and @sap-cloud-sdk/http-client so
// no real credentials or outbound calls are required.
//
// Call-count accounting per tools/call invocation:
//   executeHttpRequestMock call 0 — odataGet inside the invoked handler
/* global describe, it, expect, vi, beforeEach */

const proxyquire = require('proxyquire').noPreserveCache();
const request = require('supertest');
const { xsenvFactory, xssecFactory } = require('../helpers/auth-stub');
require('../helpers/fixtures');

// MCP-protocol Accept header required by StreamableHTTPServerTransport.
const MCP_ACCEPT = 'application/json, text/event-stream';

const executeHttpRequestMock = vi.fn();

const { createApp } = proxyquire('../../src/core/server', {
  '@sap/xsenv': xsenvFactory(),
  '@sap/xssec': xssecFactory(),
  '@sap-cloud-sdk/http-client': {
    executeHttpRequest: executeHttpRequestMock,
    '@global': true,
    '@noCallThru': true,
  },
});

const app = createApp();

beforeEach(() => {
  executeHttpRequestMock.mockReset();
});

// ─── Sanity — MCP session initialisation ──────────────────────────────────────

describe('POST /mcp — MCP protocol', () => {
  it('rejects a plain JSON-RPC body without the MCP Accept header with 406', async () => {
    await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
      .expect(406);
  });

  it('returns 200 for an MCP initialize request', async () => {
    await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('Accept', MCP_ACCEPT)
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      })
      .expect(200);
  });
});

// ─── tools/list ──────────────────────────────────────────────────────────────

describe('POST /mcp tools/list', () => {
  async function listTools() {
    // Server runs in stateless mode (sessionIdGenerator: undefined) — each
    // request is independent; no initialize handshake required.
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('Accept', MCP_ACCEPT)
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

    // StreamableHTTPServerTransport returns SSE; parse first data event.
    const lines = res.text.split('\n').filter(l => l.startsWith('data: '));
    return JSON.parse(lines[0].slice(6));
  }

  it('returns all three registered tools', async () => {
    const body = await listTools();
    const names = body.result.tools.map(t => t.name).sort();
    expect(names).toEqual(['discover_metadata', 'get_entity_by_key', 'query_entity']);
  });

  it('discover_metadata has no required parameters', async () => {
    const body = await listTools();
    const tool = body.result.tools.find(t => t.name === 'discover_metadata');
    expect(tool.inputSchema.required ?? []).toHaveLength(0);
  });

  it('query_entity lists "entity" as a required parameter', async () => {
    const body = await listTools();
    const tool = body.result.tools.find(t => t.name === 'query_entity');
    expect(tool.inputSchema.required).toContain('entity');
  });

  it('get_entity_by_key lists "entity" and "key" as required parameters', async () => {
    const body = await listTools();
    const tool = body.result.tools.find(t => t.name === 'get_entity_by_key');
    expect(tool.inputSchema.required).toContain('entity');
    expect(tool.inputSchema.required).toContain('key');
  });
});
