'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');
const { tools } = require('../../tools/index');
const logger = require('./logger');

function jsonSchemaToZod(def) {
  if (!def || typeof def !== 'object') return z.unknown();

  const { type, description, properties, required: innerRequired, items } = def;
  let zodType;

  switch (type) {
    case 'string':
      zodType = z.string();
      break;
    case 'number':
      zodType = z.number();
      break;
    case 'boolean':
      zodType = z.boolean();
      break;
    case 'array': {
      const itemZod = items ? jsonSchemaToZod(items) : z.unknown();
      zodType = z.array(itemZod);
      break;
    }
    case 'object': {
      const innerProps = properties ?? {};
      const reqArr = Array.isArray(innerRequired) ? innerRequired : [];
      const innerShape = {};
      for (const [k, propDef] of Object.entries(innerProps)) {
        const mapped = jsonSchemaToZod(propDef);
        // eslint-disable-next-line security/detect-object-injection -- k comes from Object.entries() on a trusted schema
        innerShape[k] = reqArr.includes(k) ? mapped : mapped.optional();
      }
      zodType = Object.keys(innerShape).length > 0
        ? z.object(innerShape)
        : z.record(z.string(), z.unknown());
      break;
    }
    default:
      zodType = z.unknown();
  }

  if (description) zodType = zodType.describe(description);
  return zodType;
}

function buildMcpServer(userJwt) {
  const server = new McpServer({
    name: 'mcp-server-template',
    version: '1.0.0',
  });

  for (const { tool, handler } of tools) {
    const props = tool.inputSchema?.properties;
    const required = Array.isArray(tool.inputSchema?.required) ? tool.inputSchema.required : [];

    const shape = {};
    if (props) {
      for (const [key, def] of Object.entries(props)) {
        const zodType = jsonSchemaToZod(def);
        // eslint-disable-next-line security/detect-object-injection -- key comes from Object.entries() on a trusted schema, not user input
        shape[key] = required.includes(key) ? zodType : zodType.optional();
      }
    }

    // JWT is captured in closure — tool handler runs on behalf of the authenticated user
    server.tool(tool.name, tool.description ?? '', shape, async args => {
      try {
        const result = await handler(args, userJwt);
        return { content: [{ type: 'text', text: result }] };
      } catch (err) {
        logger.error({ err, tool: tool.name }, '[mcp] Tool handler error');
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    });
  }

  return server;
}

module.exports = { buildMcpServer };
