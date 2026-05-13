/**
 * Serenity Spa Admin API
 * Single Lambda handler for all admin content endpoints
 *
 * Routes:
 *   GET  /admin/api/content?file={filename}  — read file from S3
 *   PUT  /admin/api/content                  — write file to S3 + invalidate CF cache
 *   GET  /admin/api/me                       — return authenticated user info
 */

const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand
} = require('@aws-sdk/client-s3');

const {
  CloudFrontClient,
  CreateInvalidationCommand
} = require('@aws-sdk/client-cloudfront');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const cf = new CloudFrontClient({ region: 'us-east-1' }); // CloudFront is global

const BUCKET = process.env.S3_BUCKET_NAME;
const CF_DISTRIBUTION_ID = process.env.CF_DISTRIBUTION_ID;

// Allowed file targets (whitelist to prevent arbitrary file access)
const ALLOWED_FILES = new Set([
  'index.html',
  'treatments.html',
  'services.html',
  'about.html',
  'contact.html',
  'faq.html',
  'knowledge-base.md'
]);

// MIME types for supported files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.rawPath || '';
  const headers = normalizeHeaders(event.headers || {});

  // CORS headers
  const cors = {
    'Access-Control-Allow-Origin': process.env.ADMIN_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS'
  };

  // Handle preflight
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  // Verify JWT from Cognito (API Gateway Authorizer passes claims)
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
    return respond(500, { error: 'Internal server error' }, cors);
  }
};

// GET /admin/api/me — return current user info
function handleMe(claims, cors) {
  return respond(200, {
    email: claims.email,
    name: claims.name || claims['cognito:username'] || claims.email,
    sub: claims.sub
  }, cors);
}

// GET /admin/api/content?file={filename} — read file from S3
async function handleGetContent(event, cors) {
  const filename = event.queryStringParameters?.file;

  if (!filename || !ALLOWED_FILES.has(filename)) {
    return respond(400, { error: 'Invalid or missing file parameter' }, cors);
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: filename
  });

  const result = await s3.send(command);
  const content = await streamToString(result.Body);

  return {
    statusCode: 200,
    headers: {
      ...cors,
      'Content-Type': 'text/plain; charset=utf-8'
    },
    body: content
  };
}

// PUT /admin/api/content — write file to S3 and invalidate CloudFront cache
async function handlePutContent(event, claims, cors) {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return respond(400, { error: 'Invalid JSON body' }, cors);
  }

  const { file, content } = body;

  if (!file || !ALLOWED_FILES.has(file)) {
    return respond(400, { error: 'Invalid or missing file' }, cors);
  }

  if (typeof content !== 'string' || content.length === 0) {
    return respond(400, { error: 'Content must be a non-empty string' }, cors);
  }

  const ext = '.' + file.split('.').pop();
  const contentType = MIME_TYPES[ext] || 'text/plain; charset=utf-8';

  // Write to S3
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: file,
    Body: content,
    ContentType: contentType,
    CacheControl: ext === '.html'
      ? 'public, max-age=3600, must-revalidate'
      : 'public, max-age=86400'
  }));

  // Invalidate CloudFront cache
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

  console.log(`Updated ${file} by ${claims.email}. Invalidation: ${invalidationId}`);

  return respond(200, {
    success: true,
    file,
    invalidationId
  }, cors);
}

// Utility: stream S3 body to string
function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

// Utility: normalize header keys to lowercase
function normalizeHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
}

// Utility: build API response
function respond(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  };
}
