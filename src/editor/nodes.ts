import { $getState, createState, ParagraphNode, ElementNode, type EditorConfig } from "lexical";
import { HeadingNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import {
  isElementSpacing, type ElementSpacing, regionPadding, isDividerAppearance, type DividerAppearance, isBlockAppearance, isColumnsAppearance, isRegionAppearance,
  type BlockAppearance, type ColumnsAppearance, type RegionAppearance,
} from "@/domain/cv";

export const appearanceState = createState("appearance", { parse: (value): BlockAppearance => isBlockAppearance(value) ? value : {} });
function renderAppearance(node: ElementNode, dom: HTMLElement) {
  const value = $getState(node, appearanceState);
  dom.style.lineHeight = value.lineHeight ? String(value.lineHeight) : "";

  dom.dataset.textStyle = value.textStyle ?? "";
}


export const spacingState = createState("spacing", { parse: (value): ElementSpacing => isElementSpacing(value) ? value : {} });
function renderSpacing(node: ElementNode, dom: HTMLElement) {
  const spacing = $getState(node, spacingState);
  const previous = node.getPreviousSibling();
  const parent = node.getParent();
  const listGap = parent instanceof ListNode ? $getState(parent, spacingState).itemGap : undefined;
  const legacy = listGap !== undefined ? undefined : previous ? $getState(previous, appearanceState).spaceAfter : undefined;
  const type = node.getType();
  const previousTag = previous instanceof HeadingNode ? previous.getTag() : "";
  const fallback = type === "cv-section" ? "var(--cv-section-spacing, 30px)" : type === "cv-entry" && previous?.getType() === type ? "22px" : type === "cv-bullet" ? "var(--cv-item-gap, 9px)" : previousTag === "h2" ? "15px" : previousTag ? "8px" : "10px";
  dom.style.setProperty("--cv-gap", !previous || node.getParent() instanceof CvColumnsNode ? "0px" : spacing.before !== undefined ? `${spacing.before}px` : legacy !== undefined ? `${legacy}px` : fallback);
  if (node instanceof ListNode) dom.style.setProperty("--cv-item-gap", `${spacing.itemGap ?? 9}px`);
}

export const blockIdState = createState("blockId", {
  parse: (value) => typeof value === "string" ? value : "",
  resetOnCopyNode: true,
});
export const regionAppearanceState = createState("regionAppearance", { parse: (value): RegionAppearance => isRegionAppearance(value) ? value : {} });
export const columnsAppearanceState = createState("columnsAppearance", { parse: (value): ColumnsAppearance => isColumnsAppearance(value) ? value : {} });

export const layoutState = createState("regionLayout", { parse: (value): { mode?: "inset" | "page"; primaryColumnId?: string; label?: string } => {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  return { ...(v.mode === "page" || v.mode === "inset" ? { mode: v.mode } : {}), ...(typeof v.primaryColumnId === "string" ? { primaryColumnId: v.primaryColumnId } : {}), ...(typeof v.label === "string" ? { label: v.label.slice(0, 60) } : {}) };
} });

function renderRegionAppearance(node: ElementNode, dom: HTMLElement) {
  const value = $getState(node, regionAppearanceState);
  dom.style.backgroundColor = value.background ?? "";
  dom.style.color = value.color ?? "";
  const padding = regionPadding(value.padding);
  dom.style.padding = value.padding !== undefined ? `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px` : "";
}

function renderColumnsAppearance(node: ElementNode, dom: HTMLElement) {
  const value = $getState(node, columnsAppearanceState);
  dom.style.setProperty("--cv-column-one", `${value.ratio ?? 50}%`);
  dom.style.setProperty("--cv-column-gap", `${value.gap ?? 24}px`);
  dom.style.setProperty("--cv-column-divider-width", `${value.dividerWidth ?? 1}px`);
  dom.style.setProperty("--cv-column-divider-color", value.dividerColor ?? "#c5cfd3");
  dom.dataset.layoutMode = $getState(node, layoutState).mode ?? "inset";
  dom.style.setProperty("--cv-column-ratio", String((value.ratio ?? 50) / 100));
  dom.dataset.columnRatio = String(value.ratio ?? 50);
}

// DOM attributes are emitted only through Lexical's node rendering lifecycle.
export class CvParagraphNode extends ParagraphNode {
  $config() { return this.config("cv-paragraph", { extends: ParagraphNode }); }
  createDOM(config: EditorConfig) {
    const dom = super.createDOM(config);
    renderAppearance(this, dom);
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    return dom;
  }
  updateDOM(prev: this, dom: HTMLElement, config: EditorConfig) {
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    const result = super.updateDOM(prev, dom, config);
    renderAppearance(this, dom);
    return result;
  }
}
export class CvBulletNode extends ListItemNode {
  $config() { return this.config("cv-bullet", { extends: ListItemNode }); }
  createDOM(config: EditorConfig) {
    const dom = super.createDOM(config);
    renderAppearance(this, dom);
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    return dom;
  }
  updateDOM(prev: this, dom: HTMLElement, config: EditorConfig) {
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    const result = super.updateDOM(prev, dom, config);
    renderAppearance(this, dom);
    return result;
  }
}


export class CvHeadingNode extends HeadingNode {
  $config() { return this.config("cv-heading", { extends: HeadingNode }); }
  createDOM(config: EditorConfig) {
    const dom = super.createDOM(config);
    renderAppearance(this, dom);
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    return dom;
  }
  updateDOM(prev: this, dom: HTMLElement, config: EditorConfig) {
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    const result = super.updateDOM(prev, dom, config);
    renderAppearance(this, dom);
    return result;
  }
}
export class CvListNode extends ListNode {
  $config() { return this.config("cv-list", { extends: ListNode }); }
  createDOM(config: EditorConfig) {
    const dom = super.createDOM(config);
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    return dom;
  }
  updateDOM(prev: this, dom: HTMLElement, config: EditorConfig) {
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    return super.updateDOM(prev, dom, config);
  }
}
export class CvSectionNode extends ElementNode {
  $config() { return this.config("cv-section", { extends: ElementNode }); }
  createDOM() {
    const dom = document.createElement("section");
    dom.className = "cv-section";
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    return dom;
  }
  updateDOM(_prev: this, dom: HTMLElement) {
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    return false;
  }
  canBeEmpty() { return false; }
}
export class CvEntryNode extends ElementNode {
  $config() { return this.config("cv-entry", { extends: ElementNode }); }
  createDOM() {
    const dom = document.createElement("div");
    dom.className = "cv-entry";
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    return dom;
  }
  updateDOM(_prev: this, dom: HTMLElement) {
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    return false;
  }
  canBeEmpty() { return false; }
}

// This is ordinary document body content. Exporters must not map it to a
// Word/PDF header or text box because ATS parsers may skip those constructs.
export class CvHeaderNode extends ElementNode {
  $config() { return this.config("cv-header", { extends: ElementNode }); }
  createDOM() {
    const dom = document.createElement("div");
    dom.className = "cv-header";
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    renderRegionAppearance(this, dom);
    return dom;
  }
  updateDOM(_prev: this, dom: HTMLElement) {
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    renderRegionAppearance(this, dom);
    return false;
  }
  canBeEmpty() { return true; }
}

export class CvColumnsNode extends ElementNode {
  $config() { return this.config("cv-columns", { extends: ElementNode }); }
  createDOM() {
    const dom = document.createElement("div");
    dom.className = "cv-columns";
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    renderColumnsAppearance(this, dom);
    return dom;
  }
  updateDOM(_prev: this, dom: HTMLElement) {
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    renderColumnsAppearance(this, dom);
    return false;
  }
  canBeEmpty() { return false; }
}

export class CvColumnNode extends ElementNode {
  $config() { return this.config("cv-column", { extends: ElementNode }); }
  createDOM() {
    const dom = document.createElement("div");
    dom.className = "cv-column";
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    renderRegionAppearance(this, dom);
    return dom;
  }
  updateDOM(_prev: this, dom: HTMLElement) {
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    renderRegionAppearance(this, dom);
    return false;
  }
  canBeEmpty() { return true; }
}

export const dividerAppearanceState = createState("dividerAppearance", { parse: (value): DividerAppearance => isDividerAppearance(value) ? value : {} });
function renderDividerAppearance(node: CvDividerNode, dom: HTMLElement) {
  const value = $getState(node, dividerAppearanceState);
  dom.style.setProperty("--cv-divider-color", value.color ?? "#c5cfd3");
  dom.style.setProperty("--cv-divider-opacity", String((value.opacity ?? 100) / 100));
  dom.style.setProperty("--cv-divider-thickness", `${value.thickness ?? 1}px`);
  dom.style.setProperty("--cv-divider-radius", value.ends === "rounded" ? "999px" : "0px");
}

// Atomic non-text element; kept in the same persistent-ID traversal as groups.
export class CvDividerNode extends ElementNode {
  $config() { return this.config("cv-divider", { extends: ElementNode }); }
  createDOM() {
    const dom = document.createElement("div");
    dom.className = "cv-divider";
    dom.contentEditable = "false";
    dom.setAttribute("role", "separator");
    dom.setAttribute("aria-label", "Divider");
    renderDividerAppearance(this, dom);
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    return dom;
  }
  updateDOM(_prev: this, dom: HTMLElement) {
    renderSpacing(this, dom);
    dom.dataset.blockId = $getState(this, blockIdState);
    renderDividerAppearance(this, dom);
    return false;
  }
  isKeyboardSelectable() { return true; }
}
