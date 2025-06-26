const API_HOST = "eu.i.posthog.com"
  const ASSET_HOST = "eu-assets.i.posthog.com"

  async function handleRequest(request, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent',
          'Access-Control-Max-Age': '86400'
        }
      })
    }

    const url = new URL(request.url)
    const pathname = url.pathname
    const search = url.search
    const pathWithParams = pathname + search

    if (pathname.startsWith("/static/")) {
        return retrieveStatic(request, pathWithParams, ctx)
    } else {
        return forwardRequest(request, pathWithParams)
    }
  }

  async function retrieveStatic(request, pathname, ctx) {
    let response = await caches.default.match(request)
    if (!response) {
        response = await fetch(`https://${ASSET_HOST}${pathname}`)
        ctx.waitUntil(caches.default.put(request, response.clone()))
    }

    // Add CORS headers to static assets for Safari compatibility
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })

    newResponse.headers.set('Access-Control-Allow-Origin', '*')
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Agent')
    newResponse.headers.set('Access-Control-Max-Age', '86400')

    return newResponse
  }

  async function forwardRequest(request, pathWithSearch) {
    const originRequest = new Request(request)
    originRequest.headers.delete("cookie")

    try {
      const response = await fetch(`https://${API_HOST}${pathWithSearch}`,
  originRequest)

      // Add CORS headers to all API responses for Safari compatibility
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })

      newResponse.headers.set('Access-Control-Allow-Origin', '*')
      newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Agent')
      newResponse.headers.set('Access-Control-Max-Age', '86400')

      // Add Vary header for better caching
      newResponse.headers.set('Vary', 'Origin')

      return newResponse
    } catch (error) {
      // Return a proper error response with CORS headers
      return new Response(JSON.stringify({ error: 'Proxy request failed' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent'
        }
      })
    }
  }

  export default {
    async fetch(request, env, ctx) {
      return handleRequest(request, ctx);
    }
  }