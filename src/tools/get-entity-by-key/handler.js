'use strict';

const { odataGet } = require('../../lib/odata');
const { SERVICES } = require('../../constants');

function buildKeySegment(key) {
  const pairs = key.split(',').map(s => s.trim());

  if (pairs.length === 1 && !pairs[0].includes('=')) {
    return pairs[0];
  }

  return pairs
    .map(pair => {
      const eq = pair.indexOf('=');
      if (eq === -1) throw new Error(`Invalid key format: '${pair}'. Expected 'Field=Value'.`);
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const serialized = /^\d+$/.test(value) ? value : `'${value}'`;
      return `${name}=${serialized}`;
    })
    .join(',');
}

async function handleGetEntityByKey(args, userJwt) {
  const { service: serviceName, entity, key, expand, select } = args;
  const service = SERVICES[serviceName];
  if (!service) {
    throw new Error(`Unknown service '${serviceName}'. Use discover_services to list available services.`);
  }

  const path = `${service.path}/${entity}(${buildKeySegment(key)})`;

  const query = {};
  if (expand) query['$expand'] = expand;
  if (select) query['$select'] = select;

  const data = await odataGet(service.destination, path, userJwt, Object.keys(query).length ? query : undefined);

  return JSON.stringify(data, null, 2);
}

module.exports = { handleGetEntityByKey, buildKeySegment };
