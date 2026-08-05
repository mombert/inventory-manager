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

/* ---------- what labels encode ----------

   Labels encode the bare part ID and nothing else. A phone camera
   scanning one sees the characters "3312" with no link to follow and
   no way to reach the database — which is the point. The tablet's own
   scanner resolves it, because resolveCode matches part_id directly.

   A side benefit: the payload no longer depends on the deployed host,
   so labels are identical whoever prints them and cannot go stale if
   the address ever changes.                                          */

export function labelPayload(partId) {
  return String(partId).trim();
}

/* ---------- reading codes ---------- */

/* Labels no longer encode URLs, but any printed under the previous
   scheme are still on the shelves. This keeps reading them, so old and
   new labels both resolve and nothing has to be reprinted. */
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
