'use strict';

const { XMLParser } = require('fast-xml-parser');
const { odataGet } = require('../../lib/odata');
const { SERVICES } = require('../../constants');

const METADATA_TRUNCATE_LIMIT = 50_000;

function parseMetadata(xml) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const parsed = parser.parse(xml);

  // Navigate to EntityType nodes (OData V2/V4 both use edmx:Edmx > edmx:DataServices > Schema)
  const edmx = parsed['edmx:Edmx'] ?? parsed['Edmx'];
  const dataServices = edmx?.['edmx:DataServices'] ?? edmx?.['DataServices'];
  const schemas = dataServices?.['Schema'];
  const schemaList = Array.isArray(schemas) ? schemas : schemas ? [schemas] : [];

  const entityTypes = [];

  for (const schema of schemaList) {
    const rawTypes = schema['EntityType'];
    const typeList = Array.isArray(rawTypes) ? rawTypes : rawTypes ? [rawTypes] : [];

    for (const et of typeList) {
      const rawProps = et['Property'];
      const propList = Array.isArray(rawProps) ? rawProps : rawProps ? [rawProps] : [];

      const rawNavProps = et['NavigationProperty'];
      const navList = Array.isArray(rawNavProps) ? rawNavProps : rawNavProps ? [rawNavProps] : [];

      entityTypes.push({
        Name: String(et['Name'] ?? ''),
        properties: propList.map(p => ({
          Name: p['Name'] ?? '',
          Type: p['Type'] ?? '',
          Nullable: p['Nullable'],
        })),
        navigationProperties: navList.map(n => ({ Name: n['Name'] ?? '', Type: n['Type'] ?? '' })),
      });
    }
  }

  return entityTypes;
}

function formatForLlm(entityTypes) {
  if (entityTypes.length === 0) {
    return 'No entity types found in metadata.';
  }

  const lines = [`Found ${entityTypes.length} entity type(s):\n`];

  for (const et of entityTypes) {
    lines.push(`## ${et.Name}`);

    if (et.properties.length > 0) {
      lines.push('Properties:');
      for (const p of et.properties) {
        const nullable = p.Nullable === 'false' ? ' (required)' : '';
        lines.push(`  - ${p.Name}: ${p.Type}${nullable}`);
      }
    }

    if (et.navigationProperties.length > 0) {
      lines.push('Navigation Properties:');
      for (const n of et.navigationProperties) {
        lines.push(`  - ${n.Name} → ${n.Type}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

async function handleDiscoverMetadata(args, userJwt) {
  const { service: serviceName } = args;
  const service = SERVICES[serviceName];
  if (!service) {
    throw new Error(`Unknown service '${serviceName}'. Use discover_services to list available services.`);
  }

  const metadataPath = `${service.path}/$metadata`;

  const xml = await odataGet(service.destination, metadataPath, userJwt, undefined, { Accept: 'application/xml' });
  const entityTypes = parseMetadata(xml);
  let output = formatForLlm(entityTypes);

  if (output.length > METADATA_TRUNCATE_LIMIT) {
    output =
      output.slice(0, METADATA_TRUNCATE_LIMIT) +
      '\n\n[TRUNCATED] Metadata response exceeded limit. ' +
      'Use a more specific service_path to narrow the results.';
  }

  return output;
}

module.exports = { handleDiscoverMetadata, parseMetadata, formatForLlm };
