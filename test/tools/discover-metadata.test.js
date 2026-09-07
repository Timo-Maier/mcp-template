// test/tools/discover-metadata.test.js
// Unit tests for src/tools/discover-metadata/handler.js.
// proxyquire stubs src/lib/odata so no real OData calls are made.
// Covers: XML parsing (parseMetadata), LLM formatting (formatForLlm), the
// 50 KB truncation guard, and the full handleDiscoverMetadata flow.
/* global describe, it, expect, vi, beforeEach */

const proxyquire = require('proxyquire').noPreserveCache();
const { METADATA_XML, METADATA_XML_EMPTY, makeOdataError } = require('../helpers/fixtures');

const odataGetMock = vi.fn();
const { handleDiscoverMetadata, parseMetadata, formatForLlm } = proxyquire(
  '../../src/tools/discover-metadata/handler',
  { '../../lib/odata': { odataGet: odataGetMock, '@noCallThru': true } }
);

beforeEach(() => {
  odataGetMock.mockReset();
});

// ─── parseMetadata ────────────────────────────────────────────────────────────

describe('parseMetadata', () => {
  it('extracts entity type names from edmx:Edmx XML', () => {
    const result = parseMetadata(METADATA_XML);
    expect(result.map(e => e.Name)).toEqual(['Order', 'Customer']);
  });

  it('extracts property names and types', () => {
    const [order] = parseMetadata(METADATA_XML);
    expect(order.properties[0]).toMatchObject({ Name: 'OrderID', Type: 'Edm.Int32' });
    expect(order.properties[1]).toMatchObject({ Name: 'CustomerName', Type: 'Edm.String' });
  });

  it('captures Nullable="false" on properties', () => {
    const [order] = parseMetadata(METADATA_XML);
    expect(order.properties[0].Nullable).toBe('false');
    expect(order.properties[1].Nullable).toBeUndefined();
  });

  it('extracts navigation properties with Name and Type', () => {
    const [order] = parseMetadata(METADATA_XML);
    expect(order.navigationProperties).toHaveLength(1);
    expect(order.navigationProperties[0]).toMatchObject({
      Name: 'Items',
      Type: 'My.Service.OrderItem',
    });
  });

  it('returns an empty array when no entity types exist in the schema', () => {
    expect(parseMetadata(METADATA_XML_EMPTY)).toEqual([]);
  });

  it('handles an entity type with no navigation properties', () => {
    const [, customer] = parseMetadata(METADATA_XML);
    expect(customer.navigationProperties).toEqual([]);
  });
});

// ─── formatForLlm ─────────────────────────────────────────────────────────────

describe('formatForLlm', () => {
  it('returns fallback message for an empty entity list', () => {
    expect(formatForLlm([])).toBe('No entity types found in metadata.');
  });

  it('includes entity count in the header line', () => {
    const result = formatForLlm([{ Name: 'Order', properties: [], navigationProperties: [] }]);
    expect(result).toContain('Found 1 entity type(s)');
  });

  it('renders each entity name as a markdown ## heading', () => {
    const result = formatForLlm([{ Name: 'Order', properties: [], navigationProperties: [] }]);
    expect(result).toContain('## Order');
  });

  it('renders property name and type on a single line', () => {
    const et = {
      Name: 'Order',
      properties: [{ Name: 'OrderID', Type: 'Edm.Int32', Nullable: undefined }],
      navigationProperties: [],
    };
    expect(formatForLlm([et])).toContain('- OrderID: Edm.Int32');
  });

  it('appends (required) when Nullable is "false"', () => {
    const et = {
      Name: 'Order',
      properties: [{ Name: 'OrderID', Type: 'Edm.Int32', Nullable: 'false' }],
      navigationProperties: [],
    };
    expect(formatForLlm([et])).toContain('- OrderID: Edm.Int32 (required)');
  });

  it('renders navigation properties with arrow notation', () => {
    const et = {
      Name: 'Order',
      properties: [],
      navigationProperties: [{ Name: 'Items', Type: 'My.Service.OrderItem' }],
    };
    expect(formatForLlm([et])).toContain('- Items → My.Service.OrderItem');
  });

  it('omits the Properties section when the entity has no properties', () => {
    const et = { Name: 'Empty', properties: [], navigationProperties: [] };
    expect(formatForLlm([et])).not.toContain('Properties:');
  });
});

// ─── handleDiscoverMetadata ───────────────────────────────────────────────────

describe('handleDiscoverMetadata', () => {
  it('calls odataGet with the $metadata path and the provided JWT', async () => {
    odataGetMock.mockResolvedValue(METADATA_XML);
    await handleDiscoverMetadata({}, 'my-jwt');
    expect(odataGetMock).toHaveBeenCalledWith('/example/$metadata', 'my-jwt', undefined, { Accept: 'application/xml' });
  });

  it('returns a formatted string describing the entity types', async () => {
    odataGetMock.mockResolvedValue(METADATA_XML);
    const result = await handleDiscoverMetadata({}, 'my-jwt');
    expect(result).toContain('## Order');
    expect(result).toContain('## Customer');
  });

  it('returns the empty fallback when metadata contains no entity types', async () => {
    odataGetMock.mockResolvedValue(METADATA_XML_EMPTY);
    const result = await handleDiscoverMetadata({}, 'my-jwt');
    expect(result).toBe('No entity types found in metadata.');
  });

  it('appends a TRUNCATED notice when the output exceeds 50 000 characters', async () => {
    // Produce an XML doc whose formatted output exceeds the truncation limit by
    // repeating a large number of entity types.
    const manyEntities = Array.from(
      { length: 500 },
      (_, i) => `
      <EntityType Name="Entity${i}">
        ${'<Property Name="Prop" Type="Edm.String"/>'.repeat(30)}
      </EntityType>`
    ).join('');
    const largeXml = `<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
  <edmx:DataServices><Schema Namespace="Big">${manyEntities}</Schema></edmx:DataServices>
</edmx:Edmx>`;
    odataGetMock.mockResolvedValue(largeXml);
    const result = await handleDiscoverMetadata({}, 'my-jwt');
    expect(result).toContain('[TRUNCATED]');
  });

  it('propagates errors thrown by odataGet', async () => {
    odataGetMock.mockRejectedValue(makeOdataError(503, 'Backend down'));
    await expect(handleDiscoverMetadata({}, 'my-jwt')).rejects.toThrow(
      'OData request failed: HTTP 503 — Backend down'
    );
  });
});
