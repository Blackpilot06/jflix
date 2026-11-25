// Builder + proxy tests against the mock TMDB. Run: npm test
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { start } from "./mock-tmdb.mjs";
const ex = promisify(execFile), root = new URL("..", import.meta.url).pathname;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("  ✓", m); };
const { srv, log, port } = await start(), base = `http://localhost:${port}/3`;

async function build(env) {
  const dir = await mkdtemp(join(tmpdir(), "jflix-"));
  await cp(root, dir, { recursive: true, filter: s => !/node_modules|[/\\]\.cache/.test(s) });
  log.length = 0;
  await ex("node", ["scripts/build-catalogue.mjs"], { cwd: dir, env: { ...process.env, TMDB_TOKEN: "", TMDB_API_KEY: "", TMDB_BASE: base, REGION: "KE", ...env }, timeout: 280000 });
  return dir;
}
console.log("Builder, v4 Bearer token");
const dir = await build({ TMDB_TOKEN: "test-token-v4" });
const cat = JSON.parse(await readFile(dir + "/data/catalogue.json", "utf8")), paths = new Set(log.map(l => l.p));
ok(log.length > 40 && log.every(l => l.auth === "Bearer test-token-v4" && !l.key), "every request used the Bearer header and no key in the URL");
for (const p of ["/trending/movie/week", "/trending/tv/week", "/movie/popular", "/tv/popular", "/movie/top_rated", "/tv/top_rated", "/movie/upcoming", "/movie/now_playing", "/tv/on_the_air", "/discover/movie", "/discover/tv", "/genre/movie/list", "/genre/tv/list", "/watch/providers/movie"]) ok(paths.has(p), "endpoint called: " + p);
ok([...paths].some(p => /^\/(movie|tv)\/\d+$/.test(p)), "endpoint called: details (+credits, recommendations, videos)");
ok([...paths].some(p => /^\/(movie|tv)\/\d+\/watch\/providers$/.test(p)), "endpoint called: title watch providers");
ok(cat.items.length >= 20 && cat.items.every(i => i.poster.startsWith("https://image.tmdb.org/t/p/w342/")), `${cat.items.length} titles, all with TMDB posters`);
ok(["Netflix", "Prime Video", "Disney+"].every(x => cat.networks.some(n => n.name === x)), "networks resolved by name (Netflix, Prime Video, Disney+)");
ok(cat.items.some(i => i.g.includes("Sci-Fi")) && cat.genres[878].includes("Sci-Fi"), "genres normalised");
ok(cat.items.some(i => i.tags.includes("toprated")) && cat.items.some(i => i.tags.includes("trending")), "top-rated and trending tags present");
ok(cat.items.some(i => i.cast?.length && i.rec?.length && i.trailer), "cast, recommendations and trailer stored");
ok(cat.dup > 0, `${cat.dup} duplicates merged`);
ok(cat.items.every(i => !/<[a-z]/i.test(i.o + i.t)), "text from the API is HTML-escaped");
const files = (await Promise.all(["data/catalogue.json", "data/catalogue.js", "index.html", "config.js"].map(f => readFile(dir + "/" + f, "utf8")))).join("");
ok(!files.includes("test-token-v4"), "token appears in no published file");
await writeFile(root + "test/.built", dir);

console.log("Builder, v3 API key only");
const dir2 = await build({ TMDB_API_KEY: "v3key-abc123" });
ok(log.length > 40 && log.every(l => !l.auth && l.key === "v3key-abc123"), "v3 key used as api_key when no token is set");
ok(!(await readFile(dir2 + "/data/catalogue.json", "utf8")).includes("v3key-abc123"), "key appears in no published file");

console.log("Proxy (Cloudflare Worker)");
const worker = (await import("../worker/tmdb-proxy.js")).default, real = globalThis.fetch;
globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
globalThis.fetch = (u, i) => real(String(u).replace("https://api.themoviedb.org/3", base), i);
const O = "https://user.github.io", ctx = { waitUntil() {} };
const get = (p, o = O, env = { TMDB_TOKEN: "w-token", ALLOWED_ORIGINS: O }, m = "GET") => worker.fetch(new Request("https://proxy.example.workers.dev" + p, { method: m, headers: o ? { Origin: o } : {} }), env, ctx);
for (const p of ["/trending/movie/week", "/trending/tv/week", "/movie/popular?page=2", "/movie/top_rated", "/movie/upcoming", "/movie/now_playing", "/tv/popular", "/tv/top_rated", "/tv/on_the_air", "/discover/movie?with_genres=28", "/genre/movie/list", "/genre/tv/list", "/search/multi?query=matrix", "/search/movie?query=a", "/movie/603?append_to_response=credits,recommendations,videos", "/tv/1399/credits", "/movie/603/recommendations", "/movie/603/watch/providers", "/watch/providers/movie?watch_region=KE"]) {
  log.length = 0; const r = await get(p), body = await r.json();
  ok(r.status === 200 && r.headers.get("Access-Control-Allow-Origin") === O && body && log.at(-1).auth === "Bearer w-token", "proxy 200 + Bearer upstream: " + p.split("?")[0]);
}
log.length = 0; await get("/movie/popular?api_key=evil"); ok(log.at(-1).key === "" && !log.at(-1).q.includes("evil"), "api_key sent by a browser is stripped");
log.length = 0; await get("/movie/popular", O, { TMDB_API_KEY: "k3", ALLOWED_ORIGINS: O }); ok(log.at(-1).key === "k3" && !log.at(-1).auth, "proxy falls back to the v3 key");
ok((await get("/account")).status === 404 && (await get("/movie/603/images")).status === 404, "non-allow-listed endpoints blocked");
ok((await get("/movie/popular", "https://evil.example")).status === 403 && (await get("/movie/popular", "")).status === 403, "other origins blocked");
ok((await get("/movie/popular", O, undefined, "POST")).status === 405, "only GET allowed");
ok((await get("/movie/popular", O, { ALLOWED_ORIGINS: O })).status === 500, "reports missing credentials");
globalThis.fetch = real; srv.close();
console.log(`\nPASS: ${n} checks`);
