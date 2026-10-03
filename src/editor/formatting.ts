import { $getSelection, $getState, $isElementNode, $isParagraphNode, $isRangeSelection, $setState, $createParagraphNode, type ElementNode } from "lexical";
import { $isHeadingNode, $createHeadingNode } from "@lexical/rich-text";
import { $isListItemNode, $isListNode, $createListNode } from "@lexical/list";
import { spacingState, appearanceState, blockIdState } from "./nodes";
import type { BlockAppearance } from "@/domain/cv";

export function $selectedBlocks(): ElementNode[] {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return [];
  const blocks = new Set<ElementNode>();
  for (const selected of selection.getNodes()) {
    let node = $isElementNode(selected) ? selected : selected.getParent();
    while (node && !$isParagraphNode(node) && !$isHeadingNode(node) && !$isListItemNode(node)) node = node.getParent();
    if (node) blocks.add(node);
  }
  return [...blocks];
}
export function $setBlockAppearance(patch: Partial<BlockAppearance>) {
  for (const node of $selectedBlocks()) {
    $setState(node, appearanceState, { ...$getState(node, appearanceState), ...patch });
    if (patch.alignment) node.setFormat(patch.alignment);
  }
}
export function $setTextStyle(style: string) {
  for (const block of $selectedBlocks()) {
    if ($isListItemNode(block)) continue;
    const next = /^h[123]$/.test(style) ? $createHeadingNode(style as "h1" | "h2" | "h3") : $createParagraphNode();
    $setState(next, blockIdState, $getState(block, blockIdState));
    $setState(next, spacingState, $getState(block, spacingState));
    $setState(next, appearanceState, { ...$getState(block, appearanceState), textStyle: style === "subtitle" || style === "caption" ? style : undefined });
    next.setFormat(block.getFormatType());
    next.append(...block.getChildren());
    block.replace(next);
  }
}

export function $removeSelectedList() {
  for (const item of $selectedBlocks()) {
    const list = item.getParent();
    if (!$isListItemNode(item) || !$isListNode(list)) continue;
    const paragraph = $createParagraphNode();
    $setState(paragraph, blockIdState, $getState(item, blockIdState));
    $setState(paragraph, spacingState, { ...$getState(item, spacingState), ...(!item.getPreviousSibling() && $getState(list, spacingState).before !== undefined ? { before: $getState(list, spacingState).before } : {}) });
    $setState(paragraph, appearanceState, $getState(item, appearanceState));
    paragraph.setFormat(item.getFormatType());
    const after = item.getNextSiblings();
    if (after.length) {
      const trailing = $createListNode(list.getListType(), item.getValue() + 1).append(...after);
      $setState(trailing, spacingState, { ...$getState(list, spacingState), before: $getState(after[0], spacingState).before ?? $getState(list, spacingState).itemGap ?? 9 });
      list.insertAfter(trailing);
    }
    list.insertAfter(paragraph);
    paragraph.append(...item.getChildren());
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      for (const point of [selection.anchor, selection.focus]) if (point.key === item.getKey()) point.set(paragraph.getKey(), Math.min(point.offset, paragraph.getChildrenSize()), "element");
    }
    item.remove();
    if (list.isEmpty()) list.remove();
  }
}
