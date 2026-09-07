'use strict';

const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

async function odataGet(destination, path, userJwt, query, headers = { Accept: 'application/json' }) {
  let url = path;
  if (query && Object.keys(query).length) {
    // Build query string manually so that $filter single quotes are not percent-encoded,
    // which some SAP backends reject (e.g. Name eq 'Foo' must stay as-is).
    const qs = Object.entries(query)
      .map(([k, v]) => `${k}=${v.replace(/%27/g, "'")}`)
      .join('&');
    url = `${path}?${qs}`;
  }

  const response = await executeHttpRequest(
    { destinationName: destination, jwt: userJwt },
    {
      method: 'GET',
      url,
      headers,
    }
  );

  if (response.status >= 400) {
    const msg = response.data?.error?.message;
    const errorDetail = typeof msg === 'string' ? msg : (msg?.value ?? response.statusText);
    throw new Error(`OData request failed: HTTP ${response.status} — ${errorDetail}`);
  }

  return response.data;
}

module.exports = { odataGet };
