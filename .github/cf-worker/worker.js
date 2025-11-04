/**
 * Cloudflare Worker to proxy requests to R2 bucket
 *
 * Provides directory index handling: serves /path/index.html when /path/ is requested.
 * R2 custom domains don't support this by default.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle OPTIONS requests (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // Only handle GET and HEAD requests for actual content
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Remove leading slash from pathname to get the R2 key
    let key = url.pathname.slice(1);

    // If no key (root path), return a simple response
    if (!key) {
      return new Response('R2 Proxy Worker', { status: 200 });
    }

    // Fetch from R2
    let object = await env.R2_BUCKET.get(key);

    // Directory index handling: if path ends with /, try index.html
    if (object === null && key.endsWith('/')) {
      const keyWithIndex = key + 'index.html';
      object = await env.R2_BUCKET.get(keyWithIndex);
      if (object !== null) {
        key = keyWithIndex;
      }
    }

    if (object === null) {
      return new Response('Not Found', { status: 404 });
    }

    // Get the object headers from R2 metadata (includes Content-Type)
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    // Add CORS headers
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    // Add cache headers: aggressive caching for immutable files, private for others
    if (key.includes('/immutable/')) {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      headers.set('Cache-Control', 'private, max-age=300');
    }

    // Return the object
    return new Response(object.body, {
      headers,
      status: 200,
    });
  }
};
