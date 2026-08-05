import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  listInvoices, uploadInvoice, deleteInvoice, fileUrl,
  isImage, prettySize, ACCEPT, MAX_BYTES, NotProvisioned,
} from './invoices';

/* Purchase invoices for one part: upload, look at, remove.

   Uploads run one file at a time rather than in parallel. A tablet on
   plant wifi handling four 8MB photos at once tends to time out all
   four; sequentially, a failure costs you one file and the rest still
   land. */

export default function InvoicePanel({ partId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [missing, setMissing] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const fileRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listInvoices(partId));
      setMissing(false);
      setErr(null);
    } catch (e) {
      if (e instanceof NotProvisioned) setMissing(true);
      else setErr(e.message || 'Could not load invoices');
    } finally {
      setLoading(false);
    }
  }, [partId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function onPick(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';           // so the same file can be picked twice
    if (!files.length) return;

    setErr(null);
    const failed = [];
    for (const file of files) {
      setBusy(`Uploading ${file.name}…`);
      try {
        await uploadInvoice(partId, file);
      } catch (ex) {
        if (ex instanceof NotProvisioned) { setMissing(true); break; }
        failed.push(ex.message);
      }
    }
    setBusy(null);
    if (failed.length) setErr(failed.join(' '));
    refresh();
  }

  async function remove(rec) {
    setConfirming(null);
    setBusy('Removing…');
    try {
      await deleteInvoice(rec);
      setItems((xs) => xs.filter((x) => x.$id !== rec.$id));
    } catch (e) {
      setErr(e.message || 'Could not remove that file');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="section">
      <h4>PURCHASE INVOICES</h4>

      {missing ? (
        <div className="inv-empty">
          Invoice storage is not set up in Appwrite yet — create the
          <code> invoices </code> bucket and collection. See SETUP.md.
        </div>
      ) : (
        <>
          {loading && <div className="inv-empty">Loading…</div>}

          {!loading && items.length === 0 && !busy && (
            <div className="inv-empty">No invoice on file for this part.</div>
          )}

          {items.length > 0 && (
            <div className="inv-grid">
              {items.map((rec) => {
                const url = fileUrl(rec.file_id);
                return (
                  <div className="inv-card" key={rec.$id}>
                    <a className="inv-thumb" href={url} target="_blank" rel="noreferrer"
                       title={`Open ${rec.file_name}`}>
                      {isImage(rec.mime_type)
                        ? <img src={url} alt={rec.file_name} loading="lazy" />
                        : <span className="inv-pdf">PDF</span>}
                    </a>
                    <div className="inv-meta">
                      <a href={url} target="_blank" rel="noreferrer" className="inv-name">
                        {rec.file_name}
                      </a>
                      <span className="inv-sub">
                        {prettySize(rec.size_bytes)} · {new Date(rec.$createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {confirming === rec.$id ? (
                      <div className="inv-confirm">
                        <button className="inv-del on" onClick={() => remove(rec)}>Delete</button>
                        <button className="inv-del" onClick={() => setConfirming(null)}>Keep</button>
                      </div>
                    ) : (
                      <button className="inv-del" onClick={() => setConfirming(rec.$id)}
                              aria-label={`Remove ${rec.file_name}`}>Remove</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="inv-actions">
            <input ref={fileRef} type="file" accept={ACCEPT} multiple
                   onChange={onPick} style={{ display: 'none' }} />
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
              {busy || 'Attach invoice'}
            </button>
            <span className="inv-hint">PNG, JPG or PDF · up to {prettySize(MAX_BYTES)}</span>
          </div>

          {err && <div className="err-box">{err}</div>}
        </>
      )}
    </div>
  );
}
