'use strict';

const { odataGet } = require('../../lib/odata');
const { SERVICES } = require('../../constants');

async function handleQueryEntity(args, userJwt) {
  const { service: serviceName, entity, filter, expand, select, top, skip, orderby } = args;
  const service = SERVICES[serviceName];
  if (!service) {
    throw new Error(`Unknown service '${serviceName}'. Use discover_services to list available services.`);
  }

  const path = `${service.path}/${entity}`;

  const query = {};
  if (filter != null) query['$filter'] = filter;
  if (expand != null) query['$expand'] = expand;
  if (select != null) query['$select'] = select;
  if (top != null) query['$top'] = String(top);
  if (skip != null) query['$skip'] = String(skip);
  if (orderby != null) query['$orderby'] = orderby;

  const data = await odataGet(service.destination, path, userJwt, Object.keys(query).length ? query : undefined);

  return JSON.stringify(data, null, 2);
}

module.exports = { handleQueryEntity };
