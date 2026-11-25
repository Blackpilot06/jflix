// Optional: IMDb rating fallback. Set the OMDB_API_KEY secret (free at omdbapi.com) to enable; otherwise it does nothing.
import { getJSON } from "../../lib/http.mjs";
export const name = "OMDb";
export async function enrich(it) {
  const key = process.env.OMDB_API_KEY;
  if (!key || !it.imdb) return;
  const r = await getJSON(`https://www.omdbapi.com/?i=${it.imdb}&apikey=${key}`, { ttl: 48 });
  const v = parseFloat(r?.imdbRating);
  if (v) { if (!it.r) it.r = v; it.src.push("OMDb"); }
}
