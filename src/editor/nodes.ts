import { $getState, createState, ParagraphNode, ElementNode, type EditorConfig } from "lexical";
import { HeadingNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import {
  regionPadding, isBlockAppearance, isColumnsAppearance, isRegionAppearance,
  type BlockAppearance, type ColumnsAppearance, type RegionAppearance,
} from "@/domain/cv";

export const appearanceState = createState("appearance", { parse: (value): BlockAppearance => isBlockAppearance(value) ? value : {} });
function renderAppearance(node: ElementNode, dom: HTMLElement) {
  const value = $getState(node, appearanceState);
  dom.style.lineHeight = value.lineHeight ? String(value.lineHeight) : "";
  dom.style.marginBottom = value.spaceAfter !== undefined ? `${value.spaceAfter}px` : "";
  dom.dataset.textStyle = value.textStyle ?? "";
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
    dom.dataset.blockId = $getState(this, blockIdState);
    return dom;
  }
  updateDOM(prev: this, dom: HTMLElement, config: EditorConfig) {
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
    dom.dataset.blockId = $getState(this, blockIdState);
    return dom;
  }
  updateDOM(prev: this, dom: HTMLElement, config: EditorConfig) {
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
    dom.dataset.blockId = $getState(this, blockIdState);
    return dom;
  }
  updateDOM(prev: this, dom: HTMLElement, config: EditorConfig) {
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
    dom.dataset.blockId = $getState(this, blockIdState);
    return dom;
  }
  updateDOM(prev: this, dom: HTMLElement, config: EditorConfig) {
    dom.dataset.blockId = $getState(this, blockIdState);
    return super.updateDOM(prev, dom, config);
  }
}
export class CvSectionNode extends ElementNode {
  $config() { return this.config("cv-section", { extends: ElementNode }); }
  createDOM() {
    const dom = document.createElement("section");
    dom.className = "cv-section";
    dom.dataset.blockId = $getState(this, blockIdState);
    return dom;
  }
  updateDOM(_prev: this, dom: HTMLElement) {
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
    dom.dataset.blockId = $getState(this, blockIdState);
    return dom;
  }
  updateDOM(_prev: this, dom: HTMLElement) {
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
    dom.dataset.blockId = $getState(this, blockIdState);
    renderRegionAppearance(this, dom);
    return dom;
  }
  updateDOM(_prev: this, dom: HTMLElement) {
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
    dom.dataset.blockId = $getState(this, blockIdState);
    renderColumnsAppearance(this, dom);
    return dom;
  }
  updateDOM(_prev: this, dom: HTMLElement) {
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
    dom.dataset.blockId = $getState(this, blockIdState);
    renderRegionAppearance(this, dom);
    return dom;
  }
  updateDOM(_prev: this, dom: HTMLElement) {
    dom.dataset.blockId = $getState(this, blockIdState);
    renderRegionAppearance(this, dom);
    return false;
  }
  canBeEmpty() { return true; }
}
