// Catalogue source. Auth, in order of preference:
//   TMDB_TOKEN    = v4 "API Read Access Token"  -> sent as "Authorization: Bearer ..." (never in the URL)
//   TMDB_API_KEY  = v3 API key                  -> sent as ?api_key=... (used only if no token is set)
// Both come from environment variables / GitHub Secrets. Free keys: themoviedb.org/settings/api
import { getJSON, pool, esc } from "../../lib/http.mjs";
import { REGION, LANGUAGE, PAGES, displayName } from "../../config.mjs";
export const name = "TMDB";
const B = process.env.TMDB_BASE || "https://api.themoviedb.org/3";
const H = process.env.TMDB_TOKEN ? { Authorization: "Bearer " + process.env.TMDB_TOKEN } : {};
const KEY = !process.env.TMDB_TOKEN && process.env.TMDB_API_KEY ? "&api_key=" + process.env.TMDB_API_KEY : "";
export const call = (p, q = "") => getJSON(`${B}/${p}?language=${LANGUAGE}${q ? "&" + q : ""}${KEY}`, { headers: H });
const FIX = { "Science Fiction": ["Sci-Fi"], "Action & Adventure": ["Action", "Adventure"], "Sci-Fi & Fantasy": ["Sci-Fi", "Fantasy"], "War & Politics": ["War"] };
const today = new Date().toISOString().slice(0, 10);
const dn = new Intl.DisplayNames(["en"], { type: "language" });
const L = c => { try { return dn.of(c) || c; } catch { return c; } };
const path = p => /^\/[\w.-]+$/.test(p || "") ? p : "";

function norm(x, kind, G, tag, net) {
  if (x.adult || !path(x.poster_path)) return null;
  const t = x.title || x.name, d = x.release_date || x.first_air_date;
  if (!t || !d) return null;
  const ids = x.genre_ids || [], orig = x.original_title || x.original_name || "";
  return {
    id: kind[0] + x.id, tmdb: x.id, kind, k: ids.includes(16) && x.original_language === "ja" ? "a" : kind[0],
    t: esc(t), alt: orig && orig !== t ? esc(orig) : "", d, r: Math.round((x.vote_average || 0) * 10) / 10,
    g: [...new Set(ids.flatMap(i => G[i] || []))], l: esc(L(x.original_language)),
    o: esc((x.overview || "Synopsis not available yet.").slice(0, 420)),
    poster: "https://image.tmdb.org/t/p/w342" + x.poster_path,
    backdrop: path(x.backdrop_path) ? "https://image.tmdb.org/t/p/w1280" + x.backdrop_path : "",
    pp: Math.round(x.popularity || 0), tags: [tag], nets: net ? [net] : [], src: ["TMDB"]
  };
}
async function resolveNetworks() {
  const out = { movie: [], tv: [] };
  for (const t of ["movie", "tv"]) {
    const r = await call("watch/providers/" + t, "watch_region=" + REGION), seen = new Set();
    for (const p of r?.results || []) { const d = displayName(p.provider_name); if (d && !seen.has(d)) { seen.add(d); out[t].push({ id: p.provider_id, name: d }); } }
  }
  return out;
}
export async function collect() {
  if (!process.env.TMDB_TOKEN && !process.env.TMDB_API_KEY) throw new Error("Set the TMDB_TOKEN (or TMDB_API_KEY) secret");
  const G = {};
  for (const t of ["movie", "tv"]) for (const g of (await call("genre/" + t + "/list")).genres) G[g.id] = FIX[g.name] || [g.name];
  const prov = await resolveNetworks(), jobs = [];
  const add = (kind, p, q, tag) => { for (let n = 1; n <= PAGES; n++) jobs.push({ kind, path: p, q: (q ? q + "&" : "") + "page=" + n, tag }); };
  for (const k of ["movie", "tv"]) { add(k, "trending/" + k + "/week", "", "trending"); add(k, k + "/popular", "", "popular"); add(k, k + "/top_rated", "", "toprated"); }
  add("movie", "movie/now_playing", "region=" + REGION, "latest");
  add("movie", "movie/upcoming", "region=" + REGION, "upcoming");
  add("tv", "tv/on_the_air", "", "latest");
  add("movie", "discover/movie", `sort_by=primary_release_date.desc&primary_release_date.lte=${today}&vote_count.gte=10`, "latest");
  add("tv", "discover/tv", `sort_by=first_air_date.desc&first_air_date.lte=${today}&vote_count.gte=5`, "latest");
  for (const k of ["tv", "movie"]) add(k, "discover/" + k, "with_genres=16&with_original_language=ja&sort_by=popularity.desc", "anime");
  for (const k of ["movie", "tv"]) for (const n of prov[k]) for (let p = 1; p <= 2; p++) {
    const f = k === "movie" ? "primary_release_date" : "first_air_date";
    jobs.push({ kind: k, path: "discover/" + k, tag: "latest", net: n.name, q: `watch_region=${REGION}&with_watch_providers=${n.id}&with_watch_monetization_types=flatrate&sort_by=${f}.desc&${f}.lte=${today}&vote_count.gte=5&page=${p}` });
  }
  if (process.env.CLASSICS !== "0") jobs.push({ kind: "movie", path: "discover/movie", q: "primary_release_date.lte=1930-12-31&sort_by=popularity.desc&vote_count.gte=30&page=1", tag: "classic" });
  const items = [];
  await pool(jobs, 6, async j => { const r = await call(j.path, j.q); for (const x of r?.results || []) { const it = norm(x, j.kind, G, j.tag, j.net); if (it) items.push(it); } });
  console.log(`  ${jobs.length} requests, ${items.length} raw titles`);
  return { items, genres: G, networks: [...new Set([...prov.movie, ...prov.tv].map(n => n.name))] };
}
// Trailer, IMDb id, cast and recommendations for the most popular titles.
export async function details(it) {
  const r = await call(it.kind + "/" + it.tmdb, "append_to_response=videos,external_ids,credits,recommendations");
  if (!r) return;
  const v = (r.videos?.results || []).filter(x => x.site === "YouTube" && x.type === "Trailer" && /^[\w-]{6,15}$/.test(x.key));
  it.trailer = (v.find(x => x.official) || v[0])?.key || ""; it.imdb = r.external_ids?.imdb_id || "";
  it.cast = (r.credits?.cast || []).slice(0, 10).map(c => ({ n: esc(c.name), c: esc(c.character || ""), p: path(c.profile_path) }));
  it.rec = (r.recommendations?.results || []).slice(0, 12).map(x => it.kind[0] + x.id);
}
