import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { labelPayload } from './partCode';

/* Error correction M recovers ~15% of a damaged symbol. On a shelf
   label that survives grease and a scuffed corner, and it keeps the
   module count low enough to stay readable at an inch square. */
const QR_OPTS = { type: 'svg', margin: 0, errorCorrectionLevel: 'M' };

async function renderQr(text) {
  return QRCode.toString(text, QR_OPTS);
}

function QRBlock({ text, size = 150 }) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let alive = true;
    renderQr(text)
      .then((out) => { if (alive) setSvg(out); })
      .catch(() => { if (alive) setSvg(''); });
    return () => { alive = false; };
  }, [text]);

  if (!svg) return <div className="qr-holder" style={{ width: size, height: size }}>generating…</div>;
  return (
    <div className="qr-holder" style={{ width: size, height: size }}
         dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

/* One printable label. Kept as its own component so the single-part
   view and the batch sheet can never drift apart. */
function Label({ part, qr }) {
  return (
    <div className="label-card">
      {qr
        ? <div className="qr-holder" dangerouslySetInnerHTML={{ __html: qr }} />
        : <QRBlock text={labelPayload(part.part_id)} />}
      <div className="label-meta">
        <b>{part.part_name}</b>
        <span className="mono big">{part.part_id}</span>
        {part.shelf_location && <span className="mono">SHELF {part.shelf_location}</span>}
        {(part.manufacturer || part.model) && (
          <span className="dim">{[part.manufacturer, part.model].filter(Boolean).join(' · ')}</span>
        )}
      </div>
    </div>
  );
}

/* ================= single label ================= */

export function LabelSheet({ part, onClose }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head no-print">
          <div>
            <h2>QR label</h2>
            <div className="pid">PART {part.part_id}</div>
          </div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="panel-body">

          <div className="print-area">
            <div className="label-grid one">
              <Label part={part} />
            </div>
          </div>

          <p className="label-note no-print">
            This label encodes <code>{part.part_id}</code> and nothing else. The tablet's
            scanner opens the part; a phone camera shows only the number.
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

/* ================= batch sheet ================= */

export function BatchLabels({ parts, scopeLabel, onClose }) {
  const [codes, setCodes] = useState(null);
  const [done, setDone] = useState(0);
  const [err, setErr] = useState(null);

  const targets = useMemo(
    () => parts.filter((p) => (p.part_id || '').toString().trim()),
    [parts]
  );
  const skipped = parts.length - targets.length;

  useEffect(() => {
    let alive = true;
    setCodes(null); setDone(0); setErr(null);

    (async () => {
      const out = {};
      try {
        // Rendered in chunks so the progress count actually moves and the
        // tablet stays responsive on a full 173-part run.
        const CHUNK = 12;
        for (let i = 0; i < targets.length; i += CHUNK) {
          const slice = targets.slice(i, i + CHUNK);
          const svgs = await Promise.all(slice.map((p) => renderQr(labelPayload(p.part_id))));
          if (!alive) return;
          slice.forEach((p, j) => { out[p.$id || p.part_id] = svgs[j]; });
          setDone(Math.min(i + CHUNK, targets.length));
          await new Promise((r) => setTimeout(r, 0));
        }
        if (alive) setCodes(out);
      } catch (e) {
        if (alive) setErr(e.message || 'Could not generate the codes');
      }
    })();

    return () => { alive = false; };
  }, [targets]);

  const ready = codes !== null;

  return (
    <div className="scrim" onClick={onClose}>
      <div className="panel panel-wide" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head no-print">
          <div>
            <h2>Print labels</h2>
            <div className="pid">{targets.length} LABELS · {scopeLabel}</div>
          </div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="panel-body">
          {err && <div className="err-box no-print">{err}</div>}
          {skipped > 0 && (
            <div className="err-box no-print">
              {skipped} part{skipped === 1 ? '' : 's'} skipped — no part ID to encode.
            </div>
          )}

          {!ready && !err && (
            <div className="state no-print">
              <p>Generating codes… {done} of {targets.length}</p>
            </div>
          )}

          {ready && (
            <>
              <p className="label-note no-print">
                Two labels per row, five rows per page — the Avery 5163 grid (4″ × 2″).
                Check <b>Background graphics</b> in the print dialog, and set margins to
                None so the grid lines up with the sheet.
              </p>
              <div className="print-area">
                <div className="label-grid">
                  {targets.map((p) => (
                    <Label key={p.$id || p.part_id} part={p} qr={codes[p.$id || p.part_id]} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="panel-foot no-print">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => window.print()} disabled={!ready}>
            {ready ? `Print ${targets.length} labels` : 'Generating…'}
          </button>
        </div>
      </div>
    </div>
  );
}
