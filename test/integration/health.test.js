// test/integration/health.test.js
// Integration tests for the GET /health route.
// Drives the real Express app via supertest with @sap/xsenv and @sap/xssec
// stubbed via proxyquire so the XSUAA strategy does not require real credentials.
// The health endpoint is unprotected — no Authorization header is needed.
/* global describe, it, expect */

const proxyquire = require('proxyquire').noPreserveCache();
const request = require('supertest');
const { xsenvFactory, xssecFactory } = require('../helpers/auth-stub');

const { createApp } = proxyquire('../../src/core/server', {
  '@sap/xsenv': xsenvFactory(),
  '@sap/xssec': xssecFactory(),
});

describe('GET /health', () => {
  it('returns 200 with status "ok"', async () => {
    await request(createApp()).get('/health').expect(200);
  });

  it('returns only status in the response body', async () => {
    const res = await request(createApp()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
