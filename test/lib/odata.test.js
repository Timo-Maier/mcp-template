// test/lib/odata.test.js
// Unit tests for src/lib/odata.js — the central OData HTTP client.
// proxyquire stubs @sap-cloud-sdk/http-client so no real outbound calls occur.
// Tests verify: query-string construction, single-quote preservation, Accept
// header, and the three branches of the error-message extraction logic.
/* global describe, it, expect, vi, beforeEach */

const proxyquire = require('proxyquire').noPreserveCache();

const executeHttpRequestMock = vi.fn();
const { odataGet } = proxyquire('../../src/lib/odata', {
  '@sap-cloud-sdk/http-client': {
    executeHttpRequest: executeHttpRequestMock,
    '@noCallThru': true,
  },
});

const JWT = 'test-jwt-token';
const DEST = 'skillconnect-srv-api-client-credentials';

beforeEach(() => {
  executeHttpRequestMock.mockReset();
});

// ─── Happy-path ───────────────────────────────────────────────────────────────

describe('odataGet — request construction', () => {
  it('passes destinationName and jwt to executeHttpRequest', async () => {
    executeHttpRequestMock.mockResolvedValue({ status: 200, data: { value: [] } });
    await odataGet('/example/Orders', JWT);
    const [dest] = executeHttpRequestMock.mock.calls[0];
    expect(dest.destinationName).toBe(DEST);
    expect(dest.jwt).toBe(JWT);
  });

  it('sends GET with Accept: application/json header', async () => {
    executeHttpRequestMock.mockResolvedValue({ status: 200, data: {} });
    await odataGet('/example/Orders', JWT);
    const [, req] = executeHttpRequestMock.mock.calls[0];
    expect(req.method).toBe('GET');
    expect(req.headers.Accept).toBe('application/json');
  });

  it('omits query string when no query object is provided', async () => {
    executeHttpRequestMock.mockResolvedValue({ status: 200, data: {} });
    await odataGet('/example/Orders', JWT);
    const [, req] = executeHttpRequestMock.mock.calls[0];
    expect(req.url).toBe('/example/Orders');
  });

  it('omits query string when query object is empty', async () => {
    executeHttpRequestMock.mockResolvedValue({ status: 200, data: {} });
    await odataGet('/example/Orders', JWT, {});
    const [, req] = executeHttpRequestMock.mock.calls[0];
    expect(req.url).toBe('/example/Orders');
  });

  it('appends $top and $filter to the URL when provided', async () => {
    executeHttpRequestMock.mockResolvedValue({ status: 200, data: {} });
    await odataGet('/path', JWT, { $top: '5', $filter: "Status eq 'Open'" });
    const [, req] = executeHttpRequestMock.mock.calls[0];
    expect(req.url).toContain('$top=5');
    expect(req.url).toContain("$filter=Status eq 'Open'");
  });

  it('preserves single quotes that arrive as %27 in a $filter value', async () => {
    // SAP backends reject percent-encoded quotes in OData filter expressions.
    executeHttpRequestMock.mockResolvedValue({ status: 200, data: {} });
    await odataGet('/path', JWT, { $filter: 'Name eq %27Foo%27' });
    const [, req] = executeHttpRequestMock.mock.calls[0];
    expect(req.url).toContain("$filter=Name eq 'Foo'");
  });

  it('returns response.data on success', async () => {
    const data = { value: [{ id: 1 }] };
    executeHttpRequestMock.mockResolvedValue({ status: 200, data });
    const result = await odataGet('/path', JWT);
    expect(result).toEqual(data);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('odataGet — error handling', () => {
  it('throws with HTTP status and string error message on 4xx', async () => {
    executeHttpRequestMock.mockResolvedValue({
      status: 404,
      statusText: 'Not Found',
      data: { error: { message: 'Entity not found' } },
    });
    await expect(odataGet('/path', JWT)).rejects.toThrow(
      'OData request failed: HTTP 404 — Entity not found'
    );
  });

  it('throws with nested message.value on 5xx', async () => {
    executeHttpRequestMock.mockResolvedValue({
      status: 500,
      statusText: 'Internal Server Error',
      data: { error: { message: { value: 'Something went wrong' } } },
    });
    await expect(odataGet('/path', JWT)).rejects.toThrow(
      'OData request failed: HTTP 500 — Something went wrong'
    );
  });

  it('falls back to statusText when error body is absent', async () => {
    executeHttpRequestMock.mockResolvedValue({
      status: 503,
      statusText: 'Service Unavailable',
      data: {},
    });
    await expect(odataGet('/path', JWT)).rejects.toThrow(
      'OData request failed: HTTP 503 — Service Unavailable'
    );
  });
});
