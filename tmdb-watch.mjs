// Which licensed services carry a title in REGION (TMDB watch providers, data by JustWatch). Link-out only.
import { call } from "../metadata/tmdb.mjs";
import { REGION, displayName } from "../../config.mjs";
export const name = "TMDB watch providers";
export async function enrich(it) {
  const c = (await call(`${it.kind}/${it.tmdb}/watch/providers`))?.results?.[REGION];
  if (!c) return;
  const names = (c.flatrate || []).map(p => displayName(p.provider_name)).filter(Boolean);
  it.watch = { ...(it.watch || {}), link: c.link || "", flatrate: [...new Set([...(it.watch?.flatrate || []), ...names])] };
  for (const n of names) if (!it.nets.includes(n)) it.nets.push(n);
}
