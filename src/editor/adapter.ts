import {
  $createNodeSelection, $setSelection, $getNearestNodeFromDOMNode, CLICK_COMMAND, KEY_ENTER_COMMAND,
  $createLineBreakNode, $createParagraphNode, $createTextNode, $getRoot, $getState, $isElementNode, $isLineBreakNode,
  $isTextNode, $setState, createState, ParagraphNode, RootNode, type LexicalEditor, type ElementNode,
  $getSelection, $isNodeSelection, $isRangeSelection, $isParagraphNode,
  type LexicalNode, KEY_BACKSPACE_COMMAND, KEY_DELETE_COMMAND, COMMAND_PRIORITY_HIGH, mergeRegister,
} from "lexical";
import { $createListItemNode, $createListNode, $isListItemNode, $isListNode, ListItemNode, ListNode } from "@lexical/list";
import { $createHeadingNode, $isHeadingNode, HeadingNode } from "@lexical/rich-text";
import {
  type Block, type ColumnsAppearance, type DocumentElement, type Draft, type Proposal, type RegionAppearance, type Span,
  isProposal, needsReview, normalizeSpans,
} from "@/domain/cv";
import { createFixture } from "@/domain/fixture";
import { isDocumentAppearance, type DocumentAppearance, type FontFamily } from "@/domain/cv";
import { $createLinkNode, $isLinkNode, LinkNode } from "@lexical/link";
import {
  spacingState, dividerAppearanceState, layoutState, blockIdState, appearanceState, columnsAppearanceState, regionAppearanceState,
  CvBulletNode, CvParagraphNode, CvHeadingNode, CvListNode, CvSectionNode, CvEntryNode,
  CvHeaderNode, CvColumnsNode, CvColumnNode, CvDividerNode,
} from "./nodes";

export const documentAppearanceState = createState("documentAppearance", { parse: (value): DocumentAppearance => isDocumentAppearance(value) ? value : {} });

export const proposalState = createState("proposal", { parse: (value): Proposal => isProposal(value) ? value : createFixture().proposal });
export const editorNodes = [CvDividerNode, LinkNode, ListNode, ListItemNode, HeadingNode, CvBulletNode, CvParagraphNode, CvHeadingNode, CvListNode, CvSectionNode, CvEntryNode, CvHeaderNode, CvColumnsNode, CvColumnNode,
  { replace: ParagraphNode, with: () => new CvParagraphNode(), withKlass: CvParagraphNode },
  { replace: ListItemNode, with: () => new CvBulletNode(), withKlass: CvBulletNode },
  { replace: HeadingNode, with: (node: HeadingNode) => new CvHeadingNode(node.getTag()), withKlass: CvHeadingNode },
  { replace: ListNode, with: (node: ListNode) => new CvListNode(node.getListType(), node.getStart()), withKlass: CvListNode },
];
export function $writeSpans(node: ElementNode, spans: Span[]) {
  node.clear();
  for (const span of spans) {
    for (const [index, line] of span.text.split("\n").entries()) {
      if (index > 0) node.append($createLineBreakNode());
      if (!line) continue;
      const text = $createTextNode(line);
      if (span.bold) text.toggleFormat("bold");
      if (span.italic) text.toggleFormat("italic");
      if (span.underline) text.toggleFormat("underline");
      if (span.strikethrough) text.toggleFormat("strikethrough");
      text.setStyle([span.font && `font-family: ${span.font}`, span.size && `font-size: ${span.size}px`, span.color && `color: ${span.color}`].filter(Boolean).join("; "));
      node.append(span.link ? $createLinkNode(span.link).append(text) : text);
    }
  }
}
function $loadElement(element: DocumentElement): ElementNode {
  const node = element.type === "divider" ? new CvDividerNode() : element.type === "header" ? new CvHeaderNode() : element.type === "columns" ? new CvColumnsNode() : element.type === "column" ? new CvColumnNode() :
    element.type === "section" ? new CvSectionNode() : element.type === "entry" ? new CvEntryNode() :
    element.type === "list" ? $createListNode(element.listType ?? "bullet", element.listStart ?? 1) : element.type === "heading" ? $createHeadingNode(`h${element.level}`) :
    element.type === "bullet" ? $createListItemNode() : $createParagraphNode();
  $setState(node, blockIdState, element.id);
  $setState(node, spacingState, element.spacing ?? {});
  if (element.type === "divider") $setState(node, dividerAppearanceState, element.appearance ?? {});
  if ("children" in element) {
    node.append(...element.children.map($loadElement));
    if (element.type === "header" || element.type === "column") $setState(node, regionAppearanceState, element.appearance ?? {});
    if (element.type === "columns") $setState(node, layoutState, { mode: element.mode, primaryColumnId: element.primaryColumnId });
    if (element.type === "column") $setState(node, layoutState, { label: element.label });
    if (element.type === "columns") $setState(node, columnsAppearanceState, element.appearance ?? {});
  }
  else if ("spans" in element) {
    $writeSpans(node, element.spans);
    $setState(node, appearanceState, element.appearance ?? {});
    node.setFormat(element.appearance?.alignment ?? "");
  }
  return node;
}
export function $loadDraft(draft: Draft) {
  const root = $getRoot();
  root.clear();
  $setState(root, blockIdState, draft.cv.id);
  $setState(root, proposalState, draft.proposal);
  $setState(root, documentAppearanceState, draft.cv.appearance ?? {});
  root.append(...draft.cv.children.map($loadElement));
  if (root.isEmpty()) root.append($createParagraphNode());
}
export function $elementNodes(): ElementNode[] {
  function visit(node: ElementNode): ElementNode[] {
    return [node, ...node.getChildren().filter((child): child is ElementNode => $isElementNode(child) && !child.isInline()).flatMap(visit)];
  }
  return $getRoot().getChildren().filter($isElementNode).flatMap(visit);
}
export function $blockNodes(): ElementNode[] {
  return $elementNodes().filter((node) => $isParagraphNode(node) || $isHeadingNode(node) || $isListItemNode(node));
}
function $readBlock(node: ElementNode): Block {
  const id = $getState(node, blockIdState);
  function readInline(child: LexicalNode, link?: string): Span[] {
    if ($isLinkNode(child)) return child.getChildren().flatMap((nested) => readInline(nested, child.getURL()));
    if ($isTextNode(child)) {
      const style = Object.fromEntries(child.getStyle().split(";").filter(Boolean).map((part) => { const at = part.indexOf(":"); return [part.slice(0, at).trim(), part.slice(at + 1).trim()]; }));
      return [{ text: child.getTextContent(), bold: child.hasFormat("bold"), italic: child.hasFormat("italic"),
        ...(child.hasFormat("underline") && { underline: true }), ...(child.hasFormat("strikethrough") && { strikethrough: true }),
        ...(style["font-family"] && { font: style["font-family"].replaceAll('"', "").replaceAll("'", "") as FontFamily }),
        ...(style["font-size"] && { size: parseFloat(style["font-size"]) }), ...(style.color && { color: style.color }), ...(link && { link }),
      }];
    }
    if ($isLineBreakNode(child)) return [{ text: "\n", bold: false, italic: false }];
    throw new Error("Unsupported content in a CV block.");
  }
  const spans = normalizeSpans(node.getChildren().flatMap((child) => readInline(child)));
  const appearance = { ...$getState(node, appearanceState) };
  const alignment = node.getFormatType();
  delete appearance.alignment;
  if (["left", "center", "right", "justify"].includes(alignment)) appearance.alignment = alignment as "left" | "center" | "right" | "justify";
  const spacing = $getState(node, spacingState);
  const base = { id, spans, ...(Object.keys(spacing).length && { spacing }), ...(Object.keys(appearance).length && { appearance }) };
  if ($isHeadingNode(node)) return { ...base, type: "heading", level: Number(node.getTag().slice(1)) as 1 | 2 | 3 };
  return { ...base, type: $isListItemNode(node) ? "bullet" : "paragraph" };
}
export function $readBlocks(): Block[] { return $blockNodes().map($readBlock); }
function $readElement(node: ElementNode): DocumentElement {
  const spacing = $getState(node, spacingState);
  const spacingData = Object.keys(spacing).length ? { spacing } : {};
  if (node instanceof CvDividerNode) {
    const appearance = $getState(node, dividerAppearanceState);
    return { id: $getState(node, blockIdState), type: "divider", ...spacingData, ...(Object.keys(appearance).length && { appearance }) };
  }
  if (node instanceof CvHeaderNode || node instanceof CvColumnsNode || node instanceof CvColumnNode || node instanceof CvSectionNode || node instanceof CvEntryNode || $isListNode(node)) {
    const type = node instanceof CvHeaderNode ? "header" : node instanceof CvColumnsNode ? "columns" : node instanceof CvColumnNode ? "column" :
      node instanceof CvSectionNode ? "section" : node instanceof CvEntryNode ? "entry" : "list";
    const regionAppearance = node instanceof CvHeaderNode || node instanceof CvColumnNode ? $getState(node, regionAppearanceState) : null;
    const columnsAppearance = node instanceof CvColumnsNode ? $getState(node, columnsAppearanceState) : null;
    return {
      id: $getState(node, blockIdState),
      type,
      ...spacingData,
      ...((node instanceof CvColumnsNode || node instanceof CvColumnNode) && $getState(node, layoutState)),
      ...($isListNode(node) && node.getListType() === "number" && { listType: "number" as const }),
      ...($isListNode(node) && node.getListType() === "number" && node.getStart() !== 1 && { listStart: node.getStart() }),
      ...(regionAppearance && Object.keys(regionAppearance).length && { appearance: regionAppearance }),
      ...(columnsAppearance && Object.keys(columnsAppearance).length && { appearance: columnsAppearance }),
      children: node.getChildren().map((child) => {
        if (!$isElementNode(child)) throw new Error("Unexpected inline content in a document group.");
        return $readElement(child);
      }),
    } as DocumentElement;
  }
  if ($isParagraphNode(node) || $isHeadingNode(node) || $isListItemNode(node)) return $readBlock(node);
  throw new Error(`Unsupported document node: ${node.getType()}`);
}
export function $readDraft(): Draft {
  return {
    schemaVersion: 2,
    cv: { id: $getState($getRoot(), blockIdState), ...(Object.keys($getState($getRoot(), documentAppearanceState)).length && { appearance: $getState($getRoot(), documentAppearanceState) }), children: $getRoot().getChildren().map((node) => {
      if (!$isElementNode(node)) throw new Error("Unexpected document content.");
      return $readElement(node);
    }) },
    proposal: $getState($getRoot(), proposalState),
  };
}
export function $review(action: "accepted" | "rejected"): boolean {
  const proposal = $getState($getRoot(), proposalState);
  if (proposal.status !== "pending") return false;
  if (action === "accepted") {
    if (needsReview($readBlocks(), proposal)) return false;
    const target = $blockNodes().find((node) => $getState(node, blockIdState) === proposal.targetId);
    if (!target) return false;
    $writeSpans(target, proposal.replacement);
  }
  $setState($getRoot(), proposalState, { ...proposal, status: action });
  return true;
}

function $ancestorColumn(node: LexicalNode | null): CvColumnNode | null {
  let current = node;
  while (current) {
    if (current instanceof CvColumnNode) return current;
    current = current.getParent();
  }
  return null;
}

function $selectedColumn(): CvColumnNode | null {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) return $ancestorColumn(selection.anchor.getNode());
  if ($isNodeSelection(selection)) return $ancestorColumn(selection.getNodes()[0] ?? null);
  return null;
}

function $directColumns(parent: ElementNode): CvColumnsNode | null {
  return parent.getChildren().find((node): node is CvColumnsNode => node instanceof CvColumnsNode) ?? null;
}

function $wrapInColumns(parent: RootNode | CvSectionNode): boolean {
  if ($directColumns(parent)) return false;
  if (parent instanceof CvSectionNode && parent.getParent() instanceof CvColumnNode) return false;
  const children = parent.getChildren().filter($isElementNode);
  const body = children.filter((node, index) => !(node instanceof CvHeaderNode) && !(parent instanceof CvSectionNode && index === 0 && $isHeadingNode(node)));
  const first = new CvColumnNode().append(...body);
  const second = new CvColumnNode();
  $setState(first, blockIdState, crypto.randomUUID());
  $setState(second, blockIdState, crypto.randomUUID());
  const columns = new CvColumnsNode().append(first, second);
  $setState(columns, columnsAppearanceState, { ratio: 50, gap: 24, dividerWidth: 1, dividerColor: "#c5cfd3" });
  parent.append(columns);
  return true;
}

export function $primaryColumn(columns: CvColumnsNode): CvColumnNode {
  return (columns.getChildren().find((node) => $getState(node, blockIdState) === $getState(columns, layoutState).primaryColumnId) ?? columns.getFirstChild()) as CvColumnNode;
}

export function $setDocumentLayout(mode: "single" | "inset" | "page") {
  if (mode === "single") return $setDocumentColumns(false);
  const created = $setDocumentColumns(true);
  const columns = $directColumns($getRoot())!;
  if (created && mode === "page") $setColumnsAppearance(columns, { gap: 0, dividerWidth: 0 });
  $setState(columns, layoutState, { ...$getState(columns, layoutState), mode });
  if (mode === "page") for (const column of columns.getChildren()) {
    const appearance = $getState(column, regionAppearanceState);
    if (appearance.padding === undefined) $setState(column, regionAppearanceState, { ...appearance, padding: { top: 48, right: 32, bottom: 48, left: 32 } });
  }
  return true;
}

export function $swapColumns(columns: CvColumnsNode) {
  const primaryColumnId = $getState($primaryColumn(columns), blockIdState);
  const first = columns.getFirstChild()!;
  columns.append(first);
  $setState(columns, layoutState, { ...$getState(columns, layoutState), primaryColumnId });
  $setColumnsAppearance(columns, { ratio: 100 - ($getState(columns, columnsAppearanceState).ratio ?? 50) });
}

export function $applySidebarPreset(side: "left" | "right") {
  $setDocumentLayout("page");
  const columns = $directColumns($getRoot())!;
  const primary = $primaryColumn(columns);
  const secondary = columns.getChildren().find((node) => !node.is(primary))!;
  if ((side === "left") !== columns.getFirstChild()!.is(secondary)) $swapColumns(columns);
  $setState(columns, layoutState, { mode: "page", primaryColumnId: $getState(primary, blockIdState) });
  $setState(primary, layoutState, { label: "Main" });
  $setState(secondary, layoutState, { label: "Sidebar" });
  $setColumnsAppearance(columns, { ratio: side === "left" ? 30 : 70, gap: 0, dividerWidth: 0 });
  $setState(primary, regionAppearanceState, { background: "#ffffff", color: "#202a31", padding: { top: 48, right: 40, bottom: 48, left: 40 } });
  $setState(secondary, regionAppearanceState, { background: "#17324a", color: "#ffffff", padding: { top: 48, right: 24, bottom: 48, left: 24 } });
}

// A collapsed caret at a region edge must not merge layout containers.
// Ordinary text deletion and selections within a region stay Lexical-owned.
export function registerRegionBoundaries(editor: LexicalEditor) {
  function guard(event: KeyboardEvent | null, backward: boolean) {
    const selection = $getSelection();
    if ($isNodeSelection(selection) && selection.getNodes().some((node) => node instanceof CvColumnsNode || node instanceof CvColumnNode || node instanceof CvHeaderNode)) {
      event?.preventDefault();
      return true;
    }
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
    let node = selection.anchor.getNode();
    const offset = selection.anchor.offset;
    const size = $isElementNode(node) ? node.getChildrenSize() : node.getTextContentSize();
    if (offset !== (backward ? 0 : size)) return false;
    while (node.getParent()) {
      if (node instanceof CvColumnNode || node instanceof CvHeaderNode) {
        event?.preventDefault();
        return true;
      }
      if (backward ? node.getPreviousSibling() : node.getNextSibling()) return false;
      node = node.getParent()!;
    }
    return false;
  }
  return mergeRegister(
    editor.registerCommand(KEY_BACKSPACE_COMMAND, (event) => guard(event, true), COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_DELETE_COMMAND, (event) => guard(event, false), COMMAND_PRIORITY_HIGH),
  );
}

export function $setDocumentHeader(enabled: boolean) {
  const root = $getRoot();
  const header = root.getChildren().find((node) => node instanceof CvHeaderNode);
  if (enabled && !header) {
    const next = new CvHeaderNode().append($createParagraphNode());
    const columns = $directColumns(root);
    if (columns && $getState(columns, layoutState).mode === "page") $setState(next, regionAppearanceState, { padding: 32 });
    const first = root.getFirstChild();
    if (first) first.insertBefore(next); else root.append(next);
  } else if (!enabled && header) {
    const columns = $directColumns(root);
    if (columns) {
      const primary = $primaryColumn(columns);
      const first = primary.getFirstChild();
      for (const child of header.getChildren()) { if (first) first.insertBefore(child); else primary.append(child); }
    } else for (const child of header.getChildren()) header.insertBefore(child);
    header.remove();
  }
}

function $unwrapColumns(parent: RootNode | CvSectionNode): boolean {
  const columns = $directColumns(parent);
  if (!columns) return false;
  const primary = $primaryColumn(columns);
  for (const column of [primary, ...columns.getChildren().filter((node) => !node.is(primary))]) {
    if (!(column instanceof CvColumnNode)) continue;
    for (const child of column.getChildren()) columns.insertBefore(child);
  }
  columns.remove();
  return true;
}

export function $setDocumentColumns(two: boolean): boolean {
  return two ? $wrapInColumns($getRoot()) : $unwrapColumns($getRoot());
}

export function $setSectionColumns(section: CvSectionNode, two: boolean): boolean {
  return two ? $wrapInColumns(section) : $unwrapColumns(section);
}

export function $setColumnsAppearance(node: CvColumnsNode, patch: Partial<ColumnsAppearance>) {
  $setState(node, columnsAppearanceState, { ...$getState(node, columnsAppearanceState), ...patch });
}

export function $setRegionAppearance(node: CvHeaderNode | CvColumnNode, patch: Partial<RegionAppearance>) {
  $setState(node, regionAppearanceState, { ...$getState(node, regionAppearanceState), ...patch });
}

export type OutlineDropPosition = "before" | "inside" | "after";

function isStructuralLayoutNode(node: ElementNode) {
  return node instanceof CvHeaderNode || node instanceof CvColumnsNode || node instanceof CvColumnNode;
}

function isFixedGroupHeading(node: ElementNode) {
  const parent = node.getParent();
  return $isHeadingNode(node) && (parent instanceof CvSectionNode || parent instanceof CvEntryNode) && parent.getFirstChild()?.is(node);
}

function canAcceptOutlineChild(parent: ElementNode | RootNode, child: ElementNode) {
  if ($isListItemNode(child)) return $isListNode(parent);
  if ($isListNode(parent)) return false;
  if (child instanceof CvDividerNode || $isParagraphNode(child) || $isHeadingNode(child) || $isListNode(child)) {
    return (parent instanceof RootNode && !parent.getChildren().some((node) => node instanceof CvColumnsNode)) || parent instanceof CvHeaderNode || parent instanceof CvColumnNode || parent instanceof CvSectionNode || parent instanceof CvEntryNode;
  }
  if (child instanceof CvSectionNode) {
    if (parent instanceof RootNode) return !parent.getChildren().some((node) => node instanceof CvColumnsNode);
    return parent instanceof CvColumnNode && parent.getParent()?.getParent() instanceof RootNode;
  }
  if (child instanceof CvEntryNode) {
    if (parent instanceof CvSectionNode) return !parent.getChildren().some((node) => node instanceof CvColumnsNode);
    return parent instanceof CvColumnNode && parent.getParent()?.getParent() instanceof CvSectionNode;
  }
  return false;
}

function isAncestor(ancestor: ElementNode, node: ElementNode | RootNode) {
  let current: LexicalNode | null = node;
  while (current) {
    if (current.is(ancestor)) return true;
    current = current.getParent();
  }
  return false;
}

function outlineMove(draggedId: string, targetId: string, position: OutlineDropPosition) {
  const nodes = $elementNodes();
  const dragged = nodes.find((node) => $getState(node, blockIdState) === draggedId);
  const target = nodes.find((node) => $getState(node, blockIdState) === targetId);
  if (!dragged || !target || dragged.is(target) || isStructuralLayoutNode(dragged) || isFixedGroupHeading(dragged) || isAncestor(dragged, target)) return null;
  const parent = position === "inside" ? target : target.getParent();
  if (!parent || !canAcceptOutlineChild(parent, dragged)) return null;
  return { dragged, target, parent };
}

export function $isOutlineElementMovable(id: string): boolean {
  const node = $elementNodes().find((candidate) => $getState(candidate, blockIdState) === id);
  return !!node && !isStructuralLayoutNode(node) && !isFixedGroupHeading(node);
}

export function $canMoveOutlineElement(draggedId: string, targetId: string, position: OutlineDropPosition): boolean {
  return outlineMove(draggedId, targetId, position) !== null;
}

export function $moveOutlineElement(draggedId: string, targetId: string, position: OutlineDropPosition): boolean {
  const move = outlineMove(draggedId, targetId, position);
  if (!move) return false;
  if (position === "inside") move.parent.append(move.dragged);
  else if (position === "before") move.target.insertBefore(move.dragged);
  else move.target.insertAfter(move.dragged);
  return true;
}

export function $addSection() {
  const section = new CvSectionNode();
  const heading = $createHeadingNode("h2").append($createTextNode("New section"));
  section.append(heading, $createParagraphNode());
  const selectedColumn = $selectedColumn();
  const documentColumns = $directColumns($getRoot());
  const target = selectedColumn?.getParent()?.getParent() instanceof RootNode ? selectedColumn :
    documentColumns ? $primaryColumn(documentColumns) : $getRoot();
  target.append(section);
  heading.select(0, heading.getChildrenSize());
}
export function $addEntry() {
  const selection = $getSelection();
  const selected = $isRangeSelection(selection) ? selection.anchor.getNode() : $isNodeSelection(selection) ? selection.getNodes()[0] ?? null : null;
  let section: ElementNode | null = $isElementNode(selected) ? selected : selected?.getParent() ?? null;
  while (section && !(section instanceof CvSectionNode)) section = section.getParent();
  if (!section) {
    section = new CvSectionNode();
    section.append($createHeadingNode("h2").append($createTextNode("Experience")));
    const selectedColumn = $selectedColumn();
    const documentColumns = $directColumns($getRoot());
    const target = selectedColumn?.getParent()?.getParent() instanceof RootNode ? selectedColumn :
      documentColumns ? $primaryColumn(documentColumns) : $getRoot();
    target.append(section);
  }
  const heading = $createHeadingNode("h3").append($createTextNode("New entry"));
  const sectionColumns = $directColumns(section);
  const selectedColumn = $selectedColumn();
  const target = selectedColumn?.getParent() === sectionColumns ? selectedColumn :
    sectionColumns?.getFirstChild() instanceof CvColumnNode ? sectionColumns.getFirstChild() as CvColumnNode : section;
  target.append(new CvEntryNode().append(heading, $createParagraphNode()));
  heading.select(0, heading.getChildrenSize());
}
export function registerBlockIds(editor: LexicalEditor) {
  return editor.registerNodeTransform(RootNode, () => {
    const nodes = $elementNodes();
    const retained = new Set(nodes.map((node) => $getState(node, blockIdState)).filter(Boolean));
    // Transfer identity when a text block is converted but its text nodes survive.
    // Groups get independent IDs; a split never borrows a still-live block's ID.
    const previousOwners = editor.getEditorState().read(() => new Map(
      $blockNodes().flatMap((node) => node.getChildren().map((child) => [child.getKey(), $getState(node, blockIdState)] as const)),
    ));
    const seen = new Set<string>([$getState($getRoot(), blockIdState)]);
    for (const node of nodes) {
      let id = $getState(node, blockIdState);
      if (!id || seen.has(id)) {
        const previousId = node.getChildren().filter((child) => $isTextNode(child) || $isLineBreakNode(child))
          .map((child) => previousOwners.get(child.getKey())).find((value) => value && !retained.has(value) && !seen.has(value));
        id = previousId || crypto.randomUUID();
        $setState(node, blockIdState, id);
      }
      seen.add(id);
    }
  });
}

// Lexical's default list command walks to a root/shadow-root child. Our section
// and entry containers are ordinary elements so selection can span the whole CV.
// Convert selected text blocks in place rather than wrapping their container.
export function $insertBulletList(listType: "bullet" | "number" = "bullet") {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return;
  const blocks = new Set<ElementNode>();
  for (const selected of selection.getNodes()) {
    let node = $isElementNode(selected) ? selected : selected.getParent();
    while (node && !$isParagraphNode(node) && !$isHeadingNode(node) && !$isListItemNode(node)) node = node.getParent();
    if (node) blocks.add(node);
  }
  for (const block of blocks) {
    if (!block.isAttached()) continue;
    if ($isListItemNode(block)) { const parent = block.getParent(); if ($isListNode(parent)) parent.setListType(listType); continue; }
    const anchor = selection.anchor.key === block.getKey() ? selection.anchor.offset : null;
    const focus = selection.focus.key === block.getKey() ? selection.focus.offset : null;
    const item = $createListItemNode();
    $setState(item, blockIdState, $getState(block, blockIdState));
    $setState(item, spacingState, $getState(block, spacingState));
    $setState(item, appearanceState, $getState(block, appearanceState));
    item.setFormat(block.getFormatType());
    item.append(...block.getChildren());
    const previous = block.getPreviousSibling();
    const next = block.getNextSibling();
    if ($isListNode(previous) && previous.getListType() === listType) {
      previous.append(item);
      if ($isListNode(next) && next.getListType() === listType) { previous.append(...next.getChildren()); next.remove(); }
      block.remove();
    } else if ($isListNode(next) && next.getListType() === listType) {
      const first = next.getFirstChild();
      if (first) first.insertBefore(item); else next.append(item);
      block.remove();
    } else {
      const list = $createListNode(listType).append(item);
      $setState(list, spacingState, $getState(block, spacingState));
      block.replace(list);
    }
    if (anchor !== null) selection.anchor.set(item.getKey(), Math.min(anchor, item.getChildrenSize()), "element");
    if (focus !== null) selection.focus.set(item.getKey(), Math.min(focus, item.getChildrenSize()), "element");
  }
}

export function $addDivider() {
  const selection = $getSelection();
  const selected = $isRangeSelection(selection) ? selection.anchor.getNode() : $isNodeSelection(selection) ? selection.getNodes()[0] : null;
  let anchor = selected && $isElementNode(selected) ? selected : selected?.getParent();
  const divider = new CvDividerNode();
  while (anchor && anchor.getParent() && !canAcceptOutlineChild(anchor.getParent()!, divider)) anchor = anchor.getParent();
  if (anchor && !(anchor instanceof RootNode) && anchor.getParent()) anchor.insertAfter(divider);
  else {
    const columns = $directColumns($getRoot());
    (columns ? $primaryColumn(columns) : $getRoot()).append(divider);
  }
  const next = $createNodeSelection();
  next.add(divider.getKey());
  $setSelection(next);
}

export function registerDividers(editor: LexicalEditor) {
  // Prevent the browser from placing a text caret around a non-editable line.
  function pointerDown(event: PointerEvent) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.closest(".cv-divider")) return;
    event.preventDefault();
    target.setPointerCapture(event.pointerId);
    editor.getRootElement()?.focus({ preventScroll: true });
    editor.update(() => {
      const node = $getNearestNodeFromDOMNode(target);
      if (!(node instanceof CvDividerNode)) return;
      const selection = $createNodeSelection();
      selection.add(node.getKey());
      $setSelection(selection);
    });
  }

  function selectedDivider() {
    const selection = $getSelection();
    const node = $isNodeSelection(selection) && selection.getNodes().length === 1 ? selection.getNodes()[0] : null;
    return node instanceof CvDividerNode ? node : null;
  }
  function remove(event: KeyboardEvent | null) {
    const node = selectedDivider();
    if (!node) return false;
    event?.preventDefault();
    node.selectPrevious();
    node.remove();
    return true;
  }
  return mergeRegister(
    editor.registerRootListener((root, previous) => {
      previous?.removeEventListener("pointerdown", pointerDown);
      root?.addEventListener("pointerdown", pointerDown);
    }),
    editor.registerCommand(CLICK_COMMAND, (event) => {
      if (!(event.target instanceof HTMLElement)) return false;
      const node = $getNearestNodeFromDOMNode(event.target);
      if (!(node instanceof CvDividerNode)) return false;
      const selection = $createNodeSelection();
      selection.add(node.getKey());
      $setSelection(selection);
      return true;
    }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_BACKSPACE_COMMAND, remove, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_DELETE_COMMAND, remove, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_ENTER_COMMAND, (event) => {
      const node = selectedDivider();
      if (!node) return false;
      event?.preventDefault();
      const paragraph = $createParagraphNode();
      node.insertAfter(paragraph);
      paragraph.selectStart();
      return true;
    }, COMMAND_PRIORITY_HIGH),
  );
}
