// Tiny fake TMDB used by the tests (no network, no real credentials).
import http from "node:http";
export function start() {
  const log = [];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x"), p = u.pathname.replace(/^\/3(?=\/)/, "");
    log.push({ p, auth: req.headers.authorization || "", key: u.searchParams.get("api_key") || "", q: u.search });
    const j = o => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
    const h = [...(p + u.searchParams.get("page"))].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
    const mk = (i, kind) => ({ id: 100 + i, [kind === "tv" ? "name" : "title"]: (kind === "tv" ? "Show " : "Title ") + (100 + i), [kind === "tv" ? "first_air_date" : "release_date"]: i % 9 === 0 ? "2027-02-01" : "2026-1" + (i % 3) + "-0" + (1 + i % 8),
      poster_path: "/p" + i + ".jpg", backdrop_path: "/b" + i + ".jpg", overview: "Overview <b>" + i + "</b>", genre_ids: [28, i % 2 ? 16 : 878], original_language: i % 5 ? "en" : "ja", vote_average: 5 + i % 5, popularity: 200 - i });
    let m;
    if (m = p.match(/^\/genre\/(movie|tv)\/list$/)) return j({ genres: [{ id: 28, name: m[1] === "tv" ? "Action & Adventure" : "Action" }, { id: 16, name: "Animation" }, { id: 878, name: m[1] === "tv" ? "Sci-Fi & Fantasy" : "Science Fiction" }] });
    if (/^\/watch\/providers\/(movie|tv)$/.test(p)) return j({ results: [{ provider_id: 8, provider_name: "Netflix" }, { provider_id: 9, provider_name: "Amazon Prime Video" }, { provider_id: 337, provider_name: "Disney Plus" }, { provider_id: 99, provider_name: "Other" }] });
    if (m = p.match(/^\/(movie|tv)\/(\d+)\/watch\/providers$/)) return j({ results: { KE: { link: `https://www.themoviedb.org/${m[1]}/${m[2]}/watch?locale=KE`, flatrate: [{ provider_name: "Netflix" }] } } });
    if (m = p.match(/^\/(movie|tv)\/(\d+)$/)) { const id = +m[2]; return j({ id, videos: { results: [{ site: "YouTube", type: "Trailer", official: true, key: "abcdefghijk" }] }, external_ids: { imdb_id: "tt" + id },
      credits: { cast: [{ name: "Actor <i>A</i>", character: "Hero", profile_path: "/a.jpg" }, { name: "Actor B", character: "Villain", profile_path: null }] }, recommendations: { results: [mk(id % 40 + 1, m[1]), mk(id % 40 + 2, m[1])] } }); }
    if (/^\/search\/(multi|movie|tv)$/.test(p)) return j({ results: [{ ...mk(77, "movie"), media_type: "movie", title: "Live " + u.searchParams.get("query") }, { id: 5, media_type: "person", name: "X" }] });
    if (/^\/(trending|discover|movie|tv)\//.test(p)) { const kind = /tv/.test(p) ? "tv" : "movie"; return j({ page: 1, results: Array.from({ length: 12 }, (_, i) => mk((Math.abs(h) + i * 3) % 40, kind)) }); }
    res.statusCode = 404; j({ status_message: "not found" });
  });
  return new Promise(r => srv.listen(0, () => r({ srv, log, port: srv.address().port })));
}
