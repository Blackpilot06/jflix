// Fetches metadata, merges providers, checks sources, writes data/catalogue.json + data/catalogue.js
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { REGION, MAX_ITEMS, DETAIL_LIMIT, METADATA, STREAMING, HUES } from "./config.mjs";
import { pool } from "./lib/http.mjs";
import { merge } from "./lib/merge.mjs";
import { check } from "./lib/health.mjs";

const load = (dir, n) => import(`./providers/${dir}/${n}.mjs`);
const today = new Date().toISOString().slice(0, 10), prev = new Map();
try { for (const i of JSON.parse(await readFile("data/catalogue.json", "utf8")).items) prev.set(i.id, i.add); } catch {}

const [core, ...extra] = await Promise.all(METADATA.map(n => load("metadata", n)));
const streams = await Promise.all(STREAMING.map(n => load("streaming", n)));

console.log("Collecting from", core.name);
const got = await core.collect();
const { items, dup } = merge(got.items);
if (items.length < 20) throw new Error(`Only ${items.length} titles collected; keeping the previous catalogue`);
items.sort((a, b) => b.pp - a.pp);

const top = items.slice(0, DETAIL_LIMIT);
await pool(top, 8, core.details);
const run = async (m, list) => { console.log("Running", m.name); await pool(list, 6, m.enrich); };
for (const m of extra) await run(m, top);
const cand = [...new Set([...top, ...items.filter(i => i.tags.includes("classic"))])];
for (const m of streams) await run(m, cand);
await check(cand);

for (const i of items) {
  i.add = prev.get(i.id) || today;
  const w = i.watch || {}, fl = [...new Set([...(w.flatrate || []), ...i.nets.filter(n => n !== "Internet Archive")])];
  i.watch = { link: w.link || (fl.length ? `https://www.themoviedb.org/${i.kind}/${i.tmdb}/watch?locale=${REGION}` : ""), flatrate: fl, free: (w.free || []).filter(s => s.ok !== false) };
  delete i.kind; delete i.tmdb; delete i.imdb;
}
const used = new Set(items.flatMap(i => i.nets));
const networks = [...got.networks, "Internet Archive"].filter(n => used.has(n)).map(name => ({ name, hue: HUES[name] ?? 200, embed: name === "Internet Archive" }));
const out = { generated: new Date().toISOString(), region: REGION, dup, networks, genres: got.genres, items: items.slice(0, MAX_ITEMS) };
await mkdir("data", { recursive: true });
await writeFile("data/catalogue.json", JSON.stringify(out));
await writeFile("data/catalogue.js", "window.JFLIX_DATA=" + JSON.stringify(out) + ";");
console.log(`Wrote ${out.items.length} titles, ${networks.length} networks, ${dup} duplicates merged.`);
