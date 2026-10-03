import { $getNodeByKey, $getState, $setState, $isElementNode, type LexicalEditor, type ElementNode } from "lexical";
import { $isListNode } from "@lexical/list";
import { regionPadding, type RegionPadding } from "@/domain/cv";
import { CvColumnNode, CvColumnsNode, CvHeaderNode, columnsAppearanceState, regionAppearanceState, spacingState } from "./nodes";
import { $adjacentElements, $selectedElements } from "./element-selection";

export type SpaceControl = { id: string; label: string; kind: "gap" | "padding" | "items" | "column-gap"; keys: string[]; side?: keyof RegionPadding | "all"; owner?: string };
export function $spacingControls(): SpaceControl[] {
  const nodes = $selectedElements();
  if (!nodes.length) return [];
  const controls: SpaceControl[] = [];
  const first = nodes[0], last = nodes.at(-1)!;
  const adjacent = $adjacentElements(nodes);
  if (nodes.length > 1 && !adjacent) return [];
  if (adjacent && !(first.getParent() instanceof CvColumnsNode)) controls.push({ id: "between", label: "Gap between", kind: "gap", keys: nodes.slice(1).map((node) => node.getKey()) });
  if (!(first instanceof CvColumnNode)) {
    function boundary(start: ElementNode, above: boolean): SpaceControl | null {
      let node = start;
      const id = above ? "above" : "below";
      while (true) {
        const sibling = above ? node.getPreviousSibling() : node.getNextSibling();
        if (sibling) return { id, label: above ? "Space above" : "Space below", kind: "gap", keys: [above ? node.getKey() : sibling.getKey()] };
        const parent = node.getParent();
        if (parent instanceof CvColumnNode || parent instanceof CvHeaderNode) return { id, label: `${above ? "Top" : "Bottom"} inset · From ${parent instanceof CvColumnNode ? "column" : "header"}`, kind: "padding", keys: [parent.getKey()], side: above ? "top" : "bottom" };
        if (!parent || parent.getType() === "root" || parent instanceof CvColumnsNode) return null;
        node = parent;
      }
    }
    const above = boundary(first, true), below = boundary(last, false);
    if (above) controls.push(above);
    if (below) controls.push(below);
  }
  if (nodes.length === 1) {
    if ($isListNode(first)) controls.unshift({ id: "items", label: "Item spacing", kind: "items", owner: first.getKey(), keys: first.getChildren().slice(1).map((node) => node.getKey()) });
    if (first instanceof CvColumnsNode) controls.push({ id: "column-gap", label: "Column gap", kind: "column-gap", keys: [first.getKey()] });
    if (first instanceof CvColumnNode || first instanceof CvHeaderNode) {
      for (const side of ["all", "top", "right", "bottom", "left"] as const) controls.push({ id: `padding-${side}`, label: side === "all" ? "All padding" : `Padding ${side}`, kind: "padding", keys: [first.getKey()], side });
    }
  }
  return controls;
}

export function readSpaceValue(editor: LexicalEditor, control: SpaceControl): number | null {
  const values = control.keys.flatMap((key) => {
    const dom = editor.getElementByKey(key);
    if (!dom) return [];
    const style = getComputedStyle(dom);
    if (control.kind === "padding") return (control.side === "all" ? ["top", "right", "bottom", "left"] : [control.side!]).map((side) => parseFloat(style.getPropertyValue(`padding-${side}`)) || 0);
    return [parseFloat(control.kind === "column-gap" ? style.columnGap : style.marginTop) || 0];
  });
  if (!values.length && control.owner) return editor.getEditorState().read(() => { const node = $getNodeByKey(control.owner!); return node ? $getState(node, spacingState).itemGap ?? 9 : 9; });
  return values.every((value) => Math.abs(value - values[0]) < .01) ? Math.round(values[0] ?? 0) : null;
}

export function $setSpace(control: SpaceControl, value: number) {
  if (!Number.isFinite(value)) return;
  value = Math.max(0, Math.min(80, Math.round(value)));
  if (control.kind === "items" && control.owner) {
    const list = $getNodeByKey(control.owner);
    if (!$isListNode(list)) return;
    $setState(list, spacingState, { ...$getState(list, spacingState), itemGap: value });
    list.getChildren().forEach((child) => { const spacing = { ...$getState(child, spacingState) }; delete spacing.before; $setState(child, spacingState, spacing); child.markDirty(); });
    return;
  }
  control.keys.forEach((key) => {
    const node = $getNodeByKey(key);
    if (!node) return;
    if (control.kind === "padding" && (node instanceof CvColumnNode || node instanceof CvHeaderNode)) {
      const appearance = $getState(node, regionAppearanceState);
      const padding = regionPadding(appearance.padding);
      const patch = control.side === "all" ? { top: value, right: value, bottom: value, left: value } : { ...padding, [control.side!]: value };
      $setState(node, regionAppearanceState, { ...appearance, padding: patch });
    } else if (control.kind === "column-gap" && node instanceof CvColumnsNode) $setState(node, columnsAppearanceState, { ...$getState(node, columnsAppearanceState), gap: value });
    else if (control.kind === "gap" && $isElementNode(node) && node.getPreviousSibling() && !(node.getParent() instanceof CvColumnsNode)) $setState(node, spacingState, { ...$getState(node, spacingState), before: value });
  });
}
