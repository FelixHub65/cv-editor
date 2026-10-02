"use client";

import { useRef, useState } from "react";

export default function SidebarResizer({ side, onResize }: {
  side: "left" | "right";
  onResize: (width: number) => void;
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [active, setActive] = useState(false);
  function resize(element: HTMLElement, width: number) {
    const shell = element.closest(".editor-shell")!;
    const other = shell.querySelector<HTMLElement>(side === "left" ? ".right-sidebar" : ".left-sidebar")!;
    const maximum = Math.min(window.innerWidth / 2, shell.clientWidth - other.offsetWidth - 240);
    onResize(Math.round(Math.max(220, Math.min(maximum, width))));
  }
  return <div
    className={`sidebar-resizer ${active ? "dragging" : ""}`}
    role="separator"
    aria-label={`Resize ${side} sidebar`}
    aria-orientation="vertical"
    tabIndex={0}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      drag.current = { x: event.clientX, width: event.currentTarget.parentElement!.getBoundingClientRect().width };
      event.currentTarget.setPointerCapture(event.pointerId);
      setActive(true);
    }}
    onPointerMove={(event) => {
      if (!drag.current) return;
      resize(event.currentTarget, drag.current.width + (event.clientX - drag.current.x) * (side === "left" ? 1 : -1));
    }}
    onPointerUp={(event) => {
      drag.current = null;
      setActive(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onLostPointerCapture={() => { drag.current = null; setActive(false); }}
    onKeyDown={(event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = (event.key === "ArrowRight" ? 1 : -1) * (side === "left" ? 1 : -1);
      resize(event.currentTarget, event.currentTarget.parentElement!.offsetWidth + direction * 20);
    }}
  />;
}
