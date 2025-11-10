/**
 * Cloudflare Worker to proxy requests to R2 bucket
 *
 * Provides directory index handling: serves /path/index.html when /path/ is requested.
 * R2 custom domains don't support this by default.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
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
 * Check if HTTP method is allowed
 */
function isMethodAllowed(method) {
  return method === 'GET' || method === 'HEAD';
}

/**
 * Fetch object from R2 bucket
 */
async function fetchFromR2(key, env) {
  return await env.R2_BUCKET.get(key);
}

/**
 * Create a 301 redirect response to a new pathname
 */
function createRedirectResponse(url, newPathname) {
  const redirectUrl = new URL(url);
  redirectUrl.pathname = newPathname;
  return Response.redirect(redirectUrl.toString(), 301);
}

/**
 * Get cache-control header value based on key pattern
 */
function getCacheControl(key) {
  if (key.includes('/immutable/')) {
    return 'public, max-age=31536000, immutable';
  }
  return 'private, max-age=300';
}

/**
 * Build response headers from R2 object and key
 */
function buildResponseHeaders(object, key) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Access-Control-Allow-Origin', CORS_HEADERS['Access-Control-Allow-Origin']);
  headers.set('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
  headers.set('Cache-Control', getCacheControl(key));
  return headers;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return handleCorsPreflight();
    if (!isMethodAllowed(request.method)) return new Response('Method not allowed', { status: 405 });

    const url = new URL(request.url);
    let key = url.pathname.slice(1);
    if (!key) return createRedirectResponse(url, '/main/');

    // Try direct fetch
    let object = await fetchFromR2(key, env);
    let actualKey = key;

    // Try directory index: /foo/ -> /foo/index.html
    if (!object && key.endsWith('/')) {
      object = await fetchFromR2(key + 'index.html', env);
      if (object) actualKey = key + 'index.html';
    }

    // Try directory redirect: /foo -> /foo/
    if (!object && !key.endsWith('/')) {
      const dirCheck = await fetchFromR2(key + '/index.html', env);
      if (dirCheck) {
        return createRedirectResponse(url, '/' + key + '/');
      }
    }

    if (!object) return new Response('Not Found', { status: 404 });

    const headers = buildResponseHeaders(object, actualKey);
    return new Response(object.body, { headers, status: 200 });
  }
};
