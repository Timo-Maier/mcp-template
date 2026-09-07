'use strict';

const { handleDiscoverMetadata } = require('./handler');

module.exports = {
  tool: {
    name: 'discover_metadata',
    description:
      'Fetch and display the OData $metadata document from the configured backend. ' +
      'Returns entity types with their properties and navigation properties. ' +
      'Always call this first to understand the available entities before querying data.',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Service name to query. Use discover_services to list available services.',
        },
      },
      required: ['service'],
    },
  },
  handler: handleDiscoverMetadata,
};
