// Unit tests for the admin API's request validation.
// Run with:  cd lambda && npm install && npm test
// These cover the paths that return before any AWS call, so no credentials are needed.

const test = require('node:test');
const assert = require('node:assert');
const { handler, _internal } = require('./index');

// Build a minimal API Gateway (HTTP API v2) event.
function event({ method = 'GET', path = '/admin/api/content', query, body, email = 'staff@example.com' } = {}) {
  return {
    rawPath: path,
    queryStringParameters: query,
    body: body === undefined ? undefined : JSON.stringify(body),
    requestContext: {
      http: { method },
      authorizer: email ? { jwt: { claims: { email, sub: 'abc' } } } : undefined
    }
  };
}

test('OPTIONS preflight returns 204 without auth', async () => {
  const res = await handler(event({ method: 'OPTIONS', email: null }));
  assert.strictEqual(res.statusCode, 204);
});

test('missing JWT claims returns 401', async () => {
  const res = await handler(event({ email: null }));
  assert.strictEqual(res.statusCode, 401);
});

test('/me returns the signed-in email', async () => {
  const res = await handler(event({ path: '/admin/api/me' }));
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).email, 'staff@example.com');
});

test('GET rejects files outside the whitelist', async () => {
  const res = await handler(event({ query: { file: '../admin/js/admin-auth.js' } }));
  assert.strictEqual(res.statusCode, 400);
});

test('PUT rejects an HTML fragment instead of overwriting the page', async () => {
  const res = await handler(event({
    method: 'PUT',
    body: { file: 'faq.html', content: '<div class="faq-item">Q</div>' }
  }));
  assert.strictEqual(res.statusCode, 422);
});

test('PUT rejects malformed JSON', async () => {
  const e = event({ method: 'PUT' });
  e.body = '{not json';
  const res = await handler(e);
  assert.strictEqual(res.statusCode, 400);
});

test('isFullHtmlDocument', () => {
  assert.ok(_internal.isFullHtmlDocument('<!DOCTYPE html><html lang="en"><head></head><body></body></html>'));
  assert.ok(!_internal.isFullHtmlDocument('<div>fragment</div>'));
});
