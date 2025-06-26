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
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent, X-Requested-With, Accept-Encoding',
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

    // Determine the host based on the path
    let targetHost;
    if (pathname.startsWith("/static/")) {
      targetHost = ASSET_HOST;
    } else if (pathname.startsWith("/decide/")) {
      targetHost = DECIDE_HOST;
    } else {
      targetHost = API_HOST;
    }

    return forwardRequest(request, targetHost, pathWithParams, allowOrigin);
  }

  async function forwardRequest(request, targetHost, pathWithParams, 
  allowOrigin) {
    try {
      // Clone the request properly for forwarding
      const modifiedRequest = new
  Request(`https://${targetHost}${pathWithParams}`, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? await
  request.blob() : null
      });

      const response = await fetch(modifiedRequest);

      // Create new response with CORS headers
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });

      newResponse.headers.set('Access-Control-Allow-Origin', allowOrigin);
      newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Agent, X-Requested-With, Accept-Encoding');
      newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
      newResponse.headers.set('Vary', 'Origin');

      return newResponse;
    } catch (error) {
      // Return detailed error for debugging
      return new Response(JSON.stringify({
        error: 'Proxy request failed',
        message: error.message,
        target: `https://${targetHost}${pathWithParams}`,
        method: request.method
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

  export default {
    async fetch(request, env, ctx) {
      return handleRequest(request, ctx);
    }
  };