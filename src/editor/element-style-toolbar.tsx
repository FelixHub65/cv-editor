"use client";

import { useRef, useState } from "react";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND, $isListNode } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $getState, $isRangeSelection, $setSelection, FORMAT_TEXT_COMMAND, HISTORY_PUSH_TAG, type RangeSelection } from "lexical";
import { $getSelectionStyleValueForProperty, $patchStyleText } from "@lexical/selection";
import { $isHeadingNode } from "@lexical/rich-text";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { AlignLeft, Baseline, Bold, Italic, Underline, Strikethrough, Link, List, ListOrdered, Type } from "lucide-react";
import { FONT_FAMILIES, safeLink } from "@/domain/cv";
import { IconButton } from "@/ui/primitives";
import { useLiveEditorState } from "./use-live-editor-state";
import { appearanceState } from "./nodes";
import { $selectedBlocks, $setBlockAppearance, $setTextStyle } from "./formatting";
import { $activeElementId } from "./active-element-focus";
import { $elementNodes } from "./adapter";
import { blockIdState } from "./nodes";
import { ElementTypeIcon, elementTypeLabels, isElementType } from "@/ui/element-type-icon";

export default function ElementStyleToolbar({ documentSelected }: { documentSelected: boolean }) {
  const [editor] = useLexicalComposerContext();
  const state = useLiveEditorState();
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const savedSelection = useRef<RangeSelection | null>(null);
  const elementType = documentSelected ? "document" : state?.read(() => {
    const id = $activeElementId();
    const type = $elementNodes().find((node) => $getState(node, blockIdState) === id)?.getType();
    return type && isElementType(type) ? type : null;
  });
  const context = documentSelected ? null : state?.read(() => {
    const selection = $getSelection();
    const blocks = $selectedBlocks();
    if (!$isRangeSelection(selection) || !blocks.length) return null;
    const block = blocks[0];
    const parent = block.getParent();
    let link = selection.anchor.getNode();
    while (!$isLinkNode(link) && link.getParent() && link.isInline()) link = link.getParent()!;
    const styles = blocks.map((node) => $isHeadingNode(node) ? node.getTag() : $getState(node, appearanceState).textStyle ?? "body");
    return {
      formats: ["bold", "italic", "underline", "strikethrough"].map((format) => selection.hasFormat(format as "bold")),
      style: styles.every((style) => style === styles[0]) ? styles[0] : "",
      font: $getSelectionStyleValueForProperty(selection, "font-family", ""),
      size: $getSelectionStyleValueForProperty(selection, "font-size", "").replace("px", ""),
      color: $getSelectionStyleValueForProperty(selection, "color", "#202a31"),
      alignment: blocks.every((node) => node.getFormatType() === block.getFormatType()) ? block.getFormatType() || "left" : "",
      lineHeight: String($getState(block, appearanceState).lineHeight ?? ""),
      list: $isListNode(parent) ? parent.getListType() : null,
      link: $isLinkNode(link) ? link.getURL() : "",
    };
  });
  function update(action: () => void) { editor.update(action, { tag: HISTORY_PUSH_TAG }); }
  function inline(property: string, value: string | null) {
    update(() => { const selection = $getSelection(); if ($isRangeSelection(selection)) $patchStyleText(selection, { [property]: value }); });
  }
  function applyLink(remove = false) {
    if (!remove && !safeLink(url.trim())) { setError("Use an https://, http://, mailto: or tel: address."); return; }
    update(() => { if (savedSelection.current) $setSelection(savedSelection.current.clone()); editor.dispatchCommand(TOGGLE_LINK_COMMAND, remove ? null : url.trim()); });
    setLinkOpen(false);
    editor.focus();
  }
  const formatShortcuts = ["⌘B", "⌘I", "⌘U", "⇧⌘X"] as const;
  const formatAriaShortcuts = ["Meta+b Control+b", "Meta+i Control+i", "Meta+u Control+u", "Meta+Shift+x Control+Shift+x"] as const;
  return <div className="formatting-bar">
    <div className="element-style-toolbar" role="toolbar" aria-label="Text formatting">
      <span className="element-style-type" title={elementType ? elementTypeLabels[elementType] : "Text formatting"}>{elementType ? <ElementTypeIcon type={elementType} size={16} /> : <Type size={16} />}<span>{elementType ? elementTypeLabels[elementType] : "Text"}</span></span>
      <span className="toolbar-divider" />
      <select aria-label="Text style" disabled={!context || !!context.list} value={context?.style ?? "body"} onChange={(event) => update(() => $setTextStyle(event.target.value))}>
        <option value="">Mixed styles</option><option value="body">Body</option><option value="h1">Title</option><option value="subtitle">Subtitle</option><option value="h2">Heading 1</option><option value="h3">Heading 2</option><option value="caption">Caption</option>
      </select>
      <select aria-label="Font" disabled={!context} value={context?.font ?? ""} onChange={(event) => inline("font-family", event.target.value || null)}><option value="">Document font</option>{FONT_FAMILIES.map((font) => <option key={font}>{font}</option>)}</select>
      <select aria-label="Font size" disabled={!context} value={context?.size ?? ""} onChange={(event) => inline("font-size", event.target.value ? event.target.value + "px" : null)}><option value="">Auto</option>{[8, 10, 12, 14, 15, 16, 18, 20, 24, 28, 32, 36, 48, 72].map((size) => <option key={size}>{size}</option>)}</select>
      <span className="toolbar-divider" />
      {([['bold', Bold], ['italic', Italic], ['underline', Underline], ['strikethrough', Strikethrough]] as const).map(([format, Icon], i) => <IconButton key={format} label={format[0].toUpperCase() + format.slice(1)} shortcut={formatShortcuts[i]} aria-keyshortcuts={formatAriaShortcuts[i]} disabled={!context} aria-pressed={context?.formats[i] ?? false} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)}><Icon size={16} /></IconButton>)}
      <label className="font-color" title="Font color"><Baseline size={16} aria-hidden="true" /><input aria-label="Font color" type="color" value={context?.color || "#202a31"} disabled={!context} onChange={(event) => inline("color", event.target.value)} /></label>
      <IconButton label="Link" disabled={!context} aria-pressed={!!context?.link} onMouseDown={(event) => event.preventDefault()} onClick={() => { editor.getEditorState().read(() => { const selection = $getSelection(); savedSelection.current = $isRangeSelection(selection) ? selection.clone() : null; }); setUrl(context?.link ?? ""); setError(""); setLinkOpen(!linkOpen); }}><Link size={16} /></IconButton>
      <span className="toolbar-divider" />
      <label className="icon-select" title="Alignment"><AlignLeft size={16} /><select aria-label="Alignment" disabled={!context} value={context?.alignment ?? "left"} onChange={(event) => update(() => $setBlockAppearance({ alignment: event.target.value as "left" }))}><option value="">Mixed</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></label>
      <label className="icon-select" title="Line spacing"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3v18M2 6l3-3 3 3M2 18l3 3 3-3M12 4h10M12 12h10M12 20h10" /></svg><select aria-label="Line spacing" disabled={!context} value={context?.lineHeight ?? ""} onChange={(event) => update(() => $setBlockAppearance({ lineHeight: event.target.value ? Number(event.target.value) : undefined }))}><option value="">Default</option>{[1, 1.15, 1.5, 1.7, 2].map((value) => <option key={value}>{value}</option>)}</select></label>
      <IconButton label={context?.list === "bullet" ? "Make text" : "Make bullet"} disabled={!context} aria-pressed={context?.list === "bullet"} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(context?.list === "bullet" ? REMOVE_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND, undefined)}><List size={16} /></IconButton>
      <IconButton label="Numbered list" disabled={!context} aria-pressed={context?.list === "number"} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(context?.list === "number" ? REMOVE_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined)}><ListOrdered size={16} /></IconButton>
    </div>
    {linkOpen && <form className="link-popover" aria-label="Edit link" onSubmit={(event) => { event.preventDefault(); applyLink(); }} onKeyDown={(event) => { if (event.key === "Escape") { setLinkOpen(false); editor.focus(); } }}>
      <label htmlFor="link-url">Link address</label><input id="link-url" autoFocus value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" />
      {error && <p role="alert">{error}</p>}<div className="actions"><button type="submit">Apply link</button><button type="button" onClick={() => applyLink(true)}>Remove link</button><button type="button" onClick={() => { setLinkOpen(false); editor.focus(); }}>Cancel</button></div>
    </form>}
  </div>;
}
