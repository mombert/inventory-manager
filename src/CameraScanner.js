import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const REGION_ID = 'camera-scan-region';

/* Restricting the decoder to QR is not only a policy choice — with one
   format to try per frame it locks on faster, and a barcode drifting
   through the frame can no longer produce a code the app will only
   reject a moment later. */
const QR_ONLY = [Html5QrcodeSupportedFormats.QR_CODE];

/**
 * Full-screen camera scanner for the QR labels printed by this app.
 * Calls onDetect(code) once, then closes.
 */
export default function CameraScanner({ onDetect, onClose }) {
  const scannerRef = useRef(null);
  const firedRef = useRef(false);
  const [error, setError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [activeCam, setActiveCam] = useState(null);

  useEffect(() => {
    let scanner;
    let cancelled = false;

    async function start(camId) {
      try {
        scanner = new Html5Qrcode(REGION_ID, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          camId ? { deviceId: { exact: camId } } : { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1.4,
            formatsToSupport: QR_ONLY,
          },
          (decoded) => {
            if (firedRef.current) return;
            firedRef.current = true;
            // brief haptic if the device supports it
            try { navigator.vibrate?.(60); } catch (e) {}
            onDetect(decoded);
          },
          () => { /* per-frame miss — ignore */ }
        );
      } catch (e) {
        if (!cancelled) {
          setError(
            e?.message?.includes('Permission') || e?.name === 'NotAllowedError'
              ? 'Camera permission denied. Allow camera access for this site, then try again.'
              : `Could not start the camera: ${e.message || e}`
          );
        }
      }
    }

    (async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (cancelled) return;
        setCameras(devices || []);
        // prefer a rear/back camera when we can identify one
        const rear = (devices || []).find((d) => /back|rear|environment/i.test(d.label));
        const chosen = rear?.id || devices?.[0]?.id || null;
        setActiveCam(chosen);
        start(chosen);
      } catch (e) {
        if (!cancelled) start(null);
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function switchCamera() {
    if (cameras.length < 2) return;
    const idx = cameras.findIndex((c) => c.id === activeCam);
    const next = cameras[(idx + 1) % cameras.length];
    const s = scannerRef.current;
    if (s) {
      try { await s.stop(); await s.clear(); } catch (e) {}
    }
    setActiveCam(next.id);
    firedRef.current = false;
    const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { deviceId: { exact: next.id } },
        { fps: 12, qrbox: { width: 240, height: 240 }, aspectRatio: 1.4, formatsToSupport: QR_ONLY },
        (decoded) => {
          if (firedRef.current) return;
          firedRef.current = true;
          try { navigator.vibrate?.(60); } catch (e) {}
          onDetect(decoded);
        },
        () => {}
      );
    } catch (e) {
      setError(`Could not switch camera: ${e.message || e}`);
    }
  }

  return (
    <div className="cam-scrim" onClick={onClose}>
      <div className="cam-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cam-head">
          <div>
            <h2>Scan a label</h2>
            <div className="cam-sub">QR labels printed from this app</div>
          </div>
          <button className="x" onClick={onClose} aria-label="Close scanner">×</button>
        </div>

        <div className="cam-stage">
          <div id={REGION_ID} className="cam-region" />
          {!error && <div className="cam-hint">Hold the QR label inside the frame</div>}
          {error && <div className="err-box cam-err">{error}</div>}
        </div>

        <div className="cam-foot">
          {cameras.length > 1 && (
            <button className="btn" onClick={switchCamera}>Switch camera</button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
