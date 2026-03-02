/**
 * Cloudflare Worker for Git LFS artefact API
 *
 * Provides endpoints for storing and retrieving build artefacts by their LFS hash.
 * All endpoints require API key authentication via X-API-Key header.
 */

const API_KEY_SECRET = 'ARTEFACT_API_KEY';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
};

/**
 * Handle CORS preflight requests
 */
function handleCorsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Max-Age': '86400',
    }
  });
}

/**
 * Verify API key from request headers
 */
function verifyApiKey(request, env) {
  const apiKey = request.headers.get('X-API-Key');
  const secret = env[API_KEY_SECRET];
  if (!secret) {
    console.error('ARTEFACT_API_KEY secret not configured');
    return false;
  }
  return apiKey === secret;
}

/**
 * Validate LFS hash format (must be 64 character hex string for SHA-256)
 */
function isValidHash(hash) {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Compute SHA-256 hash of a binary buffer
 */
async function computeHash(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Get object from R2 bucket
 */
async function getFromR2(key, env) {
  const object = await env.ARTEFACT_BUCKET.get(key);
  if (!object) return null;

  const buffer = await object.arrayBuffer();
  return { buffer, httpMetadata: object.httpMetadata };
}

/**
 * Put object to R2 bucket
 */
async function putToR2(key, body, env) {
  await env.ARTEFACT_BUCKET.put(key, body, {
    httpMetadata: { contentType: 'application/octet-stream' }
  });
}

const METHODS = {
  OPTIONS: (request, env, ctx) => handleCorsPreflight(),
  PUT: async (request, env, ctx) => {
    if (!verifyApiKey(request, env)) {
      return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const hash = url.pathname.split('/').pop();

    if (!hash || !isValidHash(hash)) {
      return new Response('Invalid LFS hash format. Expected 64 character SHA-256 hash.', {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const existing = await getFromR2(hash, env);
    if (existing) {
      return new Response('Artefact already exists', {
        status: 409,
        headers: CORS_HEADERS
      });
    }

    try {
      const buffer = await request.arrayBuffer();

      const actualHash = await computeHash(buffer);
      if (actualHash.toLowerCase() !== hash.toLowerCase()) {
        return new Response(`Hash mismatch. Content hash: ${actualHash}, URL hash: ${hash}`, {
          status: 400,
          headers: CORS_HEADERS
        });
      }

      await putToR2(hash, buffer, env);

      return new Response('Artefact uploaded successfully', {
        status: 201,
        headers: CORS_HEADERS
      });
    } catch (error) {
      console.error('Upload error:', error);
      return new Response(`Upload failed: ${error.message}`, {
        status: 500,
        headers: CORS_HEADERS
      });
    }
  },
  GET: async (request, env, ctx) => {
    const url = new URL(request.url);
    const hash = url.pathname.split('/').pop();

    if (!hash || !isValidHash(hash)) {
      return new Response('Invalid LFS hash format', {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const result = await getFromR2(hash, env);
    if (!result) {
      return new Response('Artefact not found', {
        status: 404,
        headers: CORS_HEADERS
      });
    }

    const headers = new Headers(CORS_HEADERS);
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('ETag', `"${hash}"`);

    return new Response(result.buffer, { headers });
  },
  POST: async (request, env, ctx) => {
    if (!verifyApiKey(request, env)) {
      return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/batch-check') {
      try {
        const body = await request.json();
        const hashes = Array.isArray(body) ? body : [];
        
        const results = {};
        for (const hash of hashes) {
          if (!isValidHash(hash)) {
            continue;
          }
          const exists = await env.ARTEFACT_BUCKET.head(hash);
          results[hash] = exists !== null;
        }

        return new Response(JSON.stringify(results, null, 2), {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        return new Response(`Invalid request body: ${error.message}`, {
          status: 400,
          headers: CORS_HEADERS
        });
      }
    }

    return new Response('Endpoint not found', { status: 404, headers: CORS_HEADERS });
  }
};

export default {
  async fetch(request, env, ctx) {
    const method = request.method;
    const handler = METHODS[method];

    if (!handler) {
      return new Response('Method not allowed', { 
        status: 405,
        headers: CORS_HEADERS
      });
    }

    return handler(request, env, ctx);
  }
};
