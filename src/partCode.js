/* ============================================================
   The label URL scheme, the scan resolver, and a small router.

   Every printed label encodes an absolute URL:

       https://<host>/p/<part_id>

   That one decision buys three things:
     - a phone camera shows a tappable link instead of a bare number
     - the tablet's own scanner still resolves it, offline of any
       routing, by pulling the id back out of the path
     - the URL is shareable — paste it in a work order and it opens
       straight to the part
   ============================================================ */

/* ---------- where labels point ----------

   Labels are generated in the browser, so window.location.origin is
   almost always right. The override exists for the case that bites:
   printing a batch from localhost during setup would otherwise bake
   http://localhost:3000 into 173 labels.                            */

const CONFIGURED_BASE = (process.env.REACT_APP_PUBLIC_URL || '').trim();

export function publicBase() {
  const base = CONFIGURED_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  return base.replace(/\/+$/, '');
}

export function partUrl(partId) {
  return `${publicBase()}/p/${encodeURIComponent(String(partId).trim())}`;
}

/* True when labels would be printed pointing at a machine only this
   computer can reach. The label screen warns rather than silently
   producing 173 dead codes. */
export function baseIsLocal() {
  const base = publicBase();
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(base) || base === '';
}

/* ---------- reading codes ---------- */

/* Pulls the part id out of anything shaped like one of our labels:
   a full URL, a bare path, or a path with a query string. Returns
   null for codes that aren't ours, which is how the caller knows a
   vendor barcode is safe to link to a part. */
export function partIdFromUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/(?:^|\/)p\/([^/?#\s]+)/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).trim() || null;
  } catch {
    return m[1].trim() || null;
  }
}

export function isOurLabel(raw) {
  return partIdFromUrl(raw) !== null;
}

/* Resolves a scanned code against the loaded parts.

   Order matters. A label URL is unambiguous, so it wins outright and
   never falls through to a fuzzier match. After that we try the
   vendor barcode, then the part id, then the EK stock number — each
   an exact match, so a code can only ever land on one part.

   Returns { part, via } so the caller can say how it matched.        */
export function resolveCode(parts, raw, kind) {
  const code = String(raw || '').trim();
  if (!code) return { part: null, via: null };

  const eq = (v) => (v || '').toString().trim();

  if (kind === 'nfc') {
    return { part: parts.find((p) => eq(p.nfc_tag_id) === code) || null, via: 'nfc' };
  }

  const labelId = partIdFromUrl(code);
  if (labelId) {
    // Case-insensitive, because some scanners upper-case their output.
    const hit = parts.find((p) => eq(p.part_id).toLowerCase() === labelId.toLowerCase());
    return { part: hit || null, via: 'label' };
  }

  let hit = parts.find((p) => eq(p.barcode) === code);
  if (hit) return { part: hit, via: 'barcode' };

  hit = parts.find((p) => eq(p.part_id) === code);
  if (hit) return { part: hit, via: 'part_id' };

  hit = parts.find((p) => eq(p.ek_stock_number) === code);
  if (hit) return { part: hit, via: 'ek' };

  return { part: null, via: null };
}

/* ---------- routing ----------

   Two routes, so a router library would be more machinery than the
   problem needs:  /  and  /p/:part_id                                */

export function readPath() {
  if (typeof window === 'undefined') return { name: 'list', partId: null };
  const id = partIdFromUrl(window.location.pathname);
  return id ? { name: 'part', partId: id } : { name: 'list', partId: null };
}

export function pushPath(path, { replace = false } = {}) {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === path) return;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
