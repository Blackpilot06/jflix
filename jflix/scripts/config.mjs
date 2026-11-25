// JFLIX settings. Change these, never the provider code.
export const REGION = process.env.REGION || "KE";       // country used for "where to watch"
export const LANGUAGE = "en-US";
export const PAGES = 3;            // pages (20 titles each) fetched per list
export const DETAIL_LIMIT = 150;   // titles that get trailers, cast, recommendations, episodes, watch links
export const MAX_ITEMS = 1000;

// Display name -> name TMDB uses. A network only appears if TMDB lists it in REGION.
export const NETWORKS = {
  "Netflix": "Netflix", "Prime Video": "Amazon Prime Video", "Disney+": "Disney Plus",
  "Apple TV+": "Apple TV Plus", "Showmax": "Showmax", "Hulu": "Hulu", "Max": "Max", "Paramount+": "Paramount Plus"
};
export const HUES = { "Netflix": 350, "Prime Video": 200, "Disney+": 225, "Apple TV+": 270, "Showmax": 25, "Hulu": 140, "Max": 255, "Paramount+": 210, "Internet Archive": 150 };

// Provider modules, run in this order. The FIRST metadata module is the catalogue source.
// To add a provider: drop a file in scripts/providers/<kind>/ and list its name here.
export const METADATA = ["tmdb", "tvmaze", "omdb"];
export const STREAMING = ["tmdb-watch", "internet-archive"];

export const nn = s => String(s).toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]/g, "");
export const displayName = p => Object.keys(NETWORKS).find(k => nn(NETWORKS[k]) === nn(p));
