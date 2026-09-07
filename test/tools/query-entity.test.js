// test/tools/query-entity.test.js
// Unit tests for src/tools/query-entity/handler.js.
// proxyquire stubs src/lib/odata; tests verify path construction, query-param
// forwarding, top/skip string coercion, and error propagation.
/* global describe, it, expect, vi, beforeEach */

const proxyquire = require('proxyquire').noPreserveCache();
const { ORDER_LIST_RESPONSE, makeOdataError } = require('../helpers/fixtures');

const odataGetMock = vi.fn();
const { handleQueryEntity } = proxyquire('../../src/tools/query-entity/handler', {
  '../../lib/odata': { odataGet: odataGetMock, '@noCallThru': true },
});

const JWT = 'test-jwt';

beforeEach(() => {
  odataGetMock.mockReset();
});

// ─── Path construction ────────────────────────────────────────────────────────

describe('handleQueryEntity — path and query construction', () => {
  it('builds the entity path as SERVICE_PATH/entity', async () => {
    odataGetMock.mockResolvedValue(ORDER_LIST_RESPONSE);
    await handleQueryEntity({ entity: 'Orders' }, JWT);
    const [path] = odataGetMock.mock.calls[0];
    expect(path).toBe('/example/Orders');
  });

  it('passes the JWT as the second argument to odataGet', async () => {
    odataGetMock.mockResolvedValue(ORDER_LIST_RESPONSE);
    await handleQueryEntity({ entity: 'Orders' }, JWT);
    const [, jwt] = odataGetMock.mock.calls[0];
    expect(jwt).toBe(JWT);
  });

  it('passes undefined as the query argument when no OData options are provided', async () => {
    odataGetMock.mockResolvedValue(ORDER_LIST_RESPONSE);
    await handleQueryEntity({ entity: 'Orders' }, JWT);
    const [, , query] = odataGetMock.mock.calls[0];
    expect(query).toBeUndefined();
  });

  it('forwards filter to the query object', async () => {
    odataGetMock.mockResolvedValue(ORDER_LIST_RESPONSE);
    await handleQueryEntity({ entity: 'Orders', filter: "Status eq 'Open'" }, JWT);
    const [, , query] = odataGetMock.mock.calls[0];
    expect(query['$filter']).toBe("Status eq 'Open'");
  });

  it('coerces top and skip to strings before forwarding', async () => {
    odataGetMock.mockResolvedValue(ORDER_LIST_RESPONSE);
    await handleQueryEntity({ entity: 'Orders', top: 10, skip: 5 }, JWT);
    const [, , query] = odataGetMock.mock.calls[0];
    expect(query['$top']).toBe('10');
    expect(query['$skip']).toBe('5');
  });

  it('forwards expand, select, and orderby when provided', async () => {
    odataGetMock.mockResolvedValue(ORDER_LIST_RESPONSE);
    await handleQueryEntity(
      { entity: 'Orders', expand: 'to_Item', select: 'OrderID', orderby: 'Date desc' },
      JWT
    );
    const [, , query] = odataGetMock.mock.calls[0];
    expect(query['$expand']).toBe('to_Item');
    expect(query['$select']).toBe('OrderID');
    expect(query['$orderby']).toBe('Date desc');
  });
});

// ─── Response and error handling ──────────────────────────────────────────────

describe('handleQueryEntity — response handling', () => {
  it('returns JSON.stringify(data, null, 2) of the odataGet response', async () => {
    odataGetMock.mockResolvedValue(ORDER_LIST_RESPONSE);
    const result = await handleQueryEntity({ entity: 'Orders' }, JWT);
    expect(result).toBe(JSON.stringify(ORDER_LIST_RESPONSE, null, 2));
  });

  it('propagates errors thrown by odataGet', async () => {
    odataGetMock.mockRejectedValue(makeOdataError(400, 'Invalid filter'));
    await expect(handleQueryEntity({ entity: 'Orders', filter: 'bad' }, JWT)).rejects.toThrow(
      'OData request failed: HTTP 400 — Invalid filter'
    );
  });
});
