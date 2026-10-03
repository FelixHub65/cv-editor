"use client";

import { useLiveEditorState } from "./use-live-editor-state";
import { $getSelection, $getState, $isNodeSelection, $isParagraphNode, $isRangeSelection, type LexicalNode } from "lexical";
import { $isHeadingNode } from "@lexical/rich-text";
import { $isListItemNode } from "@lexical/list";
import { blockIdState } from "./nodes";

function $textBlock(node: LexicalNode): LexicalNode | null {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isParagraphNode(current) || $isHeadingNode(current) || $isListItemNode(current)) return current;
    current = current.getParent();
  }
  return null;
}

// Read-only selection projection. It never writes document state or history.
export function $activeElementId(): string | null {
  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    const nodes = selection.getNodes();
    return nodes.length === 1 ? $getState(nodes[0], blockIdState) || null : null;
  }
  if (!$isRangeSelection(selection)) return null;
  const anchor = $textBlock(selection.anchor.getNode());
  const focus = $textBlock(selection.focus.getNode());
  // A range spanning blocks keeps native text highlighting, not a misleading
  // single-block border. The future outline can consume this same identity.
  if (!anchor || !focus || !anchor.is(focus)) return null;
  return $getState(anchor, blockIdState) || null;
}

export default function ActiveElementFocus() {
  const state = useLiveEditorState();
  const ids = state?.read(() => {
    const selection = $getSelection();
    return $isNodeSelection(selection) ? selection.getNodes().map((node) => $getState(node, blockIdState)).filter(Boolean) : [$activeElementId()].filter((id): id is string => !!id);
  }) ?? [];
  if (!ids.length) return null;
  // A scoped stylesheet decorates Lexical-rendered elements without mutating
  // their DOM. CSS outline adds no size and follows reflow/scroll automatically.
  return <style>{`${ids.map((id) => `.cv-input [data-block-id="${CSS.escape(id)}"]`).join(",")} { outline: 1px solid color-mix(in srgb, var(--color-app-focus) 40%, transparent); outline-offset: 2px; border-radius: 2px; }`}</style>;
}
