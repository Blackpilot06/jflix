// Free, legal, embeddable playback: public-domain feature films on the Internet Archive (titles up to 1930 only).
import { getJSON } from "../../lib/http.mjs";
export const name = "Internet Archive";
export async function enrich(it) {
  if (+it.d.slice(0, 4) > 1930) return;
  const title = it.t.replace(/&[#\w]+;|["()]/g, "");
  const q = encodeURIComponent(`title:("${title}") AND mediatype:movies AND collection:(feature_films OR silent_films)`);
  const r = await getJSON(`https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&rows=1&output=json`, { ttl: 72 });
  const id = r?.response?.docs?.[0]?.identifier;
  if (!id || !/^[\w.-]+$/.test(id)) return;
  it.watch = it.watch || {};
  (it.watch.free ||= []).push({ name: "Internet Archive", embed: "https://archive.org/embed/" + id, ok: true });
  if (!it.nets.includes("Internet Archive")) it.nets.push("Internet Archive");
}
