# PostHog Reverse Proxy

A Cloudflare Worker that acts as a reverse proxy for PostHog analytics.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure your PostHog region in `src/index.js`:
   - For US region: Keep default settings
   - For EU region: Change API_HOST and ASSET_HOST to EU endpoints

3. Deploy to Cloudflare:
   ```bash
   npm run deploy
   ```

## Development

Run locally:
```bash
npm run dev
```

## Configuration

Update the hosts in `src/index.js` based on your PostHog region:
- US: `us.i.posthog.com` and `us-assets.i.posthog.com`
- EU: `eu.i.posthog.com` and `eu-assets.i.posthog.com`