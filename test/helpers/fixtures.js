// test/helpers/fixtures.js
// OData response fixtures and test-data constants — single source of truth for
// upstream response shapes consumed by the three tool handlers.

const { FAKE_USER, FAKE_XSUAA } = require('./auth-stub');

// Minimal OData $metadata XML with one entity type, two properties, and a
// navigation property. Matches the subset that parseMetadata() extracts.
const METADATA_XML = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
  <edmx:DataServices>
    <Schema Namespace="My.Service">
      <EntityType Name="Order">
        <Property Name="OrderID" Type="Edm.Int32" Nullable="false"/>
        <Property Name="CustomerName" Type="Edm.String"/>
        <NavigationProperty Name="Items" Type="My.Service.OrderItem"/>
      </EntityType>
      <EntityType Name="Customer">
        <Property Name="CustomerID" Type="Edm.String" Nullable="false"/>
        <Property Name="Email" Type="Edm.String"/>
      </EntityType>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

// OData $metadata with no entity types — exercises the empty-result branch.
const METADATA_XML_EMPTY = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
  <edmx:DataServices>
    <Schema Namespace="Empty.Service"/>
  </edmx:DataServices>
</edmx:Edmx>`;

// Canonical OData collection response returned by executeHttpRequest for entity queries.
const ORDER_LIST_RESPONSE = {
  value: [
    { OrderID: 1, CustomerName: 'Alice' },
    { OrderID: 2, CustomerName: 'Bob' },
  ],
};

// Single-entity response returned by GET Entity(key).
const ORDER_SINGLE_RESPONSE = {
  OrderID: 1,
  CustomerName: 'Alice',
};

// Builds an error in the shape that odataGet() propagates — status ≥ 400.
// The handler receives this as a thrown Error; the message carries the detail.
function makeOdataError(status, message = 'OData error') {
  return Object.assign(new Error(`OData request failed: HTTP ${status} — ${message}`), {
    response: { status, data: { error: { message } } },
  });
}

module.exports = {
  FAKE_USER,
  FAKE_XSUAA,
  METADATA_XML,
  METADATA_XML_EMPTY,
  ORDER_LIST_RESPONSE,
  ORDER_SINGLE_RESPONSE,
  makeOdataError,
};
