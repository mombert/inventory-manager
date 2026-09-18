import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db, client, DB_ID, PARTS, TXNS, configured, ID, Query } from './appwrite';
import CameraScanner from './CameraScanner';
import InvoicePanel from './InvoicePanel';
import { LabelSheet, BatchLabels } from './Labels';
import { resolveCode } from './partCode';

/* ============================================================
   Status rules
   Low-stock threshold is the part's own `min_stock` when set,
   otherwise a global fallback of 5 (1–5 on hand = low, 0 = out,
   6+ = healthy). Change GLOBAL_LOW to move the fallback.
   ============================================================ */
const GLOBAL_LOW = 5;
const effLow = (p) => (p.min_stock != null ? p.min_stock : GLOBAL_LOW);
const statusOf = (p) =>
  (p.quantity || 0) <= 0 ? 'out' : (p.quantity <= effLow(p) ? 'low' : 'ok');
const mfrOf = (p) => (p.manufacturer || '').trim() || 'Unspecified';
const ROOM = 'B30 — Critical Equipment Room';

/* Shelf order: "rack.shelf" compared as two numbers, blanks last. */
function shelfKey(p) {
  const s = (p.shelf_location || '').trim();
  if (!s) return [Infinity, Infinity];
  const seg = s.split('.');
  const a = parseInt(seg[0], 10), b = parseInt(seg[1], 10);
  return [isNaN(a) ? Infinity : a, isNaN(b) ? 0 : b];
}
function byShelf(a, b) {
  const ka = shelfKey(a), kb = shelfKey(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  if (ka[1] !== kb[1]) return ka[1] - kb[1];
  return (a.part_name || '').localeCompare(b.part_name || '');
}

const MODES = {
  take:    { label: 'Take out',  verb: 'Taking out',  dir: -1, action: 'issue'   },
  restock: { label: 'Restock',   verb: 'Restocking',  dir: +1, action: 'receive' },
};

/* ---- small inline icons ---- */
const Icon = {
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>,
  warn:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17v.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>,
  x:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>,
  grid:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  rows:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
  scan:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M20 20v.01"/></svg>,
  sun:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>,
  moon:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>,
};
const statusIcon = { ok: <span className="s-ok">{Icon.check}</span>, low: <span className="s-low">{Icon.warn}</span>, out: <span className="s-out">{Icon.x}</span> };
const statusLabel = { ok: 'Healthy', low: 'Low', out: 'Out' };

export default function App() {
  const [parts, setParts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);

  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('sp-theme') || 'dark'; } catch (e) { return 'dark'; } });
  const [view, setView]   = useState('cards');
  const [tab, setTab]     = useState('all');
  const [query, setQuery] = useState('');
  const [shelf, setShelf] = useState('all');
  const [mfr, setMfr]     = useState('all');

  const [selected, setSelected]   = useState(null);   // detail
  const [camOpen, setCamOpen]     = useState(false);
  const [labelPart, setLabelPart] = useState(null);   // single QR label

  // session (take / restock)
  const [mode, setMode]         = useState(null);
  const [cart, setCart]         = useState({});        // part_id -> qty (existing parts)
  const [newParts, setNewParts] = useState([]);        // typed-in new parts (restock)
  const [bucketOpen, setBucketOpen] = useState(false);
  const [newPartOpen, setNewPartOpen] = useState(false);
  const [batchLabels, setBatchLabels] = useState(null); // list to print after a receive

  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  const flash = useCallback((text) => {
    setToast(text); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  /* theme */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('sp-theme', theme); } catch (e) {}
  }, [theme]);

  /* load + realtime */
  useEffect(() => {
    if (!configured) { setErr('App is not configured — check the Appwrite environment variables.'); setLoading(false); return; }
    let unsub;
    (async () => {
      try {
        const res = await db.listDocuments(DB_ID, PARTS, [Query.limit(1000)]);
        setParts(res.documents);
      } catch (e) { setErr(e.message || 'Could not load parts'); }
      finally { setLoading(false); }
    })();
    try {
      unsub = client.subscribe(`databases.${DB_ID}.collections.${PARTS}.documents`, (ev) => {
        const d = ev.payload;
        setParts((prev) => {
          if (ev.events.some((e) => e.endsWith('.delete'))) return prev.filter((x) => x.$id !== d.$id);
          const i = prev.findIndex((x) => x.$id === d.$id);
          if (i === -1) return [...prev, d];
          const c = prev.slice(); c[i] = d; return c;
        });
      });
    } catch (e) {}
    return () => { try { unsub && unsub(); } catch (e) {} };
  }, []);

  /* single-part quick adjust (detail +/-) — logged without a name */
  const adjust = useCallback(async (part, delta) => {
    const next = Math.max(0, (part.quantity || 0) + delta);
    if (next === part.quantity) return;
    setParts((p) => p.map((x) => (x.$id === part.$id ? { ...x, quantity: next } : x)));
    setSelected((s) => (s && s.$id === part.$id ? { ...s, quantity: next } : s));
    try {
      await db.updateDocument(DB_ID, PARTS, part.$id, { quantity: next });
      await db.createDocument(DB_ID, TXNS, ID.unique(), {
        part_id: part.part_id, action: delta < 0 ? 'issue' : 'receive',
        qty_change: delta, qty_after: next, note: 'Quick adjust',
      });
    } catch (e) { setErr(e.message); }
  }, []);

  /* ---------- derived ---------- */
  const manufacturers = useMemo(() => {
    const map = new Map();
    parts.forEach((p) => { const m = mfrOf(p); map.set(m, (map.get(m) || 0) + 1); });
    return [...map.entries()].sort((x, y) => (x[0] === 'Unspecified' ? 1 : y[0] === 'Unspecified' ? -1 : y[1] - x[1] || x[0].localeCompare(y[0])));
  }, [parts]);

  const shelves = useMemo(() =>
    [...new Set(parts.map((p) => (p.shelf_location || '').trim()).filter(Boolean))]
      .sort((a, b) => (parseFloat(a) - parseFloat(b)) || a.localeCompare(b)), [parts]);

  const stats = useMemo(() => {
    let low = 0, out = 0, ok = 0;
    parts.forEach((p) => { const s = statusOf(p); if (s === 'low') low++; else if (s === 'out') out++; else ok++; });
    const units = parts.reduce((s, p) => s + (p.quantity || 0), 0);
    return { total: parts.length, low, out, ok, units, shelves: shelves.length };
  }, [parts, shelves]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts.filter((p) => {
      const st = statusOf(p);
      if (tab !== 'all' && st !== tab) return false;
      if (shelf !== 'all' && (p.shelf_location || '').trim() !== shelf) return false;
      if (mfr !== 'all' && mfrOf(p) !== mfr) return false;
      if (q) {
        const hay = [p.part_id, p.part_name, p.manufacturer, p.model, p.ek_stock_number, p.shelf_location, p.comments].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort(byShelf);
  }, [parts, query, tab, shelf, mfr]);

  const scopeTitle = mfr !== 'all' ? mfr : shelf !== 'all' ? `Shelf ${shelf}` :
    tab === 'low' ? 'Low stock' : tab === 'out' ? 'Out of stock' : tab === 'ok' ? 'Healthy' : 'All parts';

  /* ---------- session ---------- */
  const cartUnits = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
  const newUnits  = useMemo(() => newParts.reduce((a, p) => a + p.quantity, 0), [newParts]);
  const sessionUnits = cartUnits + (mode === 'restock' ? newUnits : 0);

  function startMode(m) {
    if (mode === m) { setBucketOpen(true); return; }
    if (mode && (cartUnits > 0 || newParts.length)) { flash(`Finish or clear your ${MODES[mode].label} list first.`); return; }
    setMode(m); setCart({}); setNewParts([]);
  }
  function cancelMode() { setMode(null); setCart({}); setNewParts([]); setBucketOpen(false); }

  function addToCart(id) {
    const p = parts.find((x) => x.part_id === id);
    if (!p) { flash(`No part with ID ${id}`); return; }
    setCart((c) => {
      const cur = c[id] || 0;
      if (mode === 'take') {
        if (p.quantity <= 0) { flash(`${p.part_name} is out of stock.`); return c; }
        if (cur >= p.quantity) { flash(`Only ${p.quantity} on hand for ${p.part_name}.`); return c; }
      }
      flash(`${MODES[mode] ? MODES[mode].verb : 'Added'} ${p.part_name}`);
      return { ...c, [id]: cur + 1 };
    });
  }
  function setCartQty(id, q) {
    const p = parts.find((x) => x.part_id === id);
    const max = mode === 'take' && p ? p.quantity : 9999;
    q = Math.max(0, Math.min(q, max));
    setCart((c) => { const n = { ...c }; if (q === 0) delete n[id]; else n[id] = q; return n; });
  }

  function quickAction(part, m) {
    if (mode && mode !== m && (cartUnits > 0 || newParts.length)) { flash(`Finish your ${MODES[mode].label} list first.`); return; }
    if (mode !== m) { setMode(m); setCart({}); setNewParts([]); }
    setTimeout(() => addToCart(part.part_id), 0);
    setSelected(null);
  }

  function nextId() {
    let mx = 0;
    parts.concat(newParts).forEach((p) => { const k = parseInt(p.part_id, 10); if (!isNaN(k) && k > mx) mx = k; });
    return String(mx + 1);
  }

  /* commit a session */
  async function checkout(name) {
    if (!name) { flash('A name is required.'); return; }
    const M = MODES[mode];
    const ids = Object.keys(cart);
    if (!ids.length && !(mode === 'restock' && newParts.length)) return;

    setBucketOpen(false);
    const created = [];
    try {
      for (const id of ids) {
        const p = parts.find((x) => x.part_id === id); if (!p) continue;
        const q = cart[id];
        const next = Math.max(0, p.quantity + M.dir * q);
        await db.updateDocument(DB_ID, PARTS, p.$id, { quantity: next });
        await db.createDocument(DB_ID, TXNS, ID.unique(), {
          part_id: p.part_id, action: M.action, qty_change: M.dir * q, qty_after: next, note: name,
        });
      }
      if (mode === 'restock') {
        for (const np of newParts) {
          const row = {
            part_id: np.part_id, part_name: np.part_name, manufacturer: np.manufacturer || null,
            model: np.model || null, ek_stock_number: np.ek_stock_number || null,
            equipment_id: np.equipment_id || null, location: np.location || ROOM,
            shelf_location: np.shelf_location || null, quantity: np.quantity,
            min_stock: np.min_stock != null ? np.min_stock : null, comments: np.comments || null,
          };
          const doc = await db.createDocument(DB_ID, PARTS, ID.unique(), row);
          await db.createDocument(DB_ID, TXNS, ID.unique(), {
            part_id: row.part_id, action: 'create', qty_change: row.quantity, qty_after: row.quantity, note: `New — received by ${name}`,
          });
          created.push(doc);
        }
      }
    } catch (e) { setErr(e.message); }

    const units = sessionUnits;
    const nParts = ids.length + created.length;
    setCart({}); setNewParts([]); setMode(null);
    const verb = M.dir < 0 ? 'took' : 'received';
    flash(`${name} ${verb} ${units} unit${units === 1 ? '' : 's'} across ${nParts} part${nParts === 1 ? '' : 's'}.`);
    if (created.length) setBatchLabels(created);
  }

  /* ---------- scan ---------- */
  function handleScan(code) {
    setCamOpen(false);
    const { part } = resolveCode(parts, code);
    if (!part) {
      flash(mode === 'restock' ? 'Unknown label — use “+ New part” to create it.' : `No part matches ${code}.`);
      return;
    }
    if (mode) addToCart(part.part_id);
    else setSelected(part);
  }

  /* ---------- render ---------- */
  const showAdd = Boolean(mode);
  const addLabel = mode ? MODES[mode].label : '';

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="brand">
          <h1><span className="dot" />Spare Parts</h1>
          <div className="sub">{ROOM} · <b>{stats.total}</b> parts · <b>{stats.shelves}</b> shelves · <b>{stats.units.toLocaleString()}</b> units</div>
        </div>
        <button className="theme-toggle" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} title="Toggle light / dark">
          {theme === 'dark' ? Icon.sun : Icon.moon}<span>{theme === 'dark' ? 'Light' : 'Night'}</span>
        </button>
      </header>

      <div className="toolbar">
        <button className={`btn act-btn act-take${mode === 'take' ? ' on' : ''}`} onClick={() => startMode('take')}>Take out</button>
        <button className={`btn act-btn act-restock${mode === 'restock' ? ' on' : ''}`} onClick={() => startMode('restock')}>Restock</button>
        <button className="btn" onClick={() => setCamOpen(true)}>{Icon.scan}Scan a label</button>
      </div>

      {mode && (
        <div className={`mode-bar m-${mode}`}>
          <span className="mb-dot" />
          <span className="mb-text"><b>{MODES[mode].verb}</b> — tap “Add” on parts{mode === 'restock' ? ', or add a new one' : ''}, then review.</span>
          <span style={{ flex: 1 }} />
          {mode === 'restock' && <button className="btn btn-sm" onClick={() => setNewPartOpen(true)}>+ New part</button>}
          <button className="btn btn-sm" onClick={() => setBucketOpen(true)}>Review ({sessionUnits})</button>
          <button className="btn btn-sm" onClick={cancelMode}>Cancel</button>
        </div>
      )}

      <div className="tabs">
        <button className={`tab t-all${tab === 'all' ? ' on' : ''}`} onClick={() => setTab('all')}>{Icon.grid}<span>All parts</span><span className="cnt">{stats.total}</span></button>
        <button className={`tab t-low${tab === 'low' ? ' on' : ''}`} onClick={() => setTab('low')}>{Icon.warn}<span>Low stock</span><span className="cnt">{stats.low}</span></button>
        <button className={`tab t-out${tab === 'out' ? ' on' : ''}`} onClick={() => setTab('out')}>{Icon.x}<span>Out of stock</span><span className="cnt">{stats.out}</span></button>
        <button className={`tab t-ok${tab === 'ok' ? ' on' : ''}`} onClick={() => setTab('ok')}>{Icon.check}<span>Healthy</span><span className="cnt">{stats.ok}</span></button>
      </div>

      <div className="filters">
        <div className="field grow">
          <label>Search</label>
          <input className="input" placeholder="Name, part ID, manufacturer, model, shelf…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="field">
          <label>Shelf</label>
          <select className="select" value={shelf} onChange={(e) => setShelf(e.target.value)}>
            <option value="all">All shelves ({shelves.length})</option>
            {shelves.map((s) => <option key={s} value={s}>Shelf {s}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Manufacturer</label>
          <select className="select" value={mfr} onChange={(e) => setMfr(e.target.value)}>
            <option value="all">All manufacturers ({manufacturers.length})</option>
            {manufacturers.map(([m, c]) => <option key={m} value={m}>{m} — {c}</option>)}
          </select>
        </div>
        <div className="viewtoggle">
          <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>{Icon.grid}Cards</button>
          <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>{Icon.rows}Table</button>
        </div>
      </div>

      <div className="result-head">
        <h2>{scopeTitle}</h2>
        <span className="shown">{visible.length} of {stats.total} shown</span>
      </div>

      {loading && <div className="state">Loading…</div>}
      {err && <div className="err-box">{err}</div>}

      {!loading && view === 'cards' && visible.length > 0 && (
        <div className="cards">
          {visible.map((p) => <PartCard key={p.$id} p={p} showAdd={showAdd} mode={mode} addLabel={addLabel} onOpen={() => setSelected(p)} onAdd={() => addToCart(p.part_id)} />)}
        </div>
      )}

      {!loading && view === 'table' && visible.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Part</th><th>Shelf</th><th>Manufacturer</th><th>Model</th><th>EK stock</th><th className="num">On hand</th><th>Status</th><th /></tr></thead>
            <tbody>
              {visible.map((p) => <PartRow key={p.$id} p={p} showAdd={showAdd} mode={mode} addLabel={addLabel} onOpen={() => setSelected(p)} onAdd={() => addToCart(p.part_id)} />)}
            </tbody>
          </table>
        </div>
      )}

      {!loading && visible.length === 0 && <div className="empty">No parts match your filters.</div>}

      {selected && (
        <Detail part={selected} mode={mode} onClose={() => setSelected(null)} onAdjust={adjust} onQuick={quickAction} onLabel={() => setLabelPart(selected)} />
      )}

      {bucketOpen && mode && (
        <Bucket
          mode={mode} cart={cart} newParts={newParts} parts={parts} units={sessionUnits}
          onClose={() => setBucketOpen(false)} onQty={setCartQty}
          onRemoveNew={(i) => setNewParts((xs) => xs.filter((_, k) => k !== i))}
          onClear={() => { setCart({}); setNewParts([]); }} onCheckout={checkout}
        />
      )}

      {newPartOpen && (
        <NewPartModal
          suggestedId={nextId()} onClose={() => setNewPartOpen(false)}
          onSave={(np) => { setNewParts((xs) => [...xs, np]); setNewPartOpen(false); flash(`Added new part ${np.part_name} to receiving.`); }}
          exists={(id) => parts.concat(newParts).some((p) => p.part_id === id)}
        />
      )}

      {camOpen && <CameraScanner onDetect={handleScan} onClose={() => setCamOpen(false)} />}
      {labelPart && <LabelSheet part={labelPart} onClose={() => setLabelPart(null)} />}
      {batchLabels && <BatchLabels parts={batchLabels} scopeLabel="new parts" onClose={() => setBatchLabels(null)} />}

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}

/* ============================================================
   Card / Row
   ============================================================ */
function Badges({ p }) {
  return (
    <div className="badges">
      <span className="badge">{p.part_id}</span>
      {p.ek_stock_number && <span className="badge ek">EK {p.ek_stock_number}</span>}
      {p.shelf_location && <span className="badge shelf">Shelf {p.shelf_location}</span>}
    </div>
  );
}
function PartCard({ p, showAdd, mode, addLabel, onOpen, onAdd }) {
  const st = statusOf(p);
  return (
    <div className="card" onClick={onOpen}>
      <div className="onhand">
        <div className="qty">{p.quantity || 0}</div>
        <div className="min">min {p.min_stock != null ? p.min_stock : '—'}</div>
        <div className="oh-label">ON HAND</div>
      </div>
      <div className="body">
        <p className="pname">{p.part_name}</p>
        <Badges p={p} />
        {p.manufacturer && <div className="maker">{p.manufacturer}</div>}
        {p.model && <div className="model">{p.model}</div>}
        {showAdd && (
          <div className="card-actions">
            <button className={`add-btn m-${mode}`} disabled={mode === 'take' && (p.quantity || 0) <= 0}
              onClick={(e) => { e.stopPropagation(); onAdd(); }}>+ {addLabel}</button>
          </div>
        )}
      </div>
      <div className="status">{statusIcon[st]}</div>
    </div>
  );
}
function PartRow({ p, showAdd, mode, addLabel, onOpen, onAdd }) {
  const st = statusOf(p);
  return (
    <tr onClick={onOpen}>
      <td><div className="t-name">{p.part_name}</div><div className="t-id">{p.part_id}</div></td>
      <td>{p.shelf_location ? <span className="t-shelf">{p.shelf_location}</span> : '—'}</td>
      <td>{p.manufacturer || '—'}</td>
      <td className="t-mono">{p.model || '—'}</td>
      <td className="t-mono">{p.ek_stock_number || '—'}</td>
      <td className="t-onhand"><div className="t-qty">{p.quantity || 0}</div><div className="t-min">min {p.min_stock != null ? p.min_stock : '—'}</div></td>
      <td><span className={`pill ${st}`}>{statusLabel[st]}</span></td>
      <td className="t-add">{showAdd && <button className={`add-btn m-${mode}`} disabled={mode === 'take' && (p.quantity || 0) <= 0} onClick={(e) => { e.stopPropagation(); onAdd(); }}>+ {addLabel}</button>}</td>
    </tr>
  );
}

/* ============================================================
   Detail slide-over
   ============================================================ */
function Detail({ part, mode, onClose, onAdjust, onQuick, onLabel }) {
  const [hist, setHist] = useState(null);
  useEffect(() => {
    let ok = true;
    db.listDocuments(DB_ID, TXNS, [Query.equal('part_id', String(part.part_id)), Query.orderDesc('$createdAt'), Query.limit(6)])
      .then((r) => { if (ok) setHist(r.documents); }).catch(() => { if (ok) setHist([]); });
    return () => { ok = false; };
  }, [part.part_id, part.quantity]);

  return (
    <div className="dp-scrim show" onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}>
      <aside className="dp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="dp-head">
          <div>
            <h2 className="dp-title">{part.part_name}</h2>
            <span className="dp-badge">PART {part.part_id}</span>
          </div>
          <button className="dp-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="dp-body">
          <div className="dp-sec">On hand</div>
          <div className="onhand-box">
            <button className="oh-btn" onClick={() => onAdjust(part, -1)} disabled={(part.quantity || 0) <= 0} aria-label="Decrease">−</button>
            <div className="oh-num">{part.quantity || 0}</div>
            <button className="oh-btn" onClick={() => onAdjust(part, +1)} aria-label="Increase">+</button>
          </div>
          <div className="dp-actions">
            <button className="btn act-btn act-take" onClick={() => onQuick(part, 'take')}>Take</button>
            <button className="btn act-btn act-restock" onClick={() => onQuick(part, 'restock')}>Restock</button>
          </div>

          <div className="dp-sec">Details</div>
          <div className="drow"><span className="k">Manufacturer</span><span className="v">{part.manufacturer || '—'}</span></div>
          <div className="drow"><span className="k">Model</span><span className="v mono">{part.model || '—'}</span></div>
          <div className="drow"><span className="k">EK stock no.</span><span className="v mono">{part.ek_stock_number || '—'}</span></div>
          <div className="drow"><span className="k">Location</span><span className="v">{part.location || ROOM}</span></div>

          <div className="dp-sec">Shelf &amp; reorder</div>
          <div className="dgrid2">
            <div className="field"><label>Shelf</label><input className="input" defaultValue={part.shelf_location || ''} readOnly /></div>
            <div className="field"><label>Low-stock at</label><input className="input" placeholder="not set" defaultValue={part.min_stock != null ? part.min_stock : ''} readOnly /></div>
          </div>

          <InvoicePanel partId={part.part_id} />

          <div className="dp-sec">Linked equipment</div>
          <input className="input mono" defaultValue={part.equipment_id || ''} placeholder="EQ-1000001" readOnly />

          {hist && hist.length > 0 && (
            <>
              <div className="dp-sec">Recent activity</div>
              <div className="hist">
                {hist.map((h) => (
                  <div className="hist-row" key={h.$id}>
                    <span className={`c ${h.qty_change > 0 ? 'up' : 'dn'}`}>{h.qty_change > 0 ? '+' : ''}{h.qty_change}</span>
                    <span className="after">→ {h.qty_after}</span>
                    <span className="who">{h.note || h.action}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="dp-foot">
          <button className="btn" onClick={onLabel}>QR label</button>
          <button className="btn btn-accent" style={{ flex: 2 }} onClick={onClose}>Done</button>
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
   Bucket / review
   ============================================================ */
function Bucket({ mode, cart, newParts, parts, units, onClose, onQty, onRemoveNew, onClear, onCheckout }) {
  const [name, setName] = useState('');
  const M = MODES[mode];
  const ids = Object.keys(cart);
  const empty = !ids.length && !(mode === 'restock' && newParts.length);

  return (
    <div className="dp-scrim show" onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}>
      <aside className="dp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="dp-head">
          <div><h2 className="dp-title">{M.verb}</h2><span className={`dp-badge m-${mode}`}>{units} unit{units === 1 ? '' : 's'}</span></div>
          <button className="dp-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="dp-body">
          {empty && <div className="cart-empty">Nothing added yet.<br />{mode === 'restock' ? 'Add known parts, or use “+ New part”.' : 'Tap “Add” on parts to take them out.'}</div>}

          {ids.map((id) => {
            const p = parts.find((x) => x.part_id === id); if (!p) return null;
            const q = cart[id]; const after = Math.max(0, p.quantity + M.dir * q);
            return (
              <div className="cart-line" key={id}>
                <div className="ci-body">
                  <div className="ci-name">{p.part_name}</div>
                  <div className="ci-sub">{p.part_id}{p.shelf_location ? ` · Shelf ${p.shelf_location}` : ''} · {p.quantity} → {after}</div>
                </div>
                <div className="ci-step">
                  <button onClick={() => onQty(id, q - 1)}>−</button>
                  <span className="n">{q}</span>
                  <button onClick={() => onQty(id, q + 1)}>+</button>
                </div>
                <button className="ci-rm" onClick={() => onQty(id, 0)} aria-label="Remove">×</button>
              </div>
            );
          })}

          {mode === 'restock' && newParts.map((np, i) => (
            <div className="cart-line ci-new" key={`np-${i}`}>
              <div className="ci-body">
                <div className="ci-name">{np.part_name}<span className="ci-tag">NEW</span></div>
                <div className="ci-sub">{np.part_id}{np.shelf_location ? ` · Shelf ${np.shelf_location}` : ''} · label will print</div>
              </div>
              <div className="ci-step"><span className="n">+{np.quantity}</span></div>
              <button className="ci-rm" onClick={() => onRemoveNew(i)} aria-label="Remove">×</button>
            </div>
          ))}

          {!empty && (
            <>
              <div className="dp-sec">Who is {M.verb.toLowerCase()}? (required)</div>
              <input className="input" placeholder="Type your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </>
          )}
        </div>
        <div className="dp-foot" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
          <div className="cart-total"><span>Total units</span><b>{units}</b></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" disabled={empty} onClick={onClear}>Clear</button>
            <button className="btn btn-accent" style={{ flex: 2 }} disabled={empty || !name.trim()} onClick={() => onCheckout(name.trim())}>{M.label}</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
   New part (full record)
   ============================================================ */
function NewPartModal({ suggestedId, onClose, onSave, exists }) {
  const [f, setF] = useState({
    part_id: suggestedId, quantity: '1', part_name: '', manufacturer: '', model: '',
    shelf_location: '', min_stock: '', location: ROOM, ek_stock_number: '', equipment_id: '', comments: '',
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  function save() {
    const id = f.part_id.trim(), name = f.part_name.trim();
    const qty = parseInt(f.quantity, 10);
    if (!id) return alert('Part ID is required.');
    if (exists(id)) return alert(`Part ID ${id} already exists.`);
    if (!name) return alert('Part name is required.');
    if (isNaN(qty) || qty < 0) return alert('Quantity must be 0 or more.');
    const min = f.min_stock.trim() !== '' && !isNaN(parseInt(f.min_stock, 10)) ? parseInt(f.min_stock, 10) : null;
    onSave({
      part_id: id, part_name: name, manufacturer: f.manufacturer.trim(), model: f.model.trim(),
      ek_stock_number: f.ek_stock_number.trim(), equipment_id: f.equipment_id.trim(),
      location: f.location.trim() || ROOM, shelf_location: f.shelf_location.trim(),
      quantity: qty, min_stock: min, comments: f.comments.trim(),
    });
  }

  return (
    <div className="dp-scrim show" id="npScrim" onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}>
      <div className="np-modal" onClick={(e) => e.stopPropagation()}>
        <div className="np-head">
          <div><h3>Add a part</h3><span className="dp-badge" style={{ marginTop: 6, display: 'inline-block' }}>NEW RECORD</span></div>
          <button className="dp-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="np-body">
          <div className="dgrid2">
            <div className="field"><label>Part ID</label><input className="input mono" value={f.part_id} onChange={set('part_id')} /></div>
            <div className="field"><label>Quantity</label><input className="input" type="number" inputMode="numeric" min="0" value={f.quantity} onChange={set('quantity')} /></div>
          </div>
          <div className="field"><label>Part name (required)</label><input className="input" value={f.part_name} onChange={set('part_name')} placeholder='3" Butterfly valve seat' /></div>
          <div className="dgrid2">
            <div className="field"><label>Manufacturer</label><input className="input" value={f.manufacturer} onChange={set('manufacturer')} placeholder="Alfa Laval" /></div>
            <div className="field"><label>Model</label><input className="input" value={f.model} onChange={set('model')} /></div>
          </div>
          <div className="dgrid2">
            <div className="field"><label>Shelf</label><input className="input" value={f.shelf_location} onChange={set('shelf_location')} placeholder="8.1" /></div>
            <div className="field"><label>Low-stock at</label><input className="input" value={f.min_stock} onChange={set('min_stock')} placeholder="optional" inputMode="numeric" /></div>
          </div>
          <div className="field"><label>Location</label><input className="input" value={f.location} onChange={set('location')} /></div>
          <div className="field"><label>EK stock number</label><input className="input mono" value={f.ek_stock_number} onChange={set('ek_stock_number')} placeholder="optional" /></div>
          <div className="field"><label>Equipment ID</label><input className="input mono" value={f.equipment_id} onChange={set('equipment_id')} placeholder="EQ-1000001" /></div>
          <div className="field"><label>Comments</label><textarea className="input" rows="2" value={f.comments} onChange={set('comments')} /></div>
          <div className="np-note">A QR label is queued and printed with the rest at the end of receiving.</div>
        </div>
        <div className="np-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-accent" style={{ flex: 2 }} onClick={save}>Add to receiving</button>
        </div>
      </div>
    </div>
  );
}
