'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Register tools here. Each file exports { tool, handler }.
// ─────────────────────────────────────────────────────────────────────────────
const tools = [
  require('./discover-services'),
  require('./discover-metadata'),
  require('./query-entity'),
  require('./get-entity-by-key'),

  // require('./your-new-tool'),
];

module.exports = { tools };
