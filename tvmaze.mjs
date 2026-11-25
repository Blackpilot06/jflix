// Latest episodes for series. No key needed. https://www.tvmaze.com/api
import { getJSON, esc } from "../../lib/http.mjs";
export const name = "TVmaze";
export async function enrich(it) {
  if (it.kind !== "tv" || !it.imdb) return;
  const s = await getJSON("https://api.tvmaze.com/lookup/shows?imdb_id=" + it.imdb, { ttl: 24 });
  if (!s) return;
  const e = await getJSON(`https://api.tvmaze.com/shows/${s.id}/episodes`, { ttl: 12 }), today = new Date().toISOString().slice(0, 10);
  it.ep = (e || []).filter(x => x.airdate && x.airdate <= today && x.number).sort((a, b) => b.airdate.localeCompare(a.airdate)).slice(0, 5).map(x => esc(`S${x.season}·E${x.number} ${x.name}`));
  if (it.ep.length) it.src.push("TVmaze");
}
