import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const DIR = new URL("../../.cache/", import.meta.url);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// GET JSON with a disk cache (ttl in hours), retries and a timeout. 404 -> null.
// Secrets are never part of the cache key or the cache file.
export async function getJSON(url, { headers = {}, ttl = 6 } = {}) {
  const key = createHash("sha1").update(url.replace(/(api_key|apikey)=[^&]+/g, "")).digest("hex");
  const file = new URL(key + ".json", DIR);
  try { const c = JSON.parse(await readFile(file, "utf8")); if (Date.now() - c.t < ttl * 36e5) return c.d; } catch {}
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      if (r.status === 404) return null;
      if (r.status === 429) { await sleep(2000 * (i + 1)); continue; }
      if (!r.ok) throw new Error(r.status + " " + url.split("?")[0]);
      const d = await r.json();
      await mkdir(DIR, { recursive: true }); await writeFile(file, JSON.stringify({ t: Date.now(), d }));
      return d;
    } catch (e) { err = e; await sleep(500); }
  }
  throw err;
}
// Run fn over items with limited concurrency; one failure never stops the rest.
export async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const x = items[i++]; try { await fn(x); } catch (e) { console.warn("  skipped:", e.message.replace(/(api_key|apikey)=[^&\s]+/g, "$1=***")); } }
  }));
}
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
