'use strict';

const { handleQueryEntity } = require('./handler');

module.exports = {
  tool: {
    name: 'query_entity',
    description:
      'Fetch a collection of records from an OData entity set. ' +
      'Use discover_metadata first to find available entity names and their properties. ' +
      'Supports OData query options to filter, expand, select, sort, and page results.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          description: 'Entity set name to query (e.g. A_SalesOrder).',
        },
        $filter: {
          type: 'string',
          description: 'OData $filter expression (e.g. "SalesOrderType eq \'OR\'").',
        },
        $expand: {
          type: 'string',
          description: 'Comma-separated navigation properties to expand (e.g. to_Item,to_Partner).',
        },
        $select: {
          type: 'string',
          description:
            'Comma-separated list of properties to return (e.g. SalesOrder,SalesOrderType).',
        },
        $top: {
          type: 'number',
          description: 'Maximum number of records to return.',
        },
        $skip: {
          type: 'number',
          description: 'Number of records to skip (for pagination).',
        },
        $orderby: {
          type: 'string',
          description: 'Sort expression (e.g. CreationDate desc).',
        },
      },
      required: ['entity'],
    },
  },
  handler: handleQueryEntity,
};
