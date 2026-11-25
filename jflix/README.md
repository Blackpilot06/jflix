# JFLIX

Automated movie and TV discovery site for GitHub Pages. No admin panel, no manual uploads: a GitHub Action pulls the catalogue from TMDB every 6 hours and publishes it. Playback only through legally authorised sources.

## How authentication works (and why a proxy)

GitHub Pages only serves static files, so **anything in `index.html` or a `.js` file is public**. Your TMDB credentials therefore never go there.

| Need | Where it runs | Credential |
|---|---|---|
| Trending, popular, top rated, upcoming, TV, genres, details, trailers, cast, recommendations, where-to-watch for the ~150 most popular titles | GitHub Action (`scripts/`), saved as `data/catalogue.json` | `TMDB_TOKEN` (v4, Bearer header) or `TMDB_API_KEY` (v3) as **GitHub Secrets** |
| Search for any title, plus live cast / recommendations for titles outside the catalogue | Cloudflare Worker (`worker/`), free tier | same credentials as **Worker secrets** |

The site works without the Worker (search covers the catalogue). Add the Worker to search all of TMDB. The Worker allows only read-only GET requests to a fixed list of endpoints, only from your site's origin, and it ignores any `api_key` sent by a browser.

The v4 token is preferred and goes in an `Authorization: Bearer` header; the v3 key is used only when no token is set.

## Setup

1. **Create the repo.** Unzip, create a GitHub repository, push everything. The repo contains no secrets.
2. **Add secrets.** Settings > Secrets and variables > Actions > New repository secret:
   `TMDB_TOKEN` (your v4 Read Access Token). Optional: `TMDB_API_KEY` (v3 key), `OMDB_API_KEY` (extra ratings).
   Optional variable (Variables tab): `REGION`, e.g. `KE`, for "where to watch".
3. **Turn on Pages.** Settings > Pages > Source: **GitHub Actions**.
4. **First build.** Actions > "Build and deploy" > Run workflow. This replaces the bundled sample data with the real catalogue (a minute or two). After that it refreshes every 6 hours.
5. **Live search (optional).**
   ```
   cd worker
   # edit wrangler.toml: ALLOWED_ORIGINS = "https://YOUR-USERNAME.github.io"   (origin only, no repo path)
   npx wrangler login
   npx wrangler secret put TMDB_TOKEN      # paste the token when prompted
   npx wrangler deploy
   ```
   Copy the Worker URL into `config.js` (`PROXY_URL`), commit, push. That URL is public by design; it holds no secret.

Never paste credentials into code, issues or chat. If one leaks, regenerate it at themoviedb.org/settings/api.

## Tests

```
npm install
npm test
```
Runs the builder, the Worker and the website against a fake TMDB (no key needed): every endpoint, both auth modes, and that no credential reaches a published file.

## Adding a provider

Drop a file in `scripts/providers/metadata/` or `scripts/providers/streaming/` that exports `name` and `enrich(item)`, then list its name in `scripts/config.mjs`. Nothing else changes.

## Rights and attribution

- TMDB metadata never implies streaming rights. "Watch on" buttons open the service's own page. The in-app player is used only for sources that allow embedding (YouTube embeds, Internet Archive public-domain films); each is health-checked and hidden if it breaks.
- Keep the TMDB notice in the footer, and add the TMDB logo (themoviedb.org/about/logos-attribution). Streaming availability data is provided by JustWatch via TMDB.
- HD/FHD badges appear only when a provider supplies quality information; TMDB does not.
