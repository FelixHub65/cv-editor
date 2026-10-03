"use client";
import { useEffect, useRef, useState, type RefObject, type CSSProperties } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isNodeSelection, $isParagraphNode, $getState, HISTORY_MERGE_TAG, HISTORY_PUSH_TAG } from "lexical";
import { $isListItemNode } from "@lexical/list";
import { $isHeadingNode } from "@lexical/rich-text";
import { useLiveEditorState } from "./use-live-editor-state";
import { $elementNodes } from "./adapter";
import { blockIdState } from "./nodes";
import { $selectedElements, $selectElementRange } from "./element-selection";
import { $setSpace, $spacingControls, readSpaceValue, type SpaceControl } from "./spacing";
import { useSpacingPreview } from "./spacing-context";

type Band = { key: string; left: number; top: number; width: number; height: number; horizontal: boolean; control: SpaceControl; value: number };
export default function SpacingOverlay({ paperRef, zoom }: { paperRef: RefObject<HTMLElement | null>; zoom: number }) {
  const [editor] = useLexicalComposerContext();
  const state = useLiveEditorState();
  const { preview, setPreview } = useSpacingPreview();
  const [bands, setBands] = useState<Band[]>([]);
  const dragging = useRef<{ start: number; value: number; last: number; started: boolean; control: SpaceControl } | null>(null);
  const anchor = useRef<string | null>(null);
  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;
    function select(event: PointerEvent) {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-block-id]");
      if (!target) return;
      if (!(event.shiftKey || event.metaKey || event.ctrlKey)) {
        anchor.current = target.dataset.blockId ?? null;
        // Establish a text range before native mousedown positions the caret.
        // Otherwise focusing from an inspector after NodeSelection undo can
        // restore the first document block instead of the clicked text.
        editor.update(() => {
          if (!$isNodeSelection($getSelection())) return;
          const node = $elementNodes().find((item) => $getState(item, blockIdState) === target.dataset.blockId);
          if ($isParagraphNode(node) || $isHeadingNode(node) || $isListItemNode(node)) node.selectStart();
        }, { discrete: true });
        return;
      }
      // Shift inside text remains native text selection; modifiers or the edge
      // of a block explicitly select elements.
      const rect = target.getBoundingClientRect();
      if (event.shiftKey && !event.metaKey && !event.ctrlKey && event.clientX > rect.left + 8 && event.clientX < rect.right - 8) return;
      event.preventDefault(); event.stopPropagation();
      editor.update(() => {
        const node = $elementNodes().find((item) => $getState(item, blockIdState) === target.dataset.blockId);
        if (!node) return;
        const fallback = $selectedElements()[0];
        $selectElementRange(node, anchor.current ?? (fallback ? $getState(fallback, blockIdState) : null), event.shiftKey, event.metaKey || event.ctrlKey);
      });
      if (!event.shiftKey) anchor.current = target.dataset.blockId ?? null;
    }
    root.addEventListener("pointerdown", select, true);
    return () => root.removeEventListener("pointerdown", select, true);
  }, [editor]);

  useEffect(() => {
    const paper = paperRef.current;
    if (!paper || !state) return;
    const controls = state.read($spacingControls);
    const active = preview && controls.find((control) => control.id === preview.id && control.keys.join() === preview.keys.join());
    const shown = active ? [active] : controls.filter((control) => control.side !== "all");
    function measure() {
      const origin = paper!.getBoundingClientRect();
      const next: Band[] = [];
      shown.forEach((control) => control.keys.forEach((key) => {
        const dom = editor.getElementByKey(key);
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        const style = getComputedStyle(dom);
        const left = (rect.left - origin.left) / zoom, top = (rect.top - origin.top) / zoom, width = rect.width / zoom, height = rect.height / zoom;
        const add = (side: string, x: number, y: number, w: number, h: number, value: number, horizontal = false) => next.push({ key: `${control.id}-${key}-${side}`, left: x, top: y, width: w, height: h, horizontal, control, value });
        if (control.kind === "padding") {
          const sides = control.side === "all" ? ["top", "right", "bottom", "left"] : [control.side!];
          sides.forEach((side) => {
            const value = parseFloat(style.getPropertyValue(`padding-${side}`)) || 0;
            const horizontal = side === "left" || side === "right";
            add(side, left + (side === "right" ? width - value : 0), top + (side === "bottom" ? height - value : 0), horizontal ? value : width, horizontal ? height : value, value, horizontal);
          });
        } else if (control.kind === "column-gap") {
          const first = dom.firstElementChild?.getBoundingClientRect();
          if (first) { const value = parseFloat(style.columnGap) || 0; add("columns", (first.right - origin.left) / zoom, top, value, height, value, true); }
        } else {
          const value = parseFloat(style.marginTop) || 0;
          add("gap", left, top - value, width, value, value);
        }
      }));
      setBands(next);
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(paper);
    paper.querySelectorAll("[data-block-id]").forEach((element) => observer.observe(element));
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [editor, paperRef, state, zoom, preview]);

  function change(control: SpaceControl, value: number, merge = false) {
    editor.update(() => $setSpace(control, value), { tag: merge ? HISTORY_MERGE_TAG : HISTORY_PUSH_TAG });
  }
  return <div className="spacing-overlay" aria-label="Spacing controls">
    {bands.map((band, index) => {
      const active = preview?.id === band.control.id && preview.keys.join() === band.control.keys.join();
      const isPadding = band.control.kind === "padding";
      return <div key={band.key} className={`spacing-band ${isPadding ? "padding" : "gap"} ${active ? "active" : ""} ${band.horizontal ? "horizontal" : ""}`} style={{ left: band.left, top: band.top, width: band.width, height: band.height, "--spacing-size": `${band.horizontal ? band.width : band.height}px` } as CSSProperties}>
        <button type="button" role="slider" className="spacing-grip" aria-label={`${band.control.label} handle ${index + 1}`} aria-valuemin={0} aria-valuemax={80} aria-valuenow={band.value} aria-orientation={band.horizontal ? "horizontal" : "vertical"}
          onMouseEnter={() => { if (!dragging.current) setPreview(band.control); }} onMouseLeave={() => { if (!dragging.current) setPreview(null); }}
          onFocus={() => setPreview(band.control)} onBlur={() => { if (!dragging.current) setPreview(null); }}
          onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); dragging.current = { start: band.horizontal ? event.clientX : event.clientY, value: readSpaceValue(editor, band.control) ?? band.value, last: readSpaceValue(editor, band.control) ?? band.value, started: false, control: band.control }; setPreview(band.control); }}
          onPointerMove={(event) => { const drag = dragging.current; if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return; const delta = ((band.horizontal ? event.clientX : event.clientY) - drag.start) / zoom; const next = Math.max(0, Math.min(80, Math.round(drag.value + delta * (band.control.side === "right" ? -1 : 1)))); if (next === drag.last) return; change(drag.control, next, drag.started); drag.last = next; drag.started = true; }}
          onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); dragging.current = null; setPreview(null); }}
          onPointerCancel={() => { dragging.current = null; setPreview(null); }}
          onLostPointerCapture={() => { dragging.current = null; }}
          onKeyDown={(event) => { const step = event.shiftKey ? 5 : 1; const next = event.key === "ArrowUp" || event.key === "ArrowRight" ? band.value + step : event.key === "ArrowDown" || event.key === "ArrowLeft" ? band.value - step : event.key === "Home" ? 0 : event.key === "End" ? 80 : null; if (next !== null) { event.preventDefault(); change(band.control, next); } }}>
          <span className="spacing-ruler" />{active && index === 0 && <span className="spacing-value">{isPadding ? `${band.control.side === "all" ? "All" : band.control.side} padding` : "Gap"} · {band.value}</span>}
        </button>
      </div>;
    })}
  </div>;
}
