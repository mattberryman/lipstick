  const API_HOST = "eu.i.posthog.com";
  const ASSET_HOST = "eu-assets.i.posthog.com";
  const DECIDE_HOST = "eu.i.posthog.com";

  async function handleRequest(request, ctx) {
    const origin = request.headers.get('Origin');

    // Define allowed origins for both staging and production
    const allowedOrigins = [
      'https://takebackcontrol.moi',    // staging
      'https://takebackcontrol.me',     // production
      'http://localhost:3000',          // local development
      'https://localhost:3000'          // local development with SSL
    ];

    // Determine which origin to allow - must be specific for credentials
    let allowOrigin = null;
    if (origin && allowedOrigins.includes(origin)) {
      allowOrigin = origin;
    } else {
      // Fallback to staging domain if no valid origin (for direct requests)
      allowOrigin = 'https://takebackcontrol.moi';
    }

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': allowOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent, X-Requested-With',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin'
        }
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const search = url.search;
    const pathWithParams = pathname + search;

    // Determine the host based on the path (PostHog's routing logic)
    let targetHost;
    if (pathname.startsWith("/static/")) {
      targetHost = ASSET_HOST;
    } else if (pathname.startsWith("/decide/")) {
      targetHost = DECIDE_HOST;
    } else {
      // All other endpoints (/s/, /e/, /engage/, /batch/, /capture/, etc.)
      targetHost = API_HOST;
    }

    return forwardRequest(request, targetHost, pathWithParams, allowOrigin, ctx);
  }

  async function forwardRequest(request, targetHost, pathWithSearch, allowOrigin, ctx) {
    const originRequest = new Request(request);

    // For caching static assets, add cache handling
    if (targetHost === ASSET_HOST) {
      const response = await caches.default.match(request);
      if (response) {
        // Add CORS headers to cached response
        const newResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
        addCorsHeaders(newResponse, allowOrigin);
        return newResponse;
      }
    }

    try {
      const response = await fetch(`https://${targetHost}${pathWithSearch}`, originRequest);

      // Create new response with proper CORS headers for credentials
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });

      addCorsHeaders(newResponse, allowOrigin);

      // Cache static assets for better performance
      if (targetHost === ASSET_HOST && response.ok) {
        ctx.waitUntil(caches.default.put(request, response.clone()));
      }

      return newResponse;
    } catch (error) {
      // Return proper error response with CORS headers
      return new Response(JSON.stringify({
        error: 'Proxy request failed',
        message: error.message,
        target: targetHost,
        path: pathWithSearch
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowOrigin,
          'Access-Control-Allow-Credentials': 'true',
          'Vary': 'Origin'
        }
      });
    }
  }

  // Helper function to add CORS headers consistently
  function addCorsHeaders(response, allowOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Agent, X-Requested-With');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Vary', 'Origin');
  }

  export default {
    async fetch(request, env, ctx) {
      return handleRequest(request, ctx);
    }
  };