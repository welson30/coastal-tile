# Coastal Tile Installation — website

Static site (HTML/CSS/JS) + one Vercel serverless function (`api/estimate.js`) for the estimate form. No build step.

## Before launch (placeholders)
1. `config.js`: phone, public email, service area cities. Empty values stay hidden.
2. `config.js`: `showDbaLine: true` only after the DBA under DealsConnect LLC is registered.
3. Domain: redeploy with the final domain (canonical, sitemap, Open Graph use https://coastal-tile.vercel.app today).
4. Warranty: the written warranty terms (duration, exclusions, materials) referenced on the site must exist.
5. Confirm fireplace surrounds and pool tile are services the installer actually does; otherwise remove that block in index.html.

## Form email (Resend) — Vercel → Project → Settings → Environment Variables
- `RESEND_API_KEY` — from resend.com (free tier)
- `ESTIMATE_TO_EMAIL` — inbox that receives requests
- `ESTIMATE_FROM_EMAIL` — e.g. `Coastal Tile <estimates@yourdomain.com>` after verifying the domain in Resend.
Without these, the form shows "Online requests aren't connected yet" instead of pretending to send.

## Regenerating
`scripts/` in the working project rebuilds `index.html` from the template and the photo list.
