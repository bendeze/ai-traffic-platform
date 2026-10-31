import React, { useRef, useState, useEffect, MouseEvent } from 'react';
import { ApproachName } from './types';

const API_BASE = 'http://localhost:8000';

const APPROACHES: ApproachName[] = ['north', 'south', 'east', 'west'];
const COLORS: Record<ApproachName, string> = {
  north: '#ffffff',
  south: '#aaaaaa',
  east:  '#666666',
  west:  '#444444',
};

interface CalibrateProps {
  onClose: () => void;
}

export default function Calibrate({ onClose }: CalibrateProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [activeApproach, setActiveApproach] = useState<ApproachName>('north');
  const [regions, setRegions] = useState<Record<ApproachName, [number, number][]>>({
    north: [], south: [], east: [], west: []
  });
  const [saved, setSaved] = useState<boolean>(false);

  // Load calibration frame
  useEffect(() => {
    setImgSrc(`${API_BASE}/video/calibration_frame?t=${Date.now()}`);
  }, []);

  // Load existing config
  useEffect(() => {
    fetch(`${API_BASE}/config`).then(r => r.json()).then(data => {
      if (data.approaches) {
        const r: Record<ApproachName, [number, number][]> = { north: [], south: [], east: [], west: [] };
        data.approaches.forEach((a: any) => {
          if (r[a.name as ApproachName] !== undefined) {
            r[a.name as ApproachName] = a.polygon;
          }
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
    if (!ctx) return;
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

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const rect = canvas.getBoundingClientRect();
    const cw = canvas.width;
    const ch = canvas.height;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    const displayScaleX = rect.width / cw;
    const displayScaleY = rect.height / ch;

    const canvasX = (e.clientX - rect.left) / displayScaleX;
    const canvasY = (e.clientY - rect.top) / displayScaleY;

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

  const setRect = (corners: [number, number][]) => {
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
    <div className="fixed inset-0 bg-black/95 flex flex-col z-50 p-5">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-zinc-800 pb-3.5 mb-4">
        <div>
          <span className="font-mono text-xs tracking-wider text-white font-bold">
            REGION CALIBRATION
          </span>
          <div className="font-mono text-[0.65rem] text-zinc-500 mt-0.5">
            Click on the frame to define each approach zone · 3+ points per region
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={refreshFrame} className="btn-minimal">↻ REFRESH FRAME</button>
          <button onClick={onClose} className="btn-minimal">✕ CLOSE</button>
        </div>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* Canvas Monitor */}
        <div className="flex-1 relative border border-zinc-800 bg-black flex items-center justify-center">
          {imgSrc && (
            <img
              ref={imgRef}
              src={imgSrc}
              onLoad={drawAll}
              className="hidden"
              alt=""
            />
          )}
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            onClick={handleCanvasClick}
            className="w-full h-full block cursor-crosshair object-contain"
          />
        </div>

        {/* Right Controls Panel */}
        <div className="w-56 flex flex-col gap-3">
          {/* Approach Selector */}
          <div className="border border-zinc-800 p-3.5 bg-zinc-950">
            <div className="font-mono text-[0.65rem] text-zinc-500 tracking-wider mb-2.5">
              ACTIVE APPROACH
            </div>
            {APPROACHES.map(app => {
              const pts = regions[app];
              const ok = pts.length >= 3;
              return (
                <button
                  key={app}
                  onClick={() => setActiveApproach(app)}
                  className={`w-full p-2 mb-1 border font-mono text-xs font-bold tracking-wider cursor-pointer flex justify-between items-center transition-colors ${
                    activeApproach === app
                      ? 'bg-white text-black border-white'
                      : 'bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <span>{app.toUpperCase()}</span>
                  <span className={`text-[0.6rem] ${ok ? 'text-emerald-500' : 'text-zinc-500'}`}>
                    {ok ? `✓ ${pts.length}pts` : `${pts.length}pts`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Controls for Active Approach */}
          <div className="border border-zinc-800 p-3.5 bg-zinc-950">
            <div className="font-mono text-[0.65rem] text-zinc-500 tracking-wider mb-2">
              {activeApproach.toUpperCase()} CONTROLS
            </div>
            <div className="font-mono text-[0.65rem] text-zinc-400 mb-2.5">
              {regions[activeApproach].length} points placed
            </div>
            <button onClick={clearActive} className="btn-minimal w-full mb-1.5">
              CLEAR REGION
            </button>

            {/* Presets */}
            <button
              onClick={() => {
                const presets: Record<ApproachName, [number, number][]> = {
                  north: [[430,0],[760,0],[760,200],[430,200]],
                  south: [[390,490],[760,490],[760,720],[390,720]],
                  east:  [[860,170],[1280,170],[1280,450],[860,450]],
                  west:  [[0,170],[380,170],[380,450],[0,450]],
                };
                setRect(presets[activeApproach]);
              }}
              className="btn-minimal w-full"
            >
              USE PRESET
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={saveRegions}
            disabled={!allValid}
            className={`p-3 font-mono text-xs font-extrabold tracking-wider border transition-colors ${
              saved
                ? 'bg-zinc-900 text-emerald-400 border-emerald-500'
                : (allValid ? 'bg-white text-black border-white cursor-pointer' : 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed')
            }`}
          >
            {saved ? '✓ REGIONS SAVED' : 'SAVE REGIONS →'}
          </button>

          <div className="font-mono text-[0.62rem] text-zinc-500 leading-relaxed">
            Click 3–4 points around each road approach zone. The AI will only count vehicles inside these regions.
          </div>
        </div>
      </div>
    </div>
  );
}
