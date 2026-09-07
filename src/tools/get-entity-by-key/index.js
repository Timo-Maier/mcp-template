'use strict';

const { handleGetEntityByKey } = require('./handler');

module.exports = {
  tool: {
    name: 'get_entity_by_key',
    description:
      'Fetch a single OData record by its primary key. ' +
      'Use discover_metadata first to find the entity name and key fields. ' +
      'For a single key field provide only the value; for composite keys use Field=Value pairs separated by commas.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          description: 'Entity set name (e.g. A_SalesOrder).',
        },
        key: {
          type: 'string',
          description:
            "Key value(s). Single key: just the value (e.g. '0000000001'). Composite key: comma-separated Field=Value pairs (e.g. SalesOrder=0000000001,SalesOrderItem=10).",
        },
        expand: {
          type: 'string',
          description: 'Comma-separated navigation properties to expand.',
        },
        select: {
          type: 'string',
          description: 'Comma-separated list of properties to return.',
        },
      },
      required: ['entity', 'key'],
    },
  },
  handler: handleGetEntityByKey,
};
