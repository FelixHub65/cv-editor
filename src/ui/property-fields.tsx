"use client";

import { useState, type ReactNode } from "react";

/** Draft input text stays local until a complete, valid value is committed. */
export function NumberField({ label, value, min, max, suffix, icon, placeholder, disabled, updateOnChange = false, onCommit, onChange }: {
  label: string; value: number | null; placeholder?: string; disabled?: boolean; min: number; max: number; suffix?: string; icon?: ReactNode; updateOnChange?: boolean; onCommit?: () => void; onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<{ source: number | null; text: string } | null>(null);
  const text = draft?.source === value ? draft.text : value === null ? "" : String(value);
  function commit() {
    const number = Number(text);
    if (text.trim() && Number.isFinite(number) && number >= min && number <= max && Number.isInteger(number) && number !== value) onChange(number);
    setDraft(null);
    onCommit?.();
  }
  return <label className="inspector-field"><span>{label}</span><span className="inspector-input">{icon}<input aria-label={label} placeholder={placeholder} disabled={disabled} type="number" min={min} max={max} step={1} value={text}
    onChange={(event) => {
      const next = event.target.value;
      const number = Number(next);
      setDraft({ source: value, text: next });
      if (updateOnChange && next.trim() && event.target.validity.valid && number !== value) onChange(number);
    }} onBlur={commit}
    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } if (event.key === "Escape") { event.preventDefault(); setDraft(null); onCommit?.(); } }} />{suffix && <span aria-hidden="true">{suffix}</span>}</span></label>;
}

export function SelectField<T extends string>({ label, value, options, icon, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; icon?: ReactNode; onChange: (value: T) => void;
}) {
  return <label className="inspector-field"><span>{label}</span><span className="inspector-input">{icon}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></span></label>;
}
