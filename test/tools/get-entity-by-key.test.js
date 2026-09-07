// test/tools/get-entity-by-key.test.js
// Unit tests for src/tools/get-entity-by-key/handler.js.
// proxyquire stubs src/lib/odata; tests cover: buildKeySegment (single key,
// composite numeric, composite string quoting, whitespace trimming, invalid
// format error) and handleGetEntityByKey (URL path, query params, response).
/* global describe, it, expect, vi, beforeEach */

const proxyquire = require('proxyquire').noPreserveCache();
const { ORDER_SINGLE_RESPONSE, makeOdataError } = require('../helpers/fixtures');

const odataGetMock = vi.fn();
const { handleGetEntityByKey, buildKeySegment } = proxyquire(
  '../../src/tools/get-entity-by-key/handler',
  { '../../lib/odata': { odataGet: odataGetMock, '@noCallThru': true } }
);

const JWT = 'test-jwt';

beforeEach(() => {
  odataGetMock.mockReset();
});

// ─── buildKeySegment ──────────────────────────────────────────────────────────

describe('buildKeySegment', () => {
  it('returns the raw value unchanged for a single non-composite key', () => {
    expect(buildKeySegment('0000000001')).toBe('0000000001');
  });

  it('returns a bare numeric value unchanged', () => {
    expect(buildKeySegment('42')).toBe('42');
  });

  it('leaves numeric values in composite keys unquoted', () => {
    expect(buildKeySegment('SalesOrder=100,SalesOrderItem=10')).toBe(
      'SalesOrder=100,SalesOrderItem=10'
    );
  });

  it('wraps string values in composite keys with single quotes', () => {
    expect(buildKeySegment('Category=BOOK,ID=42')).toBe("Category='BOOK',ID=42");
  });

  it('quotes all values in an all-string composite key', () => {
    expect(buildKeySegment('First=Foo,Second=Bar')).toBe("First='Foo',Second='Bar'");
  });

  it('trims whitespace around pairs and values', () => {
    expect(buildKeySegment(' Key = Val ')).toBe("Key='Val'");
  });

  it('throws an Error for a composite pair that is missing the equals sign', () => {
    expect(() => buildKeySegment('ValidKey=1,InvalidPair')).toThrow(
      "Invalid key format: 'InvalidPair'. Expected 'Field=Value'."
    );
  });
});

// ─── handleGetEntityByKey ─────────────────────────────────────────────────────

describe('handleGetEntityByKey — path construction', () => {
  it('builds SERVICE_PATH/entity(key) for a single numeric key', async () => {
    odataGetMock.mockResolvedValue(ORDER_SINGLE_RESPONSE);
    await handleGetEntityByKey({ entity: 'Orders', key: '1' }, JWT);
    const [path] = odataGetMock.mock.calls[0];
    expect(path).toBe('/example/Orders(1)');
  });

  it('builds the path with a composite key segment', async () => {
    odataGetMock.mockResolvedValue(ORDER_SINGLE_RESPONSE);
    await handleGetEntityByKey({ entity: 'Items', key: 'SalesOrder=100,Item=10' }, JWT);
    const [path] = odataGetMock.mock.calls[0];
    expect(path).toBe('/example/Items(SalesOrder=100,Item=10)');
  });
});

describe('handleGetEntityByKey — query params', () => {
  it('passes $expand to the query object when provided', async () => {
    odataGetMock.mockResolvedValue(ORDER_SINGLE_RESPONSE);
    await handleGetEntityByKey({ entity: 'Orders', key: '1', expand: 'to_Item' }, JWT);
    const [, , query] = odataGetMock.mock.calls[0];
    expect(query?.['$expand']).toBe('to_Item');
  });

  it('passes $select to the query object when provided', async () => {
    odataGetMock.mockResolvedValue(ORDER_SINGLE_RESPONSE);
    await handleGetEntityByKey({ entity: 'Orders', key: '1', select: 'OrderID,Status' }, JWT);
    const [, , query] = odataGetMock.mock.calls[0];
    expect(query?.['$select']).toBe('OrderID,Status');
  });

  it('passes undefined as query when neither $expand nor $select is given', async () => {
    odataGetMock.mockResolvedValue(ORDER_SINGLE_RESPONSE);
    await handleGetEntityByKey({ entity: 'Orders', key: '1' }, JWT);
    const [, , query] = odataGetMock.mock.calls[0];
    expect(query).toBeUndefined();
  });
});

describe('handleGetEntityByKey — response handling', () => {
  it('returns JSON.stringify(data, null, 2) of the odataGet response', async () => {
    odataGetMock.mockResolvedValue(ORDER_SINGLE_RESPONSE);
    const result = await handleGetEntityByKey({ entity: 'Orders', key: '1' }, JWT);
    expect(result).toBe(JSON.stringify(ORDER_SINGLE_RESPONSE, null, 2));
  });

  it('propagates errors thrown by odataGet', async () => {
    odataGetMock.mockRejectedValue(makeOdataError(404, 'Not Found'));
    await expect(handleGetEntityByKey({ entity: 'Orders', key: '999' }, JWT)).rejects.toThrow(
      'OData request failed: HTTP 404 — Not Found'
    );
  });
});
