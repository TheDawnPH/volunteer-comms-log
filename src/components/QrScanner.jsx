import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

/**
 * Inline phone-camera QR reader. Renders a live camera preview and
 * calls onScan(decodedText) the moment a code is recognized.
 *
 * Camera access needs HTTPS (or localhost) and a device with a
 * camera — neither is guaranteed, so callers should always offer a
 * manual-entry fallback alongside this component rather than relying
 * on it exclusively.
 */
export default function QrScanner({ onScan, onError, active = true }) {
  const containerRef = useRef(null)
  const scannerRef = useRef(null)
  const elementId = useRef(`qr-scanner-${Math.random().toString(36).slice(2)}`)
  const [status, setStatus] = useState('starting') // starting | running | error | unsupported

  // Keep the latest callbacks in refs so the (single, mount-time)
  // camera start below always invokes the CURRENT onScan/onError —
  // otherwise it would close over stale state from whichever render
  // was active when the camera first started.
  const onScanRef = useRef(onScan)
  const onErrorRef = useRef(onError)
  useEffect(() => { onScanRef.current = onScan }, [onScan])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  // Debounce so holding the same code in frame doesn't fire onScan
  // dozens of times per second (html5-qrcode calls back every frame
  // it recognizes a code, not just once).
  const lastScanRef = useRef({ text: null, time: 0 })

  useEffect(() => {
    if (!active) return
    let cancelled = false

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      return
    }

    const instance = new Html5Qrcode(elementId.current, { verbose: false })
    scannerRef.current = instance

    instance.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (decodedText) => {
        if (cancelled) return
        const now = Date.now()
        const last = lastScanRef.current
        if (last.text === decodedText && now - last.time < 3000) return
        lastScanRef.current = { text: decodedText, time: now }
        onScanRef.current?.(decodedText)
      },
      () => { /* per-frame "no QR found" noise — ignore */ }
    ).then(() => {
      if (!cancelled) setStatus('running')
    }).catch((err) => {
      if (cancelled) return
      setStatus('error')
      onErrorRef.current?.(err?.message || 'Could not start the camera.')
    })

    return () => {
      cancelled = true
      const inst = scannerRef.current
      scannerRef.current = null
      if (inst) {
        inst.stop().then(() => inst.clear()).catch(() => {})
      }
    }
  }, [active])

  if (!active) return null

  return (
    <div>
      <div
        id={elementId.current}
        ref={containerRef}
        style={{
          width: '100%', maxWidth: 320, margin: '0 auto', borderRadius: 12, overflow: 'hidden',
          background: '#000', aspectRatio: '1 / 1'
        }}
      />
      {status === 'starting' && <p className="hint-text" style={{ textAlign: 'center', marginTop: 8 }}>Starting camera…</p>}
      {status === 'unsupported' && <p className="error-text" style={{ marginTop: 8 }}>This device/browser doesn't support camera scanning. Use manual entry below instead.</p>}
      {status === 'error' && <p className="error-text" style={{ marginTop: 8 }}>Camera unavailable (permission denied or no camera found). Use manual entry below instead.</p>}
    </div>
  )
}
