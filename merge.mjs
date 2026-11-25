// Combine results from all providers into one catalogue and drop duplicates (same title + year).
const key = i => i.t.toLowerCase().replace(/&[#\w]+;|[^a-z0-9]/g, "") + i.d.slice(0, 4);
export function merge(list) {
  const m = new Map(); let dup = 0;
  for (const i of list) {
    const k = key(i), c = m.get(k);
    if (!c) { m.set(k, { ...i, tags: [...i.tags], nets: [...i.nets], src: [...i.src] }); continue; }
    dup++;
    c.tags = [...new Set([...c.tags, ...i.tags])]; c.nets = [...new Set([...c.nets, ...i.nets])]; c.src = [...new Set([...c.src, ...i.src])];
    c.pp = Math.max(c.pp, i.pp);
    if (!c.backdrop && i.backdrop) c.backdrop = i.backdrop;
  }
  return { items: [...m.values()], dup };
}
