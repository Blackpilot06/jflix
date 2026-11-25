import { pool } from "./http.mjs";
// Mark free embedded sources that no longer respond, so the site hides them.
export async function check(items) {
  const srcs = items.flatMap(i => i.watch?.free || []);
  await pool(srcs, 6, async s => {
    try { const r = await fetch(s.embed, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) }); s.ok = r.ok; }
    catch { s.ok = false; }
  });
  console.log(`Health check: ${srcs.filter(s => s.ok === false).length} of ${srcs.length} embedded sources unavailable`);
}
