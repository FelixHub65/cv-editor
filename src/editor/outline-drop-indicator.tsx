"use client";

import { useEffect, useState, type RefObject } from "react";
import type { OutlineDropPreview } from "./outline-panel";

type Position = { left: number; top: number; targetTop: number; width: number; height?: number; inside: boolean };

export default function OutlineDropIndicator({ paperRef, preview, zoom }: {
  paperRef: RefObject<HTMLElement | null>;
  preview: OutlineDropPreview | null;
  zoom: number;
}) {
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    const paper = paperRef.current;
    if (!paper || !preview) { setPosition(null); return; }
    const current = preview;
    const target = paper.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(current.targetId)}"]`);
    if (!target) { setPosition(null); return; }

    function updatePosition() {
      const paperRect = paper!.getBoundingClientRect();
      const targetRect = target!.getBoundingClientRect();
      const children = Array.from(target!.children).filter((child): child is HTMLElement => child instanceof HTMLElement && !!child.dataset.blockId);
      const lastChildRect = current.position === "inside" ? children.at(-1)?.getBoundingClientRect() : null;
      const edge = current.position === "before" ? targetRect.top : current.position === "after" ? targetRect.bottom : lastChildRect?.bottom ?? targetRect.top + 12 * zoom;
      setPosition({
        left: (targetRect.left - paperRect.left) / zoom,
        top: (edge - paperRect.top) / zoom,
        targetTop: (targetRect.top - paperRect.top) / zoom,
        width: targetRect.width / zoom,
        height: current.position === "inside" ? targetRect.height / zoom : undefined,
        inside: current.position === "inside",
      });
    }

    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(paper);
    observer.observe(target);
    window.addEventListener("resize", updatePosition);
    return () => { observer.disconnect(); window.removeEventListener("resize", updatePosition); };
  }, [paperRef, preview, zoom]);

  if (!position || !preview) return null;
  return <div className="outline-drop-document-layer" aria-hidden="true">
    {position.inside && <span className="document-drop-container" style={{ left: position.left, top: position.targetTop, width: position.width, height: position.height }} />}
    <span className="document-drop-line" data-drop-target={preview.targetId} data-drop-position={preview.position} style={{ left: position.left, top: position.top, width: position.width }} />
  </div>;
}
