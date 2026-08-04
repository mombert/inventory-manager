import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { db, client, DB_ID, PARTS, TXNS, configured, ID, Query } from './appwrite';
import CameraScanner from './CameraScanner';

const NFC_AVAILABLE = typeof window !== 'undefined' && 'NDEFReader' in window;

export default function App() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [scan, setScan] = useState('');
  const [flash, setFlash] = useState(null);
  const [pending, setPending] = useState(null);
  const [hitId, setHitId] = useState(null);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [nfcOn, setNfcOn] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [labelFor, setLabelFor] = useState(null);

  const scanRef = useRef(null);

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

  useEffect(() => { scanRef.current?.focus(); }, []);

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
    const field = kind === 'nfc' ? 'nfc_tag_id' : 'barcode';
    const match = parts.find((p) => (p[field] || '').trim() === code);

    if (match) {
      setSelected(match);
      setHitId(match.$id);
      setTimeout(() => setHitId(null), 1200);
      setFlash({ tone: 'ok', text: `${match.part_name} — ${match.quantity} on hand`, code });
      setPending(null);
    } else {
      setFlash({ tone: 'miss', text: `${kind === 'nfc' ? 'Tag' : 'Barcode'} not in the database yet`, code });
      setPending({ code, kind });
    }
  }, [parts]);

  function onScanSubmit(e) {
    e.preventDefault();
    handleCode(scan, 'barcode');
    setScan('');
    scanRef.current?.focus();
  }

  async function startNfc() {
    if (!NFC_AVAILABLE) {
      setFlash({ tone: 'err', text: 'NFC needs Chrome on Android. Use the barcode field instead.' });
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
    handleCode(code, 'barcode');
  }

  async function linkPending(part) {
    if (!pending) return;
    const field = pending.kind === 'nfc' ? 'nfc_tag_id' : 'barcode';
    try {
      await db.updateDocument(DB_ID, PARTS, part.$id, { [field]: pending.code });
      setFlash({ tone: 'ok', text: `Linked ${pending.code} to ${part.part_name}`, code: pending.code });
      setPending(null);
      loadParts();
    } catch (e) {
      setFlash({ tone: 'err', text: `Could not link: ${e.message}` });
    }
  }

  /* ---------------- derived ---------------- */

  const stats = useMemo(() => {
    const low = parts.filter((p) => p.min_stock != null && p.quantity <= p.min_stock).length;
    const units = parts.reduce((s, p) => s + (p.quantity || 0), 0);
    const nobar = parts.filter((p) => !p.barcode).length;
    return { total: parts.length, low, units, nobar };
  }, [parts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts.filter((p) => {
      if (filter === 'low' && !(p.min_stock != null && p.quantity <= p.min_stock)) return false;
      if (filter === 'zero' && p.quantity !== 0) return false;
      if (filter === 'nobarcode' && p.barcode) return false;
      if (!q) return true;
      return [p.part_id, p.part_name, p.manufacturer, p.model, p.ek_stock_number,
              p.shelf_location, p.barcode, p.location, p.comments]
        .some((v) => (v || '').toString().toLowerCase().includes(q));
    });
  }, [parts, query, filter]);

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
      <header className="masthead">
        <h1>Spare Parts</h1>
        <span className="loc">B30 · CRITICAL EQUIPMENT ROOM</span>
        <div className="counts">
          <span><b>{stats.total}</b> parts</span>
          <span><b>{stats.units}</b> units</span>
          {stats.low > 0 && <span className="warn"><b>{stats.low}</b> low</span>}
        </div>
      </header>

      <form className="scanbar" onSubmit={onScanSubmit}>
        <div className="field">
          <input
            ref={scanRef}
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            placeholder="Scan or type a barcode, then press Enter"
            autoComplete="off"
            aria-label="Barcode"
          />
        </div>
        <button type="submit" className="btn btn-primary">Look up</button>
        <button type="button" onClick={() => setCamOpen(true)} className="btn btn-cam">Scan with camera</button>
        <button type="button" onClick={startNfc} className={`btn btn-nfc${nfcOn ? ' live' : ''}`} disabled={nfcOn}>
          {nfcOn ? 'NFC on' : 'Read NFC tag'}
        </button>
      </form>

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
          <span>Tap a part below to link <code>{pending.code}</code>, or</span>
          <button onClick={() => setAdding(true)}>add it as a new part</button>
          <span className="spacer" />
          <button onClick={() => setPending(null)}>Cancel</button>
        </div>
      )}

      <div className="toolbar">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
               placeholder="Search name, ID, manufacturer, model, shelf…" />
        <button className={`chip${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>
          All <span className="n">{stats.total}</span>
        </button>
        <button className={`chip${filter === 'low' ? ' on' : ''}`} onClick={() => setFilter('low')}>
          Low <span className="n">{stats.low}</span>
        </button>
        <button className={`chip${filter === 'zero' ? ' on' : ''}`} onClick={() => setFilter('zero')}>Out</button>
        <button className={`chip${filter === 'nobarcode' ? ' on' : ''}`} onClick={() => setFilter('nobarcode')}>
          No barcode <span className="n">{stats.nobar}</span>
        </button>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>Add part</button>
      </div>

      <div className="list">
        {loadError && <div className="state"><h3>Could not load parts</h3><p>{loadError}</p></div>}
        {loading && !loadError && <div className="state"><p>Loading parts…</p></div>}
        {!loading && !loadError && visible.length === 0 && (
          <div className="state">
            <h3>Nothing matches</h3>
            <p>{parts.length === 0 ? 'Import your parts CSV in Appwrite to get started.' : 'Try a different search or filter.'}</p>
          </div>
        )}
        {visible.map((p) => (
          <PartRow key={p.$id} part={p} hit={hitId === p.$id} linking={Boolean(pending)}
                   onOpen={() => (pending ? linkPending(p) : setSelected(p))} onAdjust={adjust} />
        ))}
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

      {adding && (
        <AddPart seedBarcode={pending?.kind === 'barcode' ? pending.code : ''}
                 seedNfc={pending?.kind === 'nfc' ? pending.code : ''}
                 parts={parts} onClose={() => setAdding(false)}
                 onSaved={() => { setAdding(false); setPending(null); loadParts(); }} />
      )}
    </div>
  );
}

/* ================= row ================= */

function PartRow({ part, hit, linking, onOpen, onAdjust }) {
  const low = part.min_stock != null && part.quantity <= part.min_stock;
  const out = part.quantity === 0;

  return (
    <div className={`row${out ? ' zero' : low ? ' flagged' : ''}${hit ? ' hit' : ''}`}>
      <div className="pid" onClick={onOpen} style={{ cursor: 'pointer' }}>{part.part_id}</div>
      <div className="name" onClick={onOpen} style={{ cursor: 'pointer' }}>
        <b>{part.part_name}</b>
        <div className="sub">{part.comments || part.location || '—'}</div>
        <div className="tags">
          {linking && <span className="tag">TAP TO LINK</span>}
          {!part.barcode && !linking && <span className="tag warn">NO BARCODE</span>}
          {part.nfc_tag_id && <span className="tag">NFC</span>}
        </div>
      </div>
      <div className="mfr" onClick={onOpen} style={{ cursor: 'pointer' }}>
        <span>{part.manufacturer || '—'}</span>
        <span className="model">{part.model || ''}</span>
      </div>
      <div className="shelf-cell">
        <div className={`shelf${part.shelf_location ? '' : ' none'}`}>{part.shelf_location || '—'}</div>
      </div>
      <div className="qty">
        <button onClick={() => onAdjust(part, -1)} disabled={part.quantity === 0} aria-label="Remove one">−</button>
        <span className={`n${out ? ' out' : low ? ' low' : ''}`}>{part.quantity}</span>
        <button onClick={() => onAdjust(part, +1)} aria-label="Add one">+</button>
      </div>
    </div>
  );
}

/* ================= detail panel ================= */

function Detail({ part, onClose, onAdjust, onSaved, onPrintLabel }) {
  const [minStock, setMinStock] = useState(part.min_stock ?? '');
  const [barcode, setBarcode] = useState(part.barcode || '');
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
        barcode: barcode.trim() || null,
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
            <h4>SCAN CODES</h4>
            <div className="assign">
              <div className="field-row">
                <label htmlFor="bc">Barcode</label>
                <input id="bc" className="mono" value={barcode} onChange={(e) => setBarcode(e.target.value)}
                       placeholder="Scan into this field to assign" />
              </div>
              <div className="field-row">
                <label htmlFor="nf">NFC tag ID</label>
                <input id="nf" className="mono" value={nfc} onChange={(e) => setNfc(e.target.value)}
                       placeholder="Tap a tag from the main screen to assign" />
              </div>
            </div>
          </div>

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

/* ================= QR label ================= */

function LabelSheet({ part, onClose }) {
  // The QR encodes the part_id, so scanning a printed label
  // resolves through the same lookup as a vendor barcode.
  const payload = part.barcode || part.part_id;

  return (
    <div className="scrim" onClick={onClose}>
      <div className="panel label-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head no-print">
          <div>
            <h2>QR label</h2>
            <div className="pid">PART {part.part_id}</div>
          </div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="panel-body">
          <div className="label-card">
            <QRBlock text={payload} />
            <div className="label-meta">
              <b>{part.part_name}</b>
              <span className="mono">{part.part_id}</span>
              {part.shelf_location && <span className="mono">SHELF {part.shelf_location}</span>}
              {part.manufacturer && <span>{part.manufacturer}</span>}
            </div>
          </div>

          <p className="label-note no-print">
            Scanning this label looks up <code>{payload}</code>.
            {!part.barcode && ' This part has no vendor barcode, so the label uses its part ID.'}
          </p>
        </div>

        <div className="panel-foot no-print">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Print</button>
        </div>
      </div>
    </div>
  );
}

/* Renders a QR code as an inline SVG via a tiny encoder. */
function QRBlock({ text }) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let alive = true;
    import('qrcode')
      .then((QR) => QR.toString(text, { type: 'svg', margin: 1, width: 190 }))
      .then((out) => { if (alive) setSvg(out); })
      .catch(() => { if (alive) setSvg(''); });
    return () => { alive = false; };
  }, [text]);

  if (!svg) return <div className="qr-holder">generating…</div>;
  return <div className="qr-holder" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/* ================= add part ================= */

function AddPart({ seedBarcode, seedNfc, parts, onClose, onSaved }) {
  const nextId = useMemo(() => {
    const nums = parts.map((p) => parseInt(p.part_id, 10)).filter((n) => !isNaN(n));
    return nums.length ? String(Math.max(...nums) + 1) : '1001';
  }, [parts]);

  const defaultLocation = parts[0]?.location || 'B30 - Critical Equipment Room';

  const [f, setF] = useState({
    part_id: nextId, part_name: '', manufacturer: '', model: '', ek_stock_number: '',
    location: defaultLocation, shelf_location: '', quantity: '1', min_stock: '',
    barcode: seedBarcode || '', nfc_tag_id: seedNfc || '', equipment_id: '', comments: '',
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
      barcode: f.barcode.trim() || null,
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
              <label htmlFor="a-bc">Barcode</label>
              <input id="a-bc" className="mono" value={f.barcode} onChange={set('barcode')} placeholder="optional" />
            </div>
            <div className="field-row">
              <label htmlFor="a-nfc">NFC tag ID</label>
              <input id="a-nfc" className="mono" value={f.nfc_tag_id} onChange={set('nfc_tag_id')} placeholder="optional" />
            </div>
          </div>

          <div className="grid2">
            <div className="field-row">
              <label htmlFor="a-ek">EK stock number</label>
              <input id="a-ek" className="mono" value={f.ek_stock_number} onChange={set('ek_stock_number')} placeholder="optional" />
            </div>
            <div className="field-row">
              <label htmlFor="a-eq">Equipment ID</label>
              <input id="a-eq" className="mono" value={f.equipment_id} onChange={set('equipment_id')} placeholder="EQ-1000001" />
            </div>
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
