'use strict';

const { SERVICES } = require('../../constants');

function handleDiscoverServices() {
  const services = Object.entries(SERVICES).map(([name, { description }]) => ({ name, description }));
  return JSON.stringify(services, null, 2);
}

module.exports = { handleDiscoverServices };
