import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, client, DB_ID, PARTS, TXNS, configured, ID, Query } from './appwrite';
import CameraScanner from './CameraScanner';
import { LabelSheet, BatchLabels } from './Labels';
import { resolveCode, isOurLabel } from './partCode';
import InvoicePanel from './InvoicePanel';

const NFC_AVAILABLE = typeof window !== 'undefined' && 'NDEFReader' in window;

// Parts with no manufacturer recorded collect under one heading rather than
// vanishing from the grouped view — the gap is itself worth being able to see.
const UNSPECIFIED = 'Unspecified';
const mfrOf = (p) => (p.manufacturer || '').trim() || UNSPECIFIED;

export default function App() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [flash, setFlash] = useState(null);
  const [pending, setPending] = useState(null);
  const [hitId, setHitId] = useState(null);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [mfr, setMfr] = useState('all');
  const [groupMfr, setGroupMfr] = useState(false);
  const [area, setArea] = useState('all');
  const [shelf, setShelf] = useState('all');

  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [nfcOn, setNfcOn] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [labelFor, setLabelFor] = useState(null);
  const [batchOpen, setBatchOpen] = useState(false);


  /* ---------------- data ---------------- */

  // Appwrite caps a page at 100 documents, so we page through.
  const loadParts = useCallback(async () => {
    try {
      const all = [];
      let cursor = null;
      for (let guard = 0; guard < 40; guard++) {
        const queries = [Query.limit(100), Query.orderAsc('part_name')];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const res = await db.listDocuments(DB_ID, PARTS, queries);
        all.push(...res.documents);
        if (res.documents.length < 100) break;
        cursor = res.documents[res.documents.length - 1].$id;
      }
      setParts(all);
      setLoadError(null);
    } catch (e) {
      setLoadError(e.message || 'Could not reach the database');
    }
  }, []);

  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    (async () => { await loadParts(); setLoading(false); })();

    let unsub = () => {};
    try {
      unsub = client.subscribe(
        `databases.${DB_ID}.collections.${PARTS}.documents`,
        () => loadParts()
      );
    } catch (e) { /* realtime optional */ }
    return () => { try { unsub(); } catch (e) {} };
  }, [loadParts]);

  /* ---------------- quantity ---------------- */

  async function adjust(part, delta) {
    const next = Math.max(0, part.quantity + delta);
    if (next === part.quantity) return;

    setParts((p) => p.map((x) => (x.$id === part.$id ? { ...x, quantity: next } : x)));
    setSelected((s) => (s && s.$id === part.$id ? { ...s, quantity: next } : s));

    try {
      await db.updateDocument(DB_ID, PARTS, part.$id, { quantity: next });
      await db.createDocument(DB_ID, TXNS, ID.unique(), {
        part_id: part.part_id,
        action: delta < 0 ? 'issue' : 'receive',
        qty_change: delta,
        qty_after: next,
      });
    } catch (e) {
      setFlash({ tone: 'err', text: `Could not save: ${e.message}` });
      loadParts();
    }
  }

  /* ---------------- scanning ---------------- */

  const handleCode = useCallback((raw, kind) => {
    const code = String(raw || '').trim();
    if (!code) return;

    const { part: match, via } = resolveCode(parts, code, kind);

    if (match) {
      setSelected(match);
      setHitId(match.$id);
      setTimeout(() => setHitId(null), 1200);
      const how = via === 'label' ? 'QR label'
        : via === 'part_id' ? 'part ID'
        : via === 'ek' ? 'EK number'
        : 'tag';
      setFlash({ tone: 'ok', text: `${match.part_name} — ${match.quantity} on hand (matched by ${how})`, code });
      setPending(null);
      return;
    }

    // The camera resolves our own QR labels and nothing else, so a scan
    // that misses is a dead label rather than something to assign. Two
    // different failures, and the difference is worth telling someone:
    // a numeric code is a label whose part is gone, anything else was
    // never one of ours.
    if (kind !== 'nfc') {
      const ours = isOurLabel(code) || /^[A-Za-z0-9-]{1,16}$/.test(code);
      setFlash({
        tone: 'err',
        text: ours
          ? 'That label points at a part ID that is not in the database'
          : 'Not a parts label — the scanner reads QR labels printed from this app',
        code,
      });
      setPending(null);
      return;
    }

    // NFC tags stay assignable: hold an unknown tag, then tap a part.
    setFlash({ tone: 'miss', text: 'Tag not in the database yet', code });
    setPending({ code, kind });
  }, [parts]);

  async function startNfc() {
    if (!NFC_AVAILABLE) {
      setFlash({ tone: 'err', text: 'NFC needs Chrome on Android. Use the camera scanner instead.' });
      return;
    }
    try {
      const ndef = new window.NDEFReader();
      await ndef.scan();
      setNfcOn(true);
      setFlash({ tone: 'ok', text: 'NFC reader on — hold a tag to the tablet' });
      ndef.onreading = (e) => handleCode(e.serialNumber, 'nfc');
      ndef.onreadingerror = () => setFlash({ tone: 'err', text: 'Could not read that tag. Try again.' });
    } catch (err) {
      setFlash({ tone: 'err', text: `NFC blocked: ${err.message}` });
    }
  }

  function onCameraDetect(code) {
    setCamOpen(false);
    handleCode(code, 'scan');
  }

  async function linkPending(part) {
    if (!pending) return;
    try {
      await db.updateDocument(DB_ID, PARTS, part.$id, { nfc_tag_id: pending.code });
      setFlash({ tone: 'ok', text: `Linked tag to ${part.part_name}`, code: pending.code });
      setPending(null);
      loadParts();
    } catch (e) {
      setFlash({ tone: 'err', text: `Could not link: ${e.message}` });
    }
  }

  /* ---------------- derived ---------------- */

  const stats = useMemo(() => {
    const low = parts.filter((p) => p.min_stock != null && p.quantity <= p.min_stock && p.quantity > 0).length;
    const out = parts.filter((p) => p.quantity === 0).length;
    const units = parts.reduce((s, p) => s + (p.quantity || 0), 0);
    const shelves = new Set(parts.map((p) => (p.shelf_location || '').trim()).filter(Boolean)).size;
    return { total: parts.length, low, out, units, shelves, healthy: parts.length - low - out };
  }, [parts]);

  // Areas come from the data, so a new location becomes a filter with no code change.
  const areas = useMemo(() => {
    const map = new Map();
    parts.forEach((p) => {
      const a = (p.location || '').trim();
      if (a) map.set(a, (map.get(a) || 0) + 1);
    });
    return [...map.entries()].sort((x, y) => x[0].localeCompare(y[0]));
  }, [parts]);

  // Shelves are scoped to the chosen area and sorted like you'd walk the racks
  // (1.1, 2.1, 11.2 — not alphabetically, where 11.2 lands before 2.1).
  const shelves = useMemo(() => {
    const map = new Map();
    parts.forEach((p) => {
      if (area !== 'all' && (p.location || '').trim() !== area) return;
      const s = (p.shelf_location || '').trim();
      if (s) map.set(s, (map.get(s) || 0) + 1);
    });
    const num = (s) => s.split('.').map((n) => parseFloat(n) || 0);
    return [...map.entries()].sort((x, y) => {
      const [a1, a2 = 0] = num(x[0]);
      const [b1, b2 = 0] = num(y[0]);
      return a1 - b1 || a2 - b2 || x[0].localeCompare(y[0]);
    });
  }, [parts, area]);

  // Manufacturers ordered by how many parts each supplies, so the vendors
  // you actually deal with sit at the top of a 170-part dropdown.
  const manufacturers = useMemo(() => {
    const map = new Map();
    parts.forEach((p) => { const m = mfrOf(p); map.set(m, (map.get(m) || 0) + 1); });
    return [...map.entries()].sort((x, y) => {
      if (x[0] === UNSPECIFIED) return 1;
      if (y[0] === UNSPECIFIED) return -1;
      return y[1] - x[1] || x[0].localeCompare(y[0]);
    });
  }, [parts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts.filter((p) => {
      if (filter === 'low' && !(p.min_stock != null && p.quantity <= p.min_stock && p.quantity > 0)) return false;
      if (filter === 'zero' && p.quantity !== 0) return false;
      if (mfr !== 'all' && mfrOf(p) !== mfr) return false;
      if (area !== 'all' && (p.location || '').trim() !== area) return false;
      if (shelf !== 'all' && (p.shelf_location || '').trim() !== shelf) return false;
      if (!q) return true;
      return [p.part_id, p.part_name, p.manufacturer, p.model, p.ek_stock_number,
              p.shelf_location, p.location, p.comments]
        .some((v) => (v || '').toString().toLowerCase().includes(q));
    });
  }, [parts, query, filter, mfr, area, shelf]);

  // Grouping runs on the filtered set, so it reorganises what you are
  // already looking at instead of quietly widening it.
  const grouped = useMemo(() => {
    if (!groupMfr) return null;
    const map = new Map();
    visible.forEach((p) => {
      const m = mfrOf(p);
      if (!map.has(m)) map.set(m, []);
      map.get(m).push(p);
    });
    return [...map.entries()].sort((x, y) => {
      if (x[0] === UNSPECIFIED) return 1;
      if (y[0] === UNSPECIFIED) return -1;
      return x[0].localeCompare(y[0]);
    });
  }, [visible, groupMfr]);

  const narrowed = query !== '' || filter !== 'all' || mfr !== 'all' || area !== 'all' || shelf !== 'all';
  function clearFilters() { setQuery(''); setFilter('all'); setMfr('all'); setArea('all'); setShelf('all'); }

  /* ---------------- render ---------------- */

  if (!configured) {
    return (
      <div className="state">
        <h3>Connect the database</h3>
        <p>Add the Appwrite endpoint, project ID and database ID in Vercel, then redeploy.</p>
      </div>
    );
  }

  return (
    <div className="app">
      {/* ── sidebar ─────────────────────────────────────────── */}
      <aside className="sidenav">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <div className="brand-name">Spare Parts</div>
            <div className="brand-sub">B30 Critical Equipment</div>
          </div>
        </div>

        <div className="nav-label">Inventory</div>
        <nav className="nav">
          <button className={`nav-item${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>
            <span>All parts</span><span className="n">{stats.total}</span>
          </button>
          <button className={`nav-item${filter === 'low' ? ' on' : ''}`} onClick={() => setFilter('low')}>
            <span>Low stock</span><span className="n">{stats.low}</span>
          </button>
          <button className={`nav-item${filter === 'zero' ? ' on' : ''}`} onClick={() => setFilter('zero')}>
            <span>Out of stock</span><span className="n">{stats.out}</span>
          </button>
        </nav>

        <div className="room-card">
          <div className="room-t">Active room</div>
          <div className="room-v">B30 — Critical Equipment Room</div>
          <div className="room-n">{stats.shelves} shelf positions · {stats.units} units</div>
        </div>
      </aside>

      {/* ── main column ─────────────────────────────────────── */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <h2>B30 — Critical Equipment Room</h2>
            <span>{stats.total} parts tracked</span>
          </div>
          <button type="button" onClick={() => setCamOpen(true)} className="btn btn-cam">Scan a label</button>
          <button type="button" onClick={startNfc} className={`btn btn-nfc${nfcOn ? ' live' : ''}`} disabled={nfcOn}>
            {nfcOn ? 'NFC on' : 'NFC'}
          </button>
          <button type="button" onClick={() => setAdding(true)} className="btn btn-primary">Add part</button>
        </header>

        {flash && (
          <div className={`flash ${flash.tone}`}>
            {flash.code && <code>{flash.code}</code>}
            <span>{flash.text}</span>
            <span className="spacer" />
            <button onClick={() => { setFlash(null); setPending(null); }}>Dismiss</button>
          </div>
        )}

        {pending && (
          <div className="flash miss">
            <span>Tap a part below to link tag <code>{pending.code}</code>, or</span>
            <button onClick={() => setAdding(true)}>add it as a new part</button>
            <span className="spacer" />
            <button onClick={() => setPending(null)}>Cancel</button>
          </div>
        )}

        <main className="content">
          <h1 className="page-h1">Parts</h1>
          <p className="page-sub">Everything stocked in B30, by rack and shelf.</p>

          {/* stat cards */}
          <div className="stats">
            <div className="stat">
              <div className="stat-head"><span className="stat-ic blue" />Total parts</div>
              <div className="stat-v">{stats.total}</div>
              <div className="stat-n">Across {stats.shelves} shelf positions</div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-ic amber" />At or below minimum</div>
              <div className={`stat-v${stats.low ? ' amber' : ''}`}>{stats.low}</div>
              <div className="stat-n">Reorder before the next PM window</div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-ic red" />Out of stock</div>
              <div className={`stat-v${stats.out ? ' red' : ''}`}>{stats.out}</div>
              <div className="stat-n">Nothing on the shelf right now</div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-ic green" />Healthy</div>
              <div className="stat-v">{stats.healthy}</div>
              <div className="stat-n">{stats.units} units counted in total</div>
            </div>
          </div>

          {/* filter bar */}
          <div className="filters">
            <div className="fsearch">
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                     placeholder="Search name, ID, manufacturer, model, shelf…" />
            </div>

            {areas.length > 1 && (
              <div className="fgroup">
                <span className="flabel">Area</span>
                <button className={`chip${area === 'all' ? ' on' : ''}`}
                        onClick={() => { setArea('all'); setShelf('all'); }}>
                  All areas
                </button>
                {areas.map(([a, n]) => (
                  <button key={a} className={`chip${area === a ? ' on' : ''}`}
                          onClick={() => { setArea(a); setShelf('all'); }}>
                    {a.replace(/^B30\s*-\s*/, '')} <span className="n">{n}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="fgroup">
              <span className="flabel">Shelf</span>
              <select className="fselect" value={shelf} onChange={(e) => setShelf(e.target.value)}>
                <option value="all">All shelves ({shelves.length})</option>
                {shelves.map(([s, n]) => (
                  <option key={s} value={s}>Shelf {s} — {n} part{n === 1 ? '' : 's'}</option>
                ))}
              </select>
            </div>

            <div className="fgroup">
              <span className="flabel">Manufacturer</span>
              <select className="fselect" value={mfr} onChange={(e) => setMfr(e.target.value)}>
                <option value="all">All manufacturers ({manufacturers.length})</option>
                {manufacturers.map(([m, c]) => (
                  <option key={m} value={m}>{m} — {c} part{c === 1 ? '' : 's'}</option>
                ))}
              </select>
              <button className={`chip${groupMfr ? ' on' : ''}`}
                      onClick={() => setGroupMfr((g) => !g)}
                      title="Break the list into a section per manufacturer">
                Group by maker
              </button>
            </div>

            {narrowed && <button className="fclear" onClick={clearFilters}>Clear filters</button>}
          </div>

          {/* parts table */}
          <div className="card">
            <div className="card-head">
              <span className="card-t">
                {shelf !== 'all' ? `Shelf ${shelf}`
                  : filter === 'low' ? 'Low stock'
                  : filter === 'zero' ? 'Out of stock'
                  : mfr !== 'all' ? mfr
                  : area !== 'all' ? area.replace(/^B30\s*-\s*/, '')
                  : 'All parts'}
              </span>
              <div className="card-actions">
                <span className="card-n">{visible.length} of {stats.total} shown</span>
                <button className="btn btn-sm" onClick={() => setBatchOpen(true)}
                        disabled={visible.length === 0}>
                  Print {visible.length === stats.total ? 'all' : visible.length} label{visible.length === 1 ? '' : 's'}
                </button>
              </div>
            </div>

            {!loading && !loadError && visible.length > 0 && (
              <div className="row-head">
                <div>Part</div>
                <div>Manufacturer</div>
                <div>Shelf</div>
                <div>On hand</div>
                <div>Status</div>
              </div>
            )}

            <div className="list">
              {loadError && <div className="state"><h3>Could not load parts</h3><p>{loadError}</p></div>}
              {loading && !loadError && <div className="state"><p>Loading parts…</p></div>}
              {!loading && !loadError && visible.length === 0 && (
                <div className="state">
                  <h3>Nothing matches</h3>
                  <p>{parts.length === 0
                    ? 'Import your parts CSV in Appwrite to get started.'
                    : 'Clear a filter or search a different part number.'}</p>
                  {narrowed && parts.length > 0 && (
                    <button className="btn" onClick={clearFilters}>Clear filters</button>
                  )}
                </div>
              )}
              {grouped
                ? grouped.map(([name, rows]) => (
                    <div className="mgroup" key={name}>
                      <div className="mgroup-head">
                        <span className={name === UNSPECIFIED ? 'faint' : ''}>{name}</span>
                        <span className="n">{rows.length}</span>
                      </div>
                      {rows.map((p) => (
                        <PartRow key={p.$id} part={p} hit={hitId === p.$id} linking={Boolean(pending)}
                                 onOpen={() => (pending ? linkPending(p) : setSelected(p))} onAdjust={adjust} />
                      ))}
                    </div>
                  ))
                : visible.map((p) => (
                    <PartRow key={p.$id} part={p} hit={hitId === p.$id} linking={Boolean(pending)}
                             onOpen={() => (pending ? linkPending(p) : setSelected(p))} onAdjust={adjust} />
                  ))}
            </div>
          </div>
        </main>
      </div>

      {selected && (
        <Detail part={parts.find((p) => p.$id === selected.$id) || selected}
                onClose={() => setSelected(null)} onAdjust={adjust} onSaved={loadParts}
                onPrintLabel={(p) => { setSelected(null); setLabelFor(p); }} />
      )}

      {camOpen && (
        <CameraScanner onDetect={onCameraDetect} onClose={() => setCamOpen(false)} />
      )}

      {labelFor && (
        <LabelSheet part={labelFor} onClose={() => setLabelFor(null)} />
      )}

      {batchOpen && (
        <BatchLabels
          parts={visible}
          scopeLabel={
            shelf !== 'all' ? `shelf ${shelf}`
              : filter === 'low' ? 'low stock'
              : filter === 'zero' ? 'out of stock'
              : mfr !== 'all' ? mfr
              : area !== 'all' ? area
              : 'all parts'
          }
          onClose={() => setBatchOpen(false)}
        />
      )}

      {adding && (
        <AddPart seedNfc={pending?.kind === 'nfc' ? pending.code : ''}
                 parts={parts} onClose={() => setAdding(false)}
                 onSaved={() => { setAdding(false); setPending(null); loadParts(); }} />
      )}
    </div>
  );
}

/* ================= row ================= */

function PartRow({ part, hit, linking, onOpen, onAdjust }) {
  const out = part.quantity === 0;
  const low = !out && part.min_stock != null && part.quantity <= part.min_stock;
  const tone = out ? 'out' : low ? 'low' : 'ok';
  const label = out ? 'Out of stock' : low ? 'Low stock' : 'In stock';

  // Fill shows how far above the reorder point this part sits. With no
  // minimum set there is nothing to measure against, so the bar is hidden.
  const min = part.min_stock;
  const fill = min ? Math.min(100, (part.quantity / (min * 2)) * 100) : null;

  return (
    <div className={`row${out ? ' zero' : low ? ' flagged' : ''}${hit ? ' hit' : ''}`}>
      <div className="name" onClick={onOpen} role="button" tabIndex={0}
           onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}>
        <b>{part.part_name}</b>
        <div className="meta">
          <span className="pid">{part.part_id}</span>
          {part.ek_stock_number && <span className="ek">EK {part.ek_stock_number}</span>}
        </div>
        <div className="tags">
          {linking && <span className="tag">TAP TO LINK</span>}
          {part.nfc_tag_id && <span className="tag">NFC</span>}
        </div>
      </div>

      <div className="mfr" onClick={onOpen}>
        <span>{part.manufacturer || '—'}</span>
        <span className="model">{part.model || ''}</span>
      </div>

      <div className="shelf-cell">
        <div className={`shelf${part.shelf_location ? '' : ' none'}`}>{part.shelf_location || '—'}</div>
      </div>

      <div className="qty">
        <button onClick={() => onAdjust(part, -1)} disabled={part.quantity === 0} aria-label="Remove one">−</button>
        <div className="qty-read">
          <span className={`n ${tone}`}>{part.quantity}</span>
          <span className="min">min {min ?? '—'}</span>
          {fill !== null && (
            <span className="bar"><i className={tone} style={{ width: `${fill}%` }} /></span>
          )}
        </div>
        <button onClick={() => onAdjust(part, +1)} aria-label="Add one">+</button>
      </div>

      <div className="status-cell">
        <span className={`pill ${tone}`}><i />{label}</span>
      </div>
    </div>
  );
}

/* ================= detail panel ================= */

function Detail({ part, onClose, onAdjust, onSaved, onPrintLabel }) {
  const [minStock, setMinStock] = useState(part.min_stock ?? '');
  const [nfc, setNfc] = useState(part.nfc_tag_id || '');
  const [shelf, setShelf] = useState(part.shelf_location || '');
  const [eq, setEq] = useState(part.equipment_id || '');
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    db.listDocuments(DB_ID, TXNS, [
      Query.equal('part_id', part.part_id),
      Query.orderDesc('$createdAt'),
      Query.limit(12),
    ]).then((r) => setHistory(r.documents)).catch(() => setHistory([]));
  }, [part.part_id, part.quantity]);

  async function save() {
    setSaving(true); setErr(null);
    try {
      await db.updateDocument(DB_ID, PARTS, part.$id, {
        min_stock: minStock === '' ? null : Number(minStock),
        nfc_tag_id: nfc.trim() || null,
        shelf_location: shelf.trim() || null,
        equipment_id: eq.trim() || null,
      });
      onSaved(); onClose();
    } catch (e) {
      setErr(e.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <h2>{part.part_name}</h2>
            <div className="pid">PART {part.part_id}</div>
          </div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="panel-body">
          <div className="section">
            <h4>ON HAND</h4>
            <div className="qty" style={{ justifyContent: 'flex-start' }}>
              <button onClick={() => onAdjust(part, -1)} disabled={part.quantity === 0}>−</button>
              <span className="n">{part.quantity}</span>
              <button onClick={() => onAdjust(part, +1)}>+</button>
            </div>
          </div>

          <div className="section">
            <h4>DETAILS</h4>
            <dl className="kv">
              <dt>Manufacturer</dt><dd>{part.manufacturer || '—'}</dd>
              <dt>Model</dt><dd className="mono">{part.model || '—'}</dd>
              <dt>EK stock no.</dt><dd className="mono">{part.ek_stock_number || '—'}</dd>
              <dt>Location</dt><dd>{part.location || '—'}</dd>
              {part.comments && (<><dt>Comments</dt><dd>{part.comments}</dd></>)}
            </dl>
          </div>

          <div className="section">
            <h4>SHELF &amp; REORDER</h4>
            <div className="grid2">
              <div className="field-row">
                <label htmlFor="shelf">Shelf</label>
                <input id="shelf" className="mono" value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder="6.5" />
              </div>
              <div className="field-row">
                <label htmlFor="min">Low-stock at</label>
                <input id="min" className="mono" type="number" min="0" value={minStock}
                       onChange={(e) => setMinStock(e.target.value)} placeholder="not set" />
              </div>
            </div>
          </div>

          <div className="section">
            <h4>NFC TAG</h4>
            <div className="field-row">
              <input id="nf" className="mono" value={nfc} onChange={(e) => setNfc(e.target.value)}
                     placeholder="Tap a tag from the main screen to assign" />
            </div>
          </div>

          <InvoicePanel partId={part.part_id} />

          <div className="section">
            <h4>LINKED EQUIPMENT</h4>
            <div className="field-row">
              <input className="mono" value={eq} onChange={(e) => setEq(e.target.value)} placeholder="EQ-1000001" />
            </div>
          </div>

          {history.length > 0 && (
            <div className="section">
              <h4>RECENT MOVEMENT</h4>
              <div className="hist">
                {history.map((h) => (
                  <div className="hist-row" key={h.$id}>
                    <span className="d">{new Date(h.$createdAt).toLocaleDateString()}</span>
                    <span className={`c ${h.qty_change > 0 ? 'up' : 'dn'}`}>
                      {h.qty_change > 0 ? '+' : ''}{h.qty_change}
                    </span>
                    <span className="a">{h.action}</span>
                    <span className="after">→ {h.qty_after}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {err && <div className="err-box">{err}</div>}
        </div>

        <div className="panel-foot">
          <button className="btn" onClick={() => onPrintLabel(part)}>QR label</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= add part ================= */

function AddPart({ seedNfc, parts, onClose, onSaved }) {
  const nextId = useMemo(() => {
    const nums = parts.map((p) => parseInt(p.part_id, 10)).filter((n) => !isNaN(n));
    return nums.length ? String(Math.max(...nums) + 1) : '1001';
  }, [parts]);

  const defaultLocation = parts[0]?.location || 'B30 - Critical Equipment Room';

  const [f, setF] = useState({
    part_id: nextId, part_name: '', manufacturer: '', model: '', ek_stock_number: '',
    location: defaultLocation, shelf_location: '', quantity: '1', min_stock: '',
    nfc_tag_id: seedNfc || '', equipment_id: '', comments: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save() {
    if (!f.part_name.trim()) { setErr('Give the part a name.'); return; }
    if (!f.part_id.trim()) { setErr('Give the part an ID.'); return; }
    setSaving(true); setErr(null);

    const row = {
      part_id: f.part_id.trim(),
      part_name: f.part_name.trim(),
      manufacturer: f.manufacturer.trim() || null,
      model: f.model.trim() || null,
      ek_stock_number: f.ek_stock_number.trim() || null,
      location: f.location.trim() || null,
      shelf_location: f.shelf_location.trim() || null,
      quantity: Number(f.quantity) || 0,
      min_stock: f.min_stock === '' ? null : Number(f.min_stock),
      nfc_tag_id: f.nfc_tag_id.trim() || null,
      equipment_id: f.equipment_id.trim() || null,
      comments: f.comments.trim() || null,
    };

    try {
      await db.createDocument(DB_ID, PARTS, ID.unique(), row);
      await db.createDocument(DB_ID, TXNS, ID.unique(), {
        part_id: row.part_id, action: 'create',
        qty_change: row.quantity, qty_after: row.quantity, note: 'Added manually',
      });
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div><h2>Add a part</h2><div className="pid">NEW RECORD</div></div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="panel-body">
          <div className="grid2">
            <div className="field-row">
              <label htmlFor="a-id">Part ID</label>
              <input id="a-id" className="mono" value={f.part_id} onChange={set('part_id')} />
            </div>
            <div className="field-row">
              <label htmlFor="a-qty">Quantity</label>
              <input id="a-qty" className="mono" type="number" min="0" value={f.quantity} onChange={set('quantity')} />
            </div>
          </div>

          <div className="field-row">
            <label htmlFor="a-name">Part name</label>
            <input id="a-name" value={f.part_name} onChange={set('part_name')} placeholder='3" Butterfly valve seat' />
          </div>

          <div className="grid2">
            <div className="field-row">
              <label htmlFor="a-mfr">Manufacturer</label>
              <input id="a-mfr" value={f.manufacturer} onChange={set('manufacturer')} placeholder="Alfa Laval" />
            </div>
            <div className="field-row">
              <label htmlFor="a-model">Model</label>
              <input id="a-model" className="mono" value={f.model} onChange={set('model')} />
            </div>
          </div>

          <div className="grid2">
            <div className="field-row">
              <label htmlFor="a-shelf">Shelf</label>
              <input id="a-shelf" className="mono" value={f.shelf_location} onChange={set('shelf_location')} placeholder="8.1" />
            </div>
            <div className="field-row">
              <label htmlFor="a-min">Low-stock at</label>
              <input id="a-min" className="mono" type="number" min="0" value={f.min_stock} onChange={set('min_stock')} placeholder="optional" />
            </div>
          </div>

          <div className="field-row">
            <label htmlFor="a-loc">Location</label>
            <input id="a-loc" value={f.location} onChange={set('location')} />
          </div>

          <div className="grid2">
            <div className="field-row">
              <label htmlFor="a-nfc">NFC tag ID</label>
              <input id="a-nfc" className="mono" value={f.nfc_tag_id} onChange={set('nfc_tag_id')} placeholder="optional" />
            </div>
            <div className="field-row">
              <label htmlFor="a-ek">EK stock number</label>
              <input id="a-ek" className="mono" value={f.ek_stock_number} onChange={set('ek_stock_number')} placeholder="optional" />
            </div>
          </div>

          <div className="field-row">
            <label htmlFor="a-eq">Equipment ID</label>
            <input id="a-eq" className="mono" value={f.equipment_id} onChange={set('equipment_id')} placeholder="EQ-1000001" />
          </div>

          <div className="field-row">
            <label htmlFor="a-com">Comments</label>
            <input id="a-com" value={f.comments} onChange={set('comments')} placeholder="P-231 UF V1" />
          </div>

          {err && <div className="err-box">{err}</div>}
        </div>

        <div className="panel-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Add part'}
          </button>
        </div>
      </div>
    </div>
  );
}
