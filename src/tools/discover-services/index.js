'use strict';

const { handleDiscoverServices } = require('./handler');

module.exports = {
  tool: {
    name: 'discover_services',
    description:
      'List all available OData services. ' +
      'Returns each service name and a short description. ' +
      'Use the service name as the required "service" parameter in discover_metadata, query_entity, and get_entity_by_key.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  handler: handleDiscoverServices,
};
