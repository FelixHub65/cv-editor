import { $createNodeSelection, $getRoot, $getSelection, $getState, $isElementNode, $isNodeSelection, $setSelection, type ElementNode } from "lexical";
import { blockIdState } from "./nodes";
import { $activeElementId } from "./active-element-focus";

export function $selectedElements(): ElementNode[] {
  const selection = $getSelection();
  const ids = $isNodeSelection(selection) ? new Set(selection.getNodes().map((node) => $getState(node, blockIdState))) : new Set([$activeElementId()]);
  function visit(parent: ElementNode): ElementNode[] {
    return parent.getChildren().filter($isElementNode).flatMap((node) => ids.has($getState(node, blockIdState)) ? [node] : visit(node));
  }
  return visit($getRoot());
}

export function $selectElementRange(node: ElementNode, anchorId: string | null, extend: boolean, toggle: boolean) {
  let nodes = $selectedElements();
  const siblings = node.getParentOrThrow().getChildren().filter($isElementNode);
  const anchor = siblings.findIndex((item) => $getState(item, blockIdState) === anchorId);
  if (extend && anchor >= 0) {
    const end = siblings.findIndex((item) => item.is(node));
    nodes = siblings.slice(Math.min(anchor, end), Math.max(anchor, end) + 1);
  } else if (toggle || extend) {
    nodes = nodes.some((item) => item.is(node)) ? nodes.filter((item) => !item.is(node)) : [...nodes.filter((item) => !item.isParentOf(node) && !node.isParentOf(item)), node];
  } else nodes = [node];
  const selection = $createNodeSelection();
  nodes.forEach((item) => selection.add(item.getKey()));
  $setSelection(selection);
}

export function $adjacentElements(nodes: ElementNode[]) {
  return nodes.length > 1 && nodes.every((node, index) => index === 0 || nodes[index - 1].getNextSibling()?.is(node));
}
