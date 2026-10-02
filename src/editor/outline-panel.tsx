"use client";

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { ChevronRight, GripVertical } from "lucide-react";
import { Tooltip } from "@/ui/tooltip";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLiveEditorState } from "./use-live-editor-state";
import {
  $createNodeSelection, $getRoot, $getState, $isElementNode, $isParagraphNode,
  $setSelection, HISTORY_PUSH_TAG, type ElementNode,
} from "lexical";
import { $isHeadingNode } from "@lexical/rich-text";
import { $isListItemNode, $isListNode } from "@lexical/list";
import { $activeElementId } from "./active-element-focus";
import {
  $canMoveOutlineElement, $elementNodes, $isOutlineElementMovable, $moveOutlineElement,
  type OutlineDropPosition,
} from "./adapter";
import { layoutState, blockIdState, columnsAppearanceState, CvColumnNode, CvColumnsNode, CvHeaderNode } from "./nodes";
import { ElementTypeIcon, elementTypeLabels, isElementType, type ElementType } from "@/ui/element-type-icon";

type OutlineItem = { id: string; key: string; type: ElementType; label: string; movable: boolean; children: OutlineItem[] };
export type OutlineDropPreview = { targetId: string; position: OutlineDropPosition };
const DOCUMENT_OUTLINE_ID = "outline-document";

function typeName(type: string) {
  return isElementType(type) ? elementTypeLabels[type] : "Element";
}

function outlineLabel(node: ElementNode) {
  const type = node.getType();
  if ($isListNode(node)) return node.getListType() === "number" ? "Numbered list" : "Bullet list";
  if (node instanceof CvHeaderNode) return "Header · Full width";
  if (node instanceof CvColumnsNode) return $getState(node, layoutState).mode === "page" ? "Full-height columns" : "Columns";
  if (node instanceof CvColumnNode) {
    const parent = node.getParent();
    const index = parent instanceof CvColumnsNode ? parent.getChildren().findIndex((child) => child.is(node)) : 0;
    const ratio = parent instanceof CvColumnsNode ? $getState(parent, columnsAppearanceState).ratio ?? 50 : 50;
    const primaryId = parent instanceof CvColumnsNode ? $getState(parent, layoutState).primaryColumnId || $getState(parent.getFirstChild()!, blockIdState) : "";
    return `${$getState(node, layoutState).label || `Column ${index + 1}`} · ${index === 0 ? ratio : 100 - ratio}%${primaryId === $getState(node, blockIdState) ? " · Primary content" : ""}`;
  }
  const ownText = ($isHeadingNode(node) || $isParagraphNode(node) || $isListItemNode(node)) ? node.getTextContent().trim() : "";
  if (ownText) return ownText;
  const firstText = node.getChildren().find((child) => $isElementNode(child) && child.getTextContent().trim())?.getTextContent().trim();
  return firstText ? `${typeName(type)} · ${firstText}` : typeName(type);
}

function readItem(node: ElementNode): OutlineItem {
  const type = node.getType();
  if (!isElementType(type) || type === "document") throw new Error(`Unsupported outline element type: ${type}`);
  return {
    id: $getState(node, blockIdState), key: node.getKey(), type, label: outlineLabel(node), movable: $isOutlineElementMovable($getState(node, blockIdState)),
    children: node.getChildren().filter((child): child is ElementNode => $isElementNode(child) && !child.isInline()).map(readItem),
  };
}

function ancestorIds(items: OutlineItem[], targetId: string, ancestors: string[] = []): string[] | null {
  for (const item of items) {
    if (item.id === targetId) return ancestors;
    const path = ancestorIds(item.children, targetId, [...ancestors, item.id]);
    if (path) return path;
  }
  return null;
}

export default function OutlinePanel({ onDocument, onDropPreview }: { onDocument: () => void; onDropPreview: (preview: OutlineDropPreview | null) => void }) {
  const [editor] = useLexicalComposerContext();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [keyboardMoveId, setKeyboardMoveId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: OutlineDropPosition } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const panel = useRef<HTMLDivElement | null>(null);
  const state = useLiveEditorState();
  const snapshot = state?.read(() => ({
    activeId: $activeElementId(),
    items: $getRoot().getChildren().filter($isElementNode).map(readItem),
  })) ?? { activeId: null, items: [] };
  const activeAncestorIds = snapshot.activeId ? ancestorIds(snapshot.items, snapshot.activeId) ?? [] : [];
  const activeAncestorKey = JSON.stringify(activeAncestorIds);

  useEffect(() => () => onDropPreview(null), [onDropPreview]);

  useEffect(() => {
    if (!snapshot.activeId) return;
    const ancestors = new Set<string>(JSON.parse(activeAncestorKey));
    let scrollFrame = 0;
    const revealFrame = requestAnimationFrame(() => {
      setCollapsed((current) => {
        if (![...ancestors].some((id) => current.has(id))) return current;
        const next = new Set(current);
        for (const id of ancestors) next.delete(id);
        return next;
      });
      scrollFrame = requestAnimationFrame(() => {
        panel.current?.querySelector<HTMLElement>(`[data-outline-row="${CSS.escape(snapshot.activeId!)}"]`)?.scrollIntoView({ block: "nearest" });
      });
    });
    return () => {
      cancelAnimationFrame(revealFrame);
      cancelAnimationFrame(scrollFrame);
    };
  }, [activeAncestorKey, snapshot.activeId]);

  function previewDrop(next: { id: string; position: OutlineDropPosition } | null) {
    if (dropTarget?.id === next?.id && dropTarget?.position === next?.position) return;
    setDropTarget(next);
    onDropPreview(next ? { targetId: next.id, position: next.position } : null);
  }

  function select(item: OutlineItem) {
    editor.update(() => {
      const node = $elementNodes().find((candidate) => $getState(candidate, blockIdState) === item.id);
      if (!node) return;
      if ($isHeadingNode(node) || $isParagraphNode(node) || $isListItemNode(node)) node.selectEnd();
      else {
        const selection = $createNodeSelection();
        selection.add(node.getKey());
        $setSelection(selection);
      }
    });
    editor.focus();
    requestAnimationFrame(() => editor.getElementByKey(item.key)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function keyboardTargets() {
    return Array.from(panel.current?.querySelectorAll<HTMLButtonElement>(".outline-keyboard-target") ?? []);
  }

  function focusTarget(target: HTMLButtonElement | undefined) {
    target?.focus();
    target?.scrollIntoView({ block: "nearest" });
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, item: { id: string; parentId?: string; hasChildren: boolean; isCollapsed: boolean }) {
    if (keyboardMoveId && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      const position = keyboardDrop(item.id);
      if (position) commitMove(keyboardMoveId, item.id, position, event.currentTarget.textContent?.trim() || "destination");
      else setAnnouncement("That destination cannot contain this item.");
      return;
    }
    if (keyboardMoveId && event.key === "Escape") {
      event.preventDefault();
      setKeyboardMoveId(null);
      previewDrop(null);
      setAnnouncement("Move cancelled.");
      return;
    }
    const targets = keyboardTargets();
    const index = targets.indexOf(event.currentTarget);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusTarget(targets[Math.min(index + 1, targets.length - 1)]);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusTarget(targets[Math.max(index - 1, 0)]);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTarget(targets[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTarget(targets.at(-1));
    } else if (event.key === "ArrowRight" && item.hasChildren) {
      event.preventDefault();
      if (item.isCollapsed) toggle(item.id);
      else focusTarget(targets[index + 1]);
    } else if (event.key === "ArrowLeft" && item.id !== DOCUMENT_OUTLINE_ID) {
      event.preventDefault();
      if (item.hasChildren && !item.isCollapsed) toggle(item.id);
      else focusTarget(targets.find((target) => target.dataset.outlineId === item.parentId));
    }
  }

  function keyboardDrop(targetId: string) {
    if (!keyboardMoveId || !state) return null;
    return (["inside", "before", "after"] as OutlineDropPosition[]).find((position) => state.read(() => $canMoveOutlineElement(keyboardMoveId, targetId, position))) ?? null;
  }

  function commitMove(sourceId: string, targetId: string, position: OutlineDropPosition, targetLabel: string) {
    let moved = false;
    editor.update(() => { moved = $moveOutlineElement(sourceId, targetId, position); }, { tag: HISTORY_PUSH_TAG });
    if (moved) setAnnouncement(`Moved item ${position} ${targetLabel}.`);
    setDraggedId(null);
    setKeyboardMoveId(null);
    previewDrop(null);
  }

  function validDrop(event: DragEvent<HTMLDivElement>, item: OutlineItem, sourceId: string | null) {
    if (!sourceId || !state) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const offset = (event.clientY - bounds.top) / bounds.height;
    const preferred: OutlineDropPosition = offset < .25 ? "before" : offset > .75 ? "after" : "inside";
    const fallback: OutlineDropPosition[] = offset < .5 ? [preferred, "before", "inside", "after"] : [preferred, "after", "inside", "before"];
    return fallback.find((position, index) => fallback.indexOf(position) === index && state.read(() => $canMoveOutlineElement(sourceId, item.id, position))) ?? null;
  }

  function rows(items: OutlineItem[], depth = 0, parentId = DOCUMENT_OUTLINE_ID) {
    return items.map((item) => {
      const hasChildren = item.children.length > 0;
      const isCollapsed = collapsed.has(item.id);
      return <li key={item.id}>
        <div
          className={`outline-row ${snapshot.activeId === item.id ? "active" : ""} ${dropTarget?.id === item.id ? `drop-${dropTarget.position}` : ""}`}
          data-outline-row={item.id}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onDragOver={(event) => {
            const position = validDrop(event, item, draggedId || event.dataTransfer.getData("text/plain"));
            if (!position) { previewDrop(null); return; }
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            previewDrop({ id: item.id, position });
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null) && dropTarget?.id === item.id) previewDrop(null);
          }}
          onDrop={(event) => {
            const sourceId = draggedId || event.dataTransfer.getData("text/plain");
            const position = validDrop(event, item, sourceId);
            if (!sourceId || !position) return;
            event.preventDefault();
            commitMove(sourceId, item.id, position, item.label);
          }}
        >
          {hasChildren ? <button tabIndex={-1} className="outline-disclosure" aria-expanded={!isCollapsed} aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${item.label}`} onClick={() => toggle(item.id)}><ChevronRight className={isCollapsed ? undefined : "expanded"} size={13} aria-hidden="true" /></button> : <span className="outline-spacer" />}
          <button className="outline-select outline-keyboard-target" data-outline-id={item.id} aria-pressed={snapshot.activeId === item.id} onFocus={() => {
            if (!keyboardMoveId) return;
            const position = keyboardDrop(item.id);
            previewDrop(position ? { id: item.id, position } : null);
          }} onKeyDown={(event) => navigate(event, { id: item.id, parentId, hasChildren, isCollapsed })} onClick={() => select(item)}>
            <Tooltip content={elementTypeLabels[item.type]}><span className="outline-type"><ElementTypeIcon type={item.type} size={14} strokeWidth={item.type === "cv-bullet" ? 3 : 1.8} /></span></Tooltip><span>{item.label}</span>
          </button>
          {item.movable ? <button
            className="outline-drag-handle"
            aria-label={`Move ${item.label} — press Space for keyboard move`}
            aria-pressed={keyboardMoveId === item.id}
            draggable
            onClick={() => select(item)}
            onKeyDown={(event) => {
              if (event.key !== " " && event.key !== "Enter") return;
              event.preventDefault();
              setKeyboardMoveId(item.id);
              setAnnouncement(`Moving ${item.label}. Use arrow keys to choose a destination, then press Enter to drop or Escape to cancel.`);
              panel.current?.querySelector<HTMLButtonElement>(`.outline-select[data-outline-id="${CSS.escape(item.id)}"]`)?.focus();
            }}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item.id);
              setDraggedId(item.id);
              setAnnouncement(`Moving ${item.label}.`);
            }}
            onDragEnd={() => { setDraggedId(null); previewDrop(null); }}
          ><GripVertical size={14} aria-hidden="true" /></button> : <span className="outline-drag-spacer" />}
        </div>
        {hasChildren && !isCollapsed && <ul>{rows(item.children, depth + 1, item.id)}</ul>}
      </li>;
    });
  }

  return <div className="outline-panel" ref={panel}>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <div className="outline-document"><button className="outline-document-heading outline-keyboard-target" data-outline-id={DOCUMENT_OUTLINE_ID} onKeyDown={(event) => navigate(event, { id: DOCUMENT_OUTLINE_ID, hasChildren: snapshot.items.length > 0, isCollapsed: false })} onClick={onDocument}><ElementTypeIcon type="document" size={15} strokeWidth={1.8} />Document</button></div>
    <ul className="outline-tree">{rows(snapshot.items)}</ul>
  </div>;
}
