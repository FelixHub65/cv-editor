"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip } from "./tooltip";

export function IconButton({ label, shortcut, children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; shortcut?: string; children: ReactNode }) {
  const tooltip = shortcut ? <><span>{label}</span><kbd>{shortcut}</kbd></> : label;
  return <Tooltip content={tooltip}><button type="button" className={`icon-button ${className}`.trim()} aria-label={label} {...props}>{children}</button></Tooltip>;
}

export type TabOption<T extends string> = { id: T; label: string; badge?: string | number };

export function Tabs<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: TabOption<T>[];
  onChange: (value: T) => void;
}) {
  return <div className="ui-tabs" role="tablist" aria-label={label}>
    {options.map((option) => <button
      type="button"
      role="tab"
      aria-selected={value === option.id}
      className={value === option.id ? "active" : ""}
      key={option.id}
      onClick={() => onChange(option.id)}
    >{option.label}{option.badge !== undefined && <span className="tab-badge">{option.badge}</span>}</button>)}
  </div>;
}

export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="property-row"><span>{label}</span><div>{children}</div></div>;
}
