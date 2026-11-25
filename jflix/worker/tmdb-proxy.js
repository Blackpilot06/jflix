// Cloudflare Worker: keeps your TMDB credentials server-side and exposes ONLY a small allow-list of read-only
// TMDB endpoints to your GitHub Pages site. Secrets (set with `wrangler secret put`):
//   TMDB_TOKEN    v4 Read Access Token (preferred, sent as a Bearer header)
//   TMDB_API_KEY  v3 key (used only if TMDB_TOKEN is not set)
// Variable: ALLOWED_ORIGINS = comma-separated site origins, e.g. https://yourname.github.io
const ALLOW = [
  /^\/(movie|tv)\/(popular|top_rated|upcoming|now_playing|on_the_air|airing_today)$/,
  /^\/trending\/(movie|tv|all)\/(day|week)$/,
  /^\/(movie|tv)\/\d+(\/(credits|recommendations|similar|videos|external_ids|watch\/providers))?$/,
  /^\/search\/(multi|movie|tv)$/,
  /^\/genre\/(movie|tv)\/list$/,
  /^\/discover\/(movie|tv)$/,
  /^\/watch\/providers\/(movie|tv)$/
];
export default {
  async fetch(req, env, ctx) {
    const origins = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const origin = req.headers.get("Origin") || "";
    const allowed = origins.includes(origin);
    const cors = { "Vary": "Origin", "Access-Control-Allow-Methods": "GET, OPTIONS", ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}) };
    if (req.method === "OPTIONS") return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: cors });
    if (!allowed) return new Response("Forbidden", { status: 403, headers: cors });

    const u = new URL(req.url), path = u.pathname.replace(/^\/3(?=\/)/, "");
    if (!ALLOW.some(r => r.test(path))) return new Response("Not found", { status: 404, headers: cors });

    const q = new URLSearchParams(u.search);
    q.delete("api_key");                               // never accept a key from the browser
    const headers = { Accept: "application/json" };
    if (env.TMDB_TOKEN) headers.Authorization = "Bearer " + env.TMDB_TOKEN;
    else if (env.TMDB_API_KEY) q.set("api_key", env.TMDB_API_KEY);
    else return new Response("Proxy not configured", { status: 500, headers: cors });

    const upstream = "https://api.themoviedb.org/3" + path + "?" + q;
    const cacheKey = new Request(upstream.replace(/([?&])api_key=[^&]+&?/, "$1"));   // cache key never contains the secret
    let res = await caches.default.match(cacheKey);
    if (!res) {
      const r = await fetch(upstream, { headers });
      res = new Response(r.body, r);
      res.headers.set("Cache-Control", "public, max-age=" + (r.ok ? 900 : 30));
      if (r.ok) ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  }
};
