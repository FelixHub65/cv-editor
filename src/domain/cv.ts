export const FONT_FAMILIES = ["Arial", "Georgia", "Verdana", "Times New Roman"] as const;
export type FontFamily = typeof FONT_FAMILIES[number];
export type TextAppearance = { font?: FontFamily; size?: number; color?: string };
export type BlockAppearance = { alignment?: "left" | "center" | "right" | "justify"; lineHeight?: number; spaceAfter?: number; textStyle?: "subtitle" | "caption" };
export type DocumentAppearance = { font?: FontFamily; size?: number; lineHeight?: number; margin?: number; sectionSpacing?: number };
export type RegionPadding = { top: number; right: number; bottom: number; left: number };
// Numeric padding remains readable for existing schema-v2 drafts.
export type RegionAppearance = { background?: string; color?: string; padding?: number | RegionPadding };
export function regionPadding(value: RegionAppearance["padding"]): RegionPadding {
  return typeof value === "object" ? value : { top: value ?? 0, right: value ?? 0, bottom: value ?? 0, left: value ?? 0 };
}
export type ColumnsAppearance = { ratio?: number; gap?: number; dividerWidth?: number; dividerColor?: string };
export type Span = { text: string; bold: boolean; italic: boolean; underline?: boolean; strikethrough?: boolean; link?: string } & TextAppearance;
export type Block = { id: string; spans: Span[]; appearance?: BlockAppearance } & (
  { type: "paragraph" | "bullet" } | { type: "heading"; level: 1 | 2 | 3 }
);
export type ContentGroup = { id: string; type: "section" | "entry" | "list"; children: DocumentElement[]; listType?: "number"; listStart?: number };
export type HeaderGroup = { id: string; type: "header"; children: DocumentElement[]; appearance?: RegionAppearance };
export type ColumnsGroup = { id: string; mode?: "inset" | "page"; primaryColumnId?: string; type: "columns"; children: ColumnGroup[]; appearance?: ColumnsAppearance };
export type ColumnGroup = { id: string; label?: string; type: "column"; children: DocumentElement[]; appearance?: RegionAppearance };
export type Group = ContentGroup | HeaderGroup | ColumnsGroup | ColumnGroup;
export type DocumentElement = Block | Group;
export type CV = { id: string; children: DocumentElement[]; appearance?: DocumentAppearance };
export type Proposal = {
  id: string; targetId: string; expected: Block; replacement: Span[];
  reason: string;
  evidence: { id: string; source: string; text: string };
  status: "pending" | "accepted" | "rejected";
};
export type Draft = { schemaVersion: 2; cv: CV; proposal: Proposal };
export const plain = (text: string): Span[] => [{ text, bold: false, italic: false }];
export const textOf = (spans: Span[]) => spans.map((span) => span.text).join("");
export function allElements(elements: DocumentElement[]): DocumentElement[] {
  return elements.flatMap((element) => [element, ...("children" in element ? allElements(element.children) : [])]);
}
export function textBlocks(cv: CV): Block[] {
  return allElements(cv.children).filter((element): element is Block => "spans" in element);
}
export function documentName(cv: CV): string {
  const name = textBlocks(cv).find((block) => block.type === "heading" && block.level === 1);
  return name ? textOf(name.spans) || "Untitled CV" : "Untitled CV";
}
export function normalizeSpans(spans: Span[]): Span[] {
  return spans.reduce<Span[]>((result, span) => {
    if (!span.text) return result;
    const last = result.at(-1);
    if (last && ["bold", "italic", "underline", "strikethrough", "font", "size", "color", "link"].every((key) => last[key as keyof Span] === span[key as keyof Span])) last.text += span.text;
    else result.push({ ...span });
    return result;
  }, []);
}
export function needsReview(blocks: Block[], proposal: Proposal): boolean {
  const current = blocks.find((block) => block.id === proposal.targetId);
  return !current || current.type !== proposal.expected.type ||
    (current.type === "heading" && proposal.expected.type === "heading" && current.level !== proposal.expected.level) ||
    JSON.stringify(current.appearance ?? {}) !== JSON.stringify(proposal.expected.appearance ?? {}) ||
    JSON.stringify(normalizeSpans(current.spans)) !== JSON.stringify(normalizeSpans(proposal.expected.spans));
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.length > 0;
export function safeLink(value: string): boolean {
  try { return ["https:", "http:", "mailto:", "tel:"].includes(new URL(value).protocol); } catch { return false; }
}
const optionalNumber = (v: unknown, min: number, max: number) => v === undefined || (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max);
export const isDocumentAppearance = (v: unknown): v is DocumentAppearance => record(v) &&
  (v.font === undefined || FONT_FAMILIES.includes(v.font as FontFamily)) && optionalNumber(v.size, 8, 72) && optionalNumber(v.lineHeight, 1, 3) && optionalNumber(v.margin, 16, 100) && optionalNumber(v.sectionSpacing, 0, 80);
const optionalColor = (v: unknown) => v === undefined || (typeof v === "string" && /^#[\da-f]{6}$/i.test(v));
export const isRegionAppearance = (v: unknown): v is RegionAppearance => record(v) && optionalColor(v.background) && optionalColor(v.color) && (typeof v.padding === "object" ? record(v.padding) && ["top", "right", "bottom", "left"].every((side) => typeof (v.padding as Record<string, unknown>)[side] === "number" && optionalNumber((v.padding as Record<string, unknown>)[side], 0, 80)) : optionalNumber(v.padding, 0, 80));
export const isColumnsAppearance = (v: unknown): v is ColumnsAppearance => record(v) && optionalNumber(v.ratio, 30, 70) && optionalNumber(v.gap, 0, 80) && optionalNumber(v.dividerWidth, 0, 8) && optionalColor(v.dividerColor);
export const isBlockAppearance = (v: unknown): v is BlockAppearance => record(v) &&
  (v.alignment === undefined || ["left", "center", "right", "justify"].includes(v.alignment as string)) &&
  optionalNumber(v.lineHeight, 1, 3) && optionalNumber(v.spaceAfter, 0, 80) &&
  (v.textStyle === undefined || ["subtitle", "caption"].includes(v.textStyle as string));
const isSpans = (value: unknown): value is Span[] => Array.isArray(value) && value.every((s) => record(s) && typeof s.text === "string" && typeof s.bold === "boolean" && typeof s.italic === "boolean" &&
  (s.underline === undefined || typeof s.underline === "boolean") && (s.strikethrough === undefined || typeof s.strikethrough === "boolean") &&
  (s.font === undefined || FONT_FAMILIES.includes(s.font as FontFamily)) && optionalNumber(s.size, 8, 72) &&
  optionalColor(s.color) && (s.link === undefined || (typeof s.link === "string" && safeLink(s.link))));
const isBlock = (value: unknown): value is Block => record(value) && nonempty(value.id) && isSpans(value.spans) &&
  (value.appearance === undefined || isBlockAppearance(value.appearance)) && (value.type === "paragraph" || value.type === "bullet" || (value.type === "heading" && [1, 2, 3].includes(value.level as number)));
export function isProposal(value: unknown): value is Proposal {
  return record(value) && nonempty(value.id) && nonempty(value.targetId) && isBlock(value.expected) &&
    value.expected.id === value.targetId && isSpans(value.replacement) && typeof value.reason === "string" &&
    record(value.evidence) && nonempty(value.evidence.id) && typeof value.evidence.source === "string" && typeof value.evidence.text === "string" &&
    ["pending", "accepted", "rejected"].includes(value.status as string);
}
type ValidationParent = "document" | Group["type"];
function validElements(value: unknown, parent: ValidationParent, depth = 0, columnOwner?: "document" | "section"): value is DocumentElement[] {
  if (!Array.isArray(value) || depth > 8) return false;
  return value.every((element) => {
    if (isBlock(element)) return parent === "list" ? element.type === "bullet" : element.type !== "bullet";
    if (!record(element) || !nonempty(element.id)) return false;
    const type = element.type;
    if (type === "list") return parent !== "list" && (element.listType === undefined || element.listType === "number") && (element.listStart === undefined || (Number.isInteger(element.listStart) && optionalNumber(element.listStart, 1, 10000))) && validElements(element.children, type, depth + 1);
    if (type === "header") return parent === "document" && (element.appearance === undefined || isRegionAppearance(element.appearance)) && validElements(element.children, type, depth + 1);
    if (type === "columns") return (element.mode === undefined || element.mode === "inset" || (element.mode === "page" && parent === "document")) && (element.primaryColumnId === undefined || (Array.isArray(element.children) && element.children.some((column) => record(column) && column.id === element.primaryColumnId))) && (parent === "document" || parent === "section") && (element.appearance === undefined || isColumnsAppearance(element.appearance)) &&
      Array.isArray(element.children) && element.children.length === 2 && element.children.every((column) => record(column) && nonempty(column.id) && column.type === "column" && (column.label === undefined || (typeof column.label === "string" && column.label.length <= 60)) &&
        (column.appearance === undefined || isRegionAppearance(column.appearance)) && validElements(column.children, "column", depth + 1, parent));
    if (type === "column") return false;
    if (type === "section") return (parent === "document" || (parent === "column" && columnOwner === "document")) && validElements(element.children, type, depth + 1);
    if (type === "entry") return (parent === "section" || (parent === "column" && columnOwner === "section")) && validElements(element.children, type, depth + 1);
    return false;
  });
}

// Layout wrappers disappear; primary content precedes secondary content.
// Legacy documents retain their original visual order when no primary is declared.
export function linearizeForAts(cv: CV): CV {
  function flatten(elements: DocumentElement[]): DocumentElement[] {
    return elements.flatMap((element): DocumentElement[] => {
      if (element.type === "header" || element.type === "column") return flatten(element.children);
      if (element.type === "columns") return [...element.children].sort((a, b) => Number(b.id === element.primaryColumnId) - Number(a.id === element.primaryColumnId)).flatMap((column) => flatten(column.children));
      if ("children" in element) return [{ ...element, children: flatten(element.children) }];
      return [{ ...element, spans: element.spans.map((span) => ({ ...span })) }];
    });
  }
  return { ...cv, children: flatten(cv.children) };
}

// Deterministic migration preserves existing text, IDs, proposals and formatting.
// Legacy fixed headings become editable nodes; no new experience is invented.
function migrateLegacy(value: Record<string, unknown>): unknown {
  const cv = value.cv;
  if (!record(cv) || !nonempty(cv.id) || typeof cv.name !== "string" || !record(cv.section) ||
    !nonempty(cv.section.id) || typeof cv.section.title !== "string" || !record(cv.section.entry) ||
    !nonempty(cv.section.entry.id) || typeof cv.section.entry.title !== "string" ||
    !Array.isArray(cv.section.entry.blocks) || !cv.section.entry.blocks.every(isBlock)) throw new Error("Invalid legacy draft.");
  const entry = cv.section.entry;
  const blocks = entry.blocks as Block[];
  const used = new Set([cv.id, cv.section.id, entry.id as string, ...blocks.map((block) => block.id)]);
  if (used.size !== blocks.length + 3) throw new Error("The saved draft contains duplicate IDs.");
  function id(base: string) { let result = base; while (used.has(result)) result += "-new"; used.add(result); return result; }
  const children: DocumentElement[] = [];
  let list: Group | null = null;
  for (const block of blocks) {
    if (block.type === "bullet") {
      if (!list) { list = { id: id(`${entry.id}-list`), type: "list", children: [] }; children.push(list); }
      list.children.push(block);
    } else { list = null; children.push(block); }
  }
  return {
    ...value, schemaVersion: 2,
    cv: { id: cv.id, children: [
      { id: id(`${cv.id}-name`), type: "heading", level: 1, spans: plain(cv.name) },
      { id: id(`${cv.id}-role`), type: "paragraph", spans: plain("Frontend Engineer") },
      { id: cv.section.id, type: "section", children: [
        { id: id(`${cv.section.id}-heading`), type: "heading", level: 2, spans: plain(cv.section.title) },
        { id: entry.id, type: "entry", children: [
          { id: id(`${entry.id}-heading`), type: "heading", level: 3, spans: plain(entry.title as string) }, ...children,
        ] },
      ] },
    ] },
  };
}
export function parseDraft(input: unknown): Draft {
  const value = record(input) && input.schemaVersion === 1 ? migrateLegacy(input) : input;
  if (!record(value) || value.schemaVersion !== 2 || !record(value.cv) || !nonempty(value.cv.id) ||
    (value.cv.appearance !== undefined && !isDocumentAppearance(value.cv.appearance)) || !validElements(value.cv.children, "document") || !isProposal(value.proposal)) {
    throw new Error("The saved draft has an unsupported or invalid format.");
  }
  const ids = [value.cv.id, ...allElements(value.cv.children).map((element) => element.id)];
  if (new Set(ids).size !== ids.length) throw new Error("The saved draft contains duplicate IDs.");
  return value as Draft;
}
