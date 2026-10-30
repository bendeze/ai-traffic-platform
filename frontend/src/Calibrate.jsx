import React, { useRef, useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

const APPROACHES = ['north', 'south', 'east', 'west'];
const COLORS = {
  north: '#ffffff',
  south: '#aaaaaa',
  east:  '#666666',
  west:  '#444444',
};

export default function Calibrate({ onClose }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 1280, h: 720 });
  const [activeApproach, setActiveApproach] = useState('north');
  const [regions, setRegions] = useState({
    north: [], south: [], east: [], west: []
  });
  const [saved, setSaved] = useState(false);

  // Load calibration frame
  useEffect(() => {
    setImgSrc(`${API_BASE}/video/calibration_frame?t=${Date.now()}`);
  }, []);

  // Load existing config
  useEffect(() => {
    fetch(`${API_BASE}/config`).then(r => r.json()).then(data => {
      if (data.approaches) {
        const r = { north: [], south: [], east: [], west: [] };
        data.approaches.forEach(a => {
          if (r[a.name] !== undefined) r[a.name] = a.polygon;
        });
        setRegions(r);
      }
    });
  }, []);

  useEffect(() => {
    drawAll();
  }, [regions, activeApproach, imgSrc]);

  const drawAll = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const scaleX = cw / nw;
    const scaleY = ch / nh;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);

    APPROACHES.forEach(app => {
      const pts = regions[app];
      if (!pts || pts.length < 2) return;
      const color = COLORS[app];
      const isActive = app === activeApproach;

      ctx.beginPath();
      pts.forEach(([x, y], i) => {
        const sx = x * scaleX;
        const sy = y * scaleY;
        i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      });
      if (pts.length >= 3) ctx.closePath();

      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 2.5 : 1.5;
      ctx.setLineDash(isActive ? [] : [6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Fill with transparency
      if (pts.length >= 3) {
        ctx.fillStyle = isActive
          ? `rgba(255,255,255,0.08)`
          : `rgba(200,200,200,0.03)`;
        ctx.fill();
      }

      // Label
      if (pts.length > 0) {
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length * scaleX;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length * scaleY;
        ctx.font = `bold 11px JetBrains Mono, monospace`;
        ctx.fillStyle = color;
        ctx.fillText(app.toUpperCase(), cx - 18, cy + 4);
      }

      // Draw corner dots
      pts.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x * scaleX, y * scaleY, isActive ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    });
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const rect = canvas.getBoundingClientRect();
    const cw = canvas.width;
    const ch = canvas.height;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    // Canvas display vs actual size ratio
    const displayScaleX = rect.width / cw;
    const displayScaleY = rect.height / ch;

    const canvasX = (e.clientX - rect.left) / displayScaleX;
    const canvasY = (e.clientY - rect.top) / displayScaleY;

    // Convert back to original video coordinates
    const videoX = Math.round(canvasX * (nw / cw));
    const videoY = Math.round(canvasY * (nh / ch));

    setRegions(prev => ({
      ...prev,
      [activeApproach]: [...(prev[activeApproach] || []), [videoX, videoY]]
    }));
    setSaved(false);
  };

  const clearActive = () => {
    setRegions(prev => ({ ...prev, [activeApproach]: [] }));
    setSaved(false);
  };

  const setRect = (corners) => {
    setRegions(prev => ({ ...prev, [activeApproach]: corners }));
    setSaved(false);
  };

  const saveRegions = async () => {
    const approaches = APPROACHES.map(name => ({
      name,
      polygon: regions[name]
    })).filter(a => a.polygon.length >= 2);

    const res = await fetch(`${API_BASE}/config/approaches`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approaches })
    });
    if (res.ok) setSaved(true);
  };

  const refreshFrame = () => {
    setImgSrc(`${API_BASE}/video/calibration_frame?t=${Date.now()}`);
  };

  const allValid = APPROACHES.every(a => regions[a].length >= 3);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      zIndex: 1000, padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', borderBottom: '1px solid #222',
        paddingBottom: '14px', marginBottom: '16px'
      }}>
        <div>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', letterSpacing: '0.12em', color: '#fff' }}>
            REGION CALIBRATION
          </span>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#555', marginTop: '2px' }}>
            Click on the frame to define each approach zone · 3+ points per region
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={refreshFrame} style={btn('#111')}>↻ REFRESH FRAME</button>
          <button onClick={onClose} style={btn('#111')}>✕ CLOSE</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative', border: '1px solid #1a1a1a' }}>
          <img
            ref={imgRef}
            src={imgSrc}
            onLoad={() => {
              setImgNaturalSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
              drawAll();
            }}
            style={{ display: 'none' }}
            alt=""
          />
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            onClick={handleCanvasClick}
            onLoad={drawAll}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              cursor: 'crosshair',
              objectFit: 'contain'
            }}
          />
        </div>

        {/* Right Panel */}
        <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Approach Selector */}
          <div style={{ border: '1px solid #1a1a1a', padding: '14px' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.65rem', color: '#555', letterSpacing: '0.1em', marginBottom: '10px' }}>
              ACTIVE APPROACH
            </div>
            {APPROACHES.map(app => {
              const pts = regions[app];
              const ok = pts.length >= 3;
              return (
                <button
                  key={app}
                  onClick={() => setActiveApproach(app)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    marginBottom: '4px',
                    background: activeApproach === app ? '#ffffff' : 'transparent',
                    color: activeApproach === app ? '#000' : '#aaa',
                    border: `1px solid ${activeApproach === app ? '#fff' : '#222'}`,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{app.toUpperCase()}</span>
                  <span style={{ fontSize: '0.6rem', color: ok ? '#10b981' : '#555' }}>
                    {ok ? `✓ ${pts.length}pts` : `${pts.length}pts`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Controls for active approach */}
          <div style={{ border: '1px solid #1a1a1a', padding: '14px' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.65rem', color: '#555', letterSpacing: '0.1em', marginBottom: '10px' }}>
              {activeApproach.toUpperCase()} CONTROLS
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.65rem', color: '#666', marginBottom: '10px' }}>
              {regions[activeApproach].length} points placed
            </div>
            <button onClick={clearActive} style={{ ...btn('#111'), width: '100%', marginBottom: '6px' }}>
              CLEAR REGION
            </button>

            {/* Quick preset rectangles based on approach */}
            <button
              onClick={() => {
                const presets = {
                  north: [[430,0],[760,0],[760,200],[430,200]],
                  south: [[390,490],[760,490],[760,720],[390,720]],
                  east:  [[860,170],[1280,170],[1280,450],[860,450]],
                  west:  [[0,170],[380,170],[380,450],[0,450]],
                };
                setRect(presets[activeApproach]);
              }}
              style={{ ...btn('#1a1a1a'), width: '100%' }}
            >
              USE PRESET
            </button>
          </div>

          {/* Save */}
          <button
            onClick={saveRegions}
            disabled={!allValid}
            style={{
              padding: '12px',
              backgroundColor: saved ? '#111' : (allValid ? '#ffffff' : '#111'),
              color: saved ? '#10b981' : (allValid ? '#000' : '#444'),
              border: `1px solid ${saved ? '#10b981' : (allValid ? '#fff' : '#222')}`,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              cursor: allValid ? 'pointer' : 'not-allowed',
            }}
          >
            {saved ? '✓ REGIONS SAVED' : 'SAVE REGIONS →'}
          </button>

          <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.62rem', color: '#444', lineHeight: 1.6 }}>
            Click 3–4 points around each road approach zone. The AI will only count vehicles inside these regions.
          </div>
        </div>
      </div>
    </div>
  );
}

function btn(bg) {
  return {
    backgroundColor: bg,
    color: '#ffffff',
    border: '1px solid #333',
    padding: '6px 12px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    cursor: 'pointer',
  };
}

