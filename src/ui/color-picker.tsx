"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { hexToHsv, hexToRgb, hsvToHex, parseHex, rgbToHex } from "./color";
import { NumberField } from "./property-fields";

/** Reusable opaque color picker. Alpha is edited separately by the caller. */
export function ColorPicker({ label = "Color", value, onChange, opacity, onOpacityChange }: {
  label?: string; value: string; onChange: (value: string) => void; opacity?: number; onOpacityChange?: (value: number) => void;
}) {
  const id = useId();
  const picker = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    function dismiss(event: MouseEvent) {
      if (event.target instanceof Node && !picker.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("click", dismiss, true);
    return () => document.removeEventListener("click", dismiss, true);
  }, [open]);
  const [draft, setDraft] = useState<{ source: string; text: string } | null>(null);
  const [wheelState, setWheelState] = useState({ source: value, hsv: hexToHsv(value) });
  const [preview, setPreview] = useState<ReturnType<typeof hexToHsv> | null>(null);
  const text = draft?.source === value ? draft.text : value.slice(1).toUpperCase();
  const hsv = preview ?? (wheelState.source === value ? wheelState.hsv : hexToHsv(value));
  const color = hsvToHex(hsv.h, hsv.s, hsv.v);
  function commitWheel(next: typeof hsv) {
    const hex = hsvToHex(next.h, next.s, next.v);
    setWheelState({ source: hex, hsv: next });
    onChange(hex);
    setPreview(null);
  }
  const rgb = hexToRgb(value);
  function commitHex() {
    const parsed = parseHex(text);
    if (parsed && parsed !== value) onChange(parsed);
    setDraft(null);
  }
  function wheelColor(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const y = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    return { h: (Math.atan2(y, x) * 180 / Math.PI + 450) % 360, s: Math.min(1, Math.hypot(x, y)), v: hsv.v };
  }
  return <div className="color-picker" ref={picker}>
    <div className="color-opacity-row">
      <label className="inspector-field"><span>{label}</span><span className="inspector-input">
        <button type="button" className="color-swatch" aria-label={`Choose ${label.toLowerCase()}`} aria-expanded={open} aria-controls={id} style={{ backgroundColor: value }} onClick={() => setOpen(!open)} />
        <input aria-label={`${label} hex`} spellCheck={false} value={text} onChange={(event) => setDraft({ source: value, text: event.target.value })} onBlur={commitHex}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitHex(); } if (event.key === "Escape") { event.preventDefault(); setDraft(null); } }} />
      </span></label>
      {opacity !== undefined && onOpacityChange && <NumberField label="Opacity" value={opacity} min={0} max={100} suffix="%" onChange={onOpacityChange} />}
    </div>
    {open && <div id={id} className="color-picker-panel" role="group" aria-label={`${label} picker`} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(".color-swatch")?.focus(); } }}>
      <div className="color-wheel" role="slider" tabIndex={0} aria-label="Color wheel" aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(hsv.h)} aria-valuetext={`Hue ${Math.round(hsv.h)}, saturation ${Math.round(hsv.s * 100)}%`} aria-describedby={`${id}-help`}
        style={{ "--wheel-brightness": hsv.v } as CSSProperties}
        onPointerDown={(event) => { event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); setPreview(wheelColor(event)); }}
        onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) setPreview(wheelColor(event)); }}
        onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) { commitWheel(wheelColor(event)); event.currentTarget.releasePointerCapture(event.pointerId); } }}
        onPointerCancel={() => setPreview(null)}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault();
          const direction = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
          commitWheel(event.shiftKey ? { ...hsv, s: Math.max(0, Math.min(1, hsv.s + direction * .01)) } : { ...hsv, h: (hsv.h + direction + 360) % 360, s: hsv.s || 1 });
        }}>
        <span className="color-wheel-marker" style={{ left: `${50 + Math.sin(hsv.h * Math.PI / 180) * hsv.s * 50}%`, top: `${50 - Math.cos(hsv.h * Math.PI / 180) * hsv.s * 50}%`, backgroundColor: color }} />
      </div>
      <label className="color-brightness">Brightness<input aria-label="Color brightness" type="range" min={0} max={100} value={Math.round(hsv.v * 100)}
        onChange={(event) => setPreview({ ...hsv, v: Number(event.target.value) / 100 })}
        onPointerUp={() => { if (preview) commitWheel(preview); }}
        onKeyUp={() => { if (preview) commitWheel(preview); }}
        onBlur={() => { if (preview) commitWheel(preview); }} /></label>
      <div className="color-rgb-row">{(["R", "G", "B"] as const).map((channel, index) => <NumberField key={channel} label={channel} min={0} max={255} value={rgb[index]} onChange={(next) => onChange(rgbToHex(rgb.map((current, at) => at === index ? next : current)))} />)}</div>
      <p className="hint" id={`${id}-help`}>Arrow keys adjust hue. Shift + arrow adjusts saturation.</p>
    </div>}
  </div>;
}
