 /**
   * PostHog Reverse Proxy Worker for Cloudflare
   * 
   * This worker proxies requests to PostHog's EU region to avoid ad blockers
   * and improve analytics reliability.
   * 
   * Deploy this to Cloudflare Workers and assign custom domains:
   * - Production: e.takebackcontrol.me
   * - Staging: e.takebackcontrol.moi
   */

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
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // Add CORS headers to cached/fetched static assets
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })

    newResponse.headers.set('Access-Control-Allow-Origin', '*')
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    return newResponse
  }

  async function forwardRequest(request, pathWithSearch) {
    const originRequest = new Request(request)
    originRequest.headers.delete("cookie")

    const response = await fetch(`https://${API_HOST}${pathWithSearch}`,
  originRequest)

    // Add CORS headers to API responses
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })

    newResponse.headers.set('Access-Control-Allow-Origin', '*')
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    return newResponse
  }

  export default {
    async fetch(request, env, ctx) {
      return handleRequest(request, ctx);
    }
  }
