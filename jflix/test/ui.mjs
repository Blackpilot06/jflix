// Loads the built site in a DOM and clicks through it. Uses the catalogue built by test.mjs (or the bundled sample).
import { JSDOM, VirtualConsole } from "jsdom";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { start } from "./mock-tmdb.mjs";
const root = new URL("..", import.meta.url).pathname; let dir = root;
try { dir = (await readFile(root + "test/.built", "utf8")).trim(); } catch {}
const { srv, port } = await start(), errs = [], vc = new VirtualConsole(); vc.on("jsdomError", e => { if (!/Could not load (iframe|img)/.test(e.message)) errs.push(e.message); });
const dom = new JSDOM(await readFile(dir + "/index.html", "utf8"), { url: "file://" + dir + "/index.html", runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) { w.matchMedia = () => ({ matches: false }); w.fetch = fetch; w.scrollTo = () => {}; w.Element.prototype.scrollBy = () => {}; } });
const w = dom.window, d = w.document, wait = ms => new Promise(r => setTimeout(r, ms));
await new Promise(r => w.addEventListener("load", r)); await wait(200);
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("  ✓", m); };
const click = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const heads = [...d.querySelectorAll(".sh h2")].map(h => h.textContent);
for (const t of ["Streaming Networks", "Latest Releases", "Popular Movies", "Popular TV Series", "Trending This Week", "Top Rated", "Recently Added", "Upcoming Movies", "Anime"]) ok(heads.some(h => h.startsWith(t)), "home section: " + t);
ok(d.querySelectorAll(".cd").length > 30, d.querySelectorAll(".cd").length + " poster cards on the homepage");
const imgs = [...d.querySelectorAll(".ps img")]; ok(!dom.window.JFLIX_DATA.sample ? imgs.length > 30 && imgs.every(i => i.src.startsWith("https://image.tmdb.org/t/p/")) : true, "posters load from the TMDB image service");
ok(d.querySelectorAll(".sl").length === 7 && !dom.window.JFLIX_DATA.sample ? d.querySelector(".sl").getAttribute("style").includes("image.tmdb.org/t/p/w1280") : true, "hero uses TMDB backdrops");
click(d.querySelector(".nt")); ok(d.querySelector(".nb") && d.querySelectorAll("#root .cd").length > 0, "network page lists titles");
click(d.querySelector('[data-v="toprated"]')); ok(d.querySelectorAll("#root .cd").length > 0, "Top Rated page");
click(d.querySelector('[data-v="home"]')); click(d.querySelector("#root .cd"));
ok(!d.getElementById("md").hidden && d.querySelector("#bx .src"), "details modal opens with viewing options");
if (!w.JFLIX_DATA.sample) ok(d.querySelectorAll("#bx .cast .cs").length > 0, "cast shown from catalogue data");
click(d.querySelector('[data-m="x"]'));
w.JFLIX_CONFIG.PROXY_URL = `http://localhost:${port}`;
const si = d.getElementById("si"); si.value = "matrix"; si.dispatchEvent(new w.Event("input")); await wait(900);
const live = [...d.querySelectorAll("#sg .cd .nm b")].map(b => b.textContent); ok(live.some(t => t.includes("Live matrix")), "live search through the proxy returns TMDB titles");
click([...d.querySelectorAll("#sg .cd")].find(c => c.textContent.includes("Live matrix"))); await wait(700);
ok(d.querySelectorAll("#bx .cast .cs").length === 2 && d.querySelectorAll("#bx .rr .cd").length >= 1, "live details: cast and recommendations load");
ok(!d.querySelector("#bx .cast").innerHTML.includes("<i>A"), "cast names escaped");
ok(errs.length === 0, "no script errors" + (errs.length ? ": " + errs[0] : ""));
console.log(`\nPASS: ${n} checks`); w.close(); srv.close(); process.exit(0);
