"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createNodeSelection, $getNodeByKey, $getState, $setSelection, HISTORY_MERGE_TAG, HISTORY_PUSH_TAG,
} from "lexical";
import { useLiveEditorState } from "./use-live-editor-state";
import { $elementNodes, $setColumnsAppearance } from "./adapter";
import { blockIdState, columnsAppearanceState, CvColumnsNode } from "./nodes";
import { $activeElementId } from "./active-element-focus";

type Position = { id: string; key: string; ratio: number; left: number; top: number };

export default function ColumnResizeHandles({ paperRef, zoom }: { paperRef: RefObject<HTMLElement | null>; zoom: number }) {
  const [editor] = useLexicalComposerContext();
  const state = useLiveEditorState();
  const [positions, setPositions] = useState<Position[]>([]);
  const dragging = useRef<{ key: string; started: boolean } | null>(null);

  useEffect(() => {
    const paper = paperRef.current;
    if (!paper || !state) { setPositions([]); return; }
    const snapshot = state.read(() => {
      const activeId = $activeElementId();
      let active = $elementNodes().find((node) => $getState(node, blockIdState) === activeId) ?? null;
      let selectedColumns: CvColumnsNode | null = null;
      while (active) {
        if (active instanceof CvColumnsNode) { selectedColumns = active; break; }
        active = active.getParent();
      }
      return selectedColumns ? [{
        id: $getState(selectedColumns, blockIdState), key: selectedColumns.getKey(), ratio: $getState(selectedColumns, columnsAppearanceState).ratio ?? 50,
      }] : [];
    });
    function updatePositions() {
      const paperRect = paper!.getBoundingClientRect();
      setPositions(snapshot.flatMap((item) => {
        const dom = editor.getElementByKey(item.key);
        const firstColumn = dom?.querySelector<HTMLElement>(":scope > .cv-column");
        if (!dom || !firstColumn) return [];
        const columnsRect = dom.getBoundingClientRect();
        const firstRect = firstColumn.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(dom).columnGap || "0") * zoom;
        return [{ ...item, left: (firstRect.right + gap / 2 - paperRect.left) / zoom, top: (columnsRect.top - paperRect.top) / zoom }];
      }));
    }
    updatePositions();
    const observer = new ResizeObserver(updatePositions);
    observer.observe(paper);
    snapshot.forEach((item) => { const dom = editor.getElementByKey(item.key); if (dom) observer.observe(dom); });
    window.addEventListener("resize", updatePositions);
    return () => { observer.disconnect(); window.removeEventListener("resize", updatePositions); };
  }, [editor, paperRef, state, zoom]);

  function select(key: string) {
    editor.update(() => {
      const node = $getNodeByKey(key);
      if (!node) return;
      const selection = $createNodeSelection();
      selection.add(node.getKey());
      $setSelection(selection);
    });
  }

  function setRatio(key: string, ratio: number, tag = HISTORY_PUSH_TAG) {
    editor.update(() => {
      const node = $getNodeByKey(key);
      if (node instanceof CvColumnsNode) $setColumnsAppearance(node, { ratio: Math.max(30, Math.min(70, Math.round(ratio))) });
    }, { tag });
  }

  return <div className="column-resize-layer" aria-label="Column width controls">
    {positions.map((position) => <button
      type="button"
      role="slider"
      className="column-resize-handle"
      key={position.id}
      aria-label="Column width"
      aria-valuemin={30}
      aria-valuemax={70}
      aria-valuenow={position.ratio}
      aria-valuetext={`${position.ratio} percent and ${100 - position.ratio} percent`}
      style={{ left: position.left, top: position.top }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = { key: position.key, started: false };
        select(position.key);
      }}
      onPointerMove={(event) => {
        const drag = dragging.current;
        if (!drag || drag.key !== position.key || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const dom = editor.getElementByKey(position.key);
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(dom).columnGap || "0") * zoom;
        const ratio = ((event.clientX - rect.left - gap / 2) / (rect.width - gap)) * 100;
        setRatio(position.key, ratio, drag.started ? HISTORY_MERGE_TAG : HISTORY_PUSH_TAG);
        drag.started = true;
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        dragging.current = null;
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 5 : 1;
        const next = event.key === "ArrowLeft" ? position.ratio - step : event.key === "ArrowRight" ? position.ratio + step : event.key === "Home" ? 30 : event.key === "End" ? 70 : null;
        if (next === null) return;
        event.preventDefault();
        setRatio(position.key, next);
      }}
    >↔</button>)}
  </div>;
}
