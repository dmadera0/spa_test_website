/**
 * Serenity Spa Admin API — AWS Lambda handler
 * ------------------------------------------------------------
 * One Lambda function serves every admin endpoint. API Gateway (HTTP API)
 * sits in front of it with a Cognito JWT authorizer, so by the time a
 * request reaches this code the caller's token has already been verified.
 *
 * Request flow:
 *   Browser (admin panel)
 *     → API Gateway  (validates the Cognito JWT, attaches its claims)
 *     → this Lambda  (reads/writes the site's files in S3)
 *     → CloudFront   (cache invalidated so edits show up immediately)
 *
 * Routes:
 *   GET  /admin/api/content?file={filename}  — read a site file from S3
 *   PUT  /admin/api/content                  — overwrite a site file + invalidate CloudFront
 *   GET  /admin/api/me                       — return the signed-in user's info
 *
 * Environment variables (set on the Lambda function):
 *   S3_BUCKET_NAME      bucket that hosts the static site
 *   CF_DISTRIBUTION_ID  CloudFront distribution to invalidate after a write (optional)
 *   ADMIN_ORIGIN        origin allowed by CORS, e.g. https://dxxxx.cloudfront.net
 */

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');

// Clients are created once per container and reused across invocations (faster warm starts).
const s3 = new S3Client({ region: process.env.AWS_REGION });
const cf = new CloudFrontClient({ region: 'us-east-1' }); // CloudFront's API lives in us-east-1

const BUCKET = process.env.S3_BUCKET_NAME;
const CF_DISTRIBUTION_ID = process.env.CF_DISTRIBUTION_ID;

// Whitelist of files the admin panel may read or write.
// Anything not listed here is rejected, which stops path tricks like "../" or "admin/js/x.js".
const ALLOWED_FILES = new Set([
  'index.html',
  'treatments.html',
  'services.html',
  'about.html',
  'contact.html',
  'faq.html',
  'knowledge-base.md'
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

exports.handler = async (event) => {
  // Support both API Gateway payload formats (REST API v1 and HTTP API v2).
  const method = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.rawPath || '';

  const cors = {
    'Access-Control-Allow-Origin': process.env.ADMIN_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS'
  };

  // Browsers send an OPTIONS "preflight" before cross-origin PUTs; answer it with no body.
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  // API Gateway's JWT authorizer passes the verified token claims here.
  // If they're missing, the route wasn't protected — refuse rather than trust the caller.
  const claims = event.requestContext?.authorizer?.claims
    || event.requestContext?.authorizer?.jwt?.claims;

  if (!claims || !claims.email) {
    return respond(401, { error: 'Unauthorized' }, cors);
  }

  try {
    if (path.endsWith('/me')) {
      return handleMe(claims, cors);
    }

    if (path.endsWith('/content')) {
      if (method === 'GET') return await handleGetContent(event, cors);
      if (method === 'PUT') return await handlePutContent(event, claims, cors);
    }

    return respond(404, { error: 'Not found' }, cors);
  } catch (err) {
    console.error('Handler error:', err);
    // A missing S3 object is a client problem (bad file name), not a server crash.
    if (err.name === 'NoSuchKey') {
      return respond(404, { error: 'File not found' }, cors);
    }
    return respond(500, { error: 'Internal server error' }, cors);
  }
};

// GET /admin/api/me — echo back who is signed in (used to show the email in the admin header).
function handleMe(claims, cors) {
  return respond(200, {
    email: claims.email,
    name: claims.name || claims['cognito:username'] || claims.email,
    sub: claims.sub
  }, cors);
}

// GET /admin/api/content?file={filename} — return the raw file so the editor can parse it.
async function handleGetContent(event, cors) {
  const filename = event.queryStringParameters?.file;

  if (!filename || !ALLOWED_FILES.has(filename)) {
    return respond(400, { error: 'Invalid or missing file parameter' }, cors);
  }

  const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: filename }));
  const content = await result.Body.transformToString('utf-8');

  // Returned as plain text (not JSON) because the editors parse the HTML/Markdown themselves.
  return {
    statusCode: 200,
    headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' },
    body: content
  };
}

// PUT /admin/api/content — body: { "file": "faq.html", "content": "<!DOCTYPE html>..." }
async function handlePutContent(event, claims, cors) {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return respond(400, { error: 'Invalid JSON body' }, cors);
  }

  const { file, content } = body || {};

  if (!file || !ALLOWED_FILES.has(file)) {
    return respond(400, { error: 'Invalid or missing file' }, cors);
  }

  if (typeof content !== 'string' || content.length === 0) {
    return respond(400, { error: 'Content must be a non-empty string' }, cors);
  }

  const ext = '.' + file.split('.').pop();

  // SAFETY CHECK: an .html save replaces the whole public page. If the content
  // isn't a complete HTML document (e.g. an editor sent only a fragment of cards),
  // writing it would wipe the page's <head>, navigation and styles on the live site.
  if (ext === '.html' && !isFullHtmlDocument(content)) {
    return respond(422, {
      error: 'Refusing to save: content is not a complete HTML document. ' +
             'Saving it would replace the entire live page.'
    }, cors);
  }

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: file,
    Body: content,
    ContentType: MIME_TYPES[ext] || 'text/plain; charset=utf-8',
    // HTML is cached for 1 hour at the edge; the invalidation below makes this edit visible now.
    CacheControl: ext === '.html'
      ? 'public, max-age=3600, must-revalidate'
      : 'public, max-age=86400'
  }));

  // Tell CloudFront to drop its cached copy so visitors get the new version right away.
  // CallerReference must be unique per request, so a timestamp works.
  let invalidationId = null;
  if (CF_DISTRIBUTION_ID) {
    const invalidation = await cf.send(new CreateInvalidationCommand({
      DistributionId: CF_DISTRIBUTION_ID,
      InvalidationBatch: {
        Paths: { Quantity: 1, Items: [`/${file}`] },
        CallerReference: `admin-${Date.now()}`
      }
    }));
    invalidationId = invalidation.Invalidation?.Id;
  }

  // Audit trail in CloudWatch Logs: who changed what.
  console.log(`Updated ${file} by ${claims.email}. Invalidation: ${invalidationId}`);

  return respond(200, { success: true, file, invalidationId }, cors);
}

// True when the string looks like a whole page rather than a snippet.
function isFullHtmlDocument(html) {
  return /<html[\s>]/i.test(html) && /<\/html>/i.test(html) && /<body[\s>]/i.test(html);
}

// Build a JSON API Gateway response with CORS headers attached.
function respond(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  };
}

// Exported for unit tests only.
exports._internal = { isFullHtmlDocument, ALLOWED_FILES };
