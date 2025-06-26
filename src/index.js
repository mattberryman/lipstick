  const API_HOST = "eu.i.posthog.com"
  const ASSET_HOST = "eu-assets.i.posthog.com"

  async function handleRequest(request, ctx) {
    const origin = request.headers.get('Origin')

    // Define allowed origins for both staging and production
    const allowedOrigins = [
      'https://takebackcontrol.moi',    // staging
      'https://takebackcontrol.me',     // production
      'http://localhost:3000',          // local development
      'https://localhost:3000'          // local development with SSL
    ]

    // Determine which origin to allow - must be specific for credentials
    let allowOrigin = null
    if (origin && allowedOrigins.includes(origin)) {
      allowOrigin = origin
    } else {
      // Fallback to staging domain if no valid origin (for direct requests)
      allowOrigin = 'https://takebackcontrol.moi'
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
      })
    }

    const url = new URL(request.url)
    const pathname = url.pathname
    const search = url.search
    const pathWithParams = pathname + search

    // Route static assets to asset host
    if (pathname.startsWith("/static/")) {
      return retrieveStatic(request, pathWithParams, ctx, allowOrigin)
    }
    // Route ALL other PostHog endpoints to API host
    // This includes: /s/, /decide/, /e/, /engage/, /batch/, /capture/, etc.
    else {
      return forwardRequest(request, pathWithParams, allowOrigin)
    }
  }

  async function retrieveStatic(request, pathname, ctx, allowOrigin) {
    let response = await caches.default.match(request)
    if (!response) {
      response = await fetch(`https://${ASSET_HOST}${pathname}`)
      ctx.waitUntil(caches.default.put(request, response.clone()))
    }

    // Create new response with CORS headers for credentials
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })

    newResponse.headers.set('Access-Control-Allow-Origin', allowOrigin)
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Agent, X-Requested-With')
    newResponse.headers.set('Access-Control-Allow-Credentials', 'true')
    newResponse.headers.set('Access-Control-Max-Age', '86400')
    newResponse.headers.set('Vary', 'Origin')

    return newResponse
  }

  async function forwardRequest(request, pathWithSearch, allowOrigin) {
    const originRequest = new Request(request)
    // Keep cookies for PostHog session tracking
    // originRequest.headers.delete("cookie")

    try {
      const response = await fetch(`https://${API_HOST}${pathWithSearch}`,
  originRequest)

      // Create new response with proper CORS headers for credentials
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })

      newResponse.headers.set('Access-Control-Allow-Origin', allowOrigin)
      newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
      newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Agent, X-Requested-With')
      newResponse.headers.set('Access-Control-Allow-Credentials', 'true')
      newResponse.headers.set('Vary', 'Origin')

      return newResponse
    } catch (error) {
      // Return proper error response with CORS headers
      return new Response(JSON.stringify({
        error: 'Proxy request failed',
        message: error.message
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowOrigin,
          'Access-Control-Allow-Credentials': 'true',
          'Vary': 'Origin'
        }
      })
    }
  }

  export default {
    async fetch(request, env, ctx) {
      return handleRequest(request, ctx);
    }
  }