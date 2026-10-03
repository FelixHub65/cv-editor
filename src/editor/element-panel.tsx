"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $getState, $setState, $getSelection, $isRangeSelection, HISTORY_PUSH_TAG } from "lexical";
import { $patchStyleText } from "@lexical/selection";
import { useLiveEditorState } from "./use-live-editor-state";
import { $activeElementId } from "./active-element-focus";
import {
  $elementNodes, $applySidebarPreset, $setColumnsAppearance, $setDocumentLayout, $setDocumentHeader, $swapColumns, $primaryColumn, $setRegionAppearance, $setSectionColumns,
  documentAppearanceState,
} from "./adapter";
import {
  dividerAppearanceState, CvDividerNode, layoutState, appearanceState, blockIdState, columnsAppearanceState, regionAppearanceState,
  CvColumnNode, CvColumnsNode, CvHeaderNode, CvSectionNode,
} from "./nodes";
import { $setBlockAppearance } from "./formatting";
import { FONT_FAMILIES, type DividerAppearance, type ColumnsAppearance, type DocumentAppearance, type RegionAppearance } from "@/domain/cv";
import { ElementTypeIcon, elementTypeLabels, isElementType } from "@/ui/element-type-icon";

import SpacingPanel from "./spacing-panel";
import { $selectedElements } from "./element-selection";
import { ColorPicker } from "@/ui/color-picker";
import { NumberField, SelectField } from "@/ui/property-fields";

function contrastRatio(background: string, foreground: string) {
  function luminance(color: string) {
    const channels = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16) / 255)
      .map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  }
  const first = luminance(background);
  const second = luminance(foreground);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

export default function ElementPanel({ clean, onCleanChange, scope, onScopeChange }: {
  clean: boolean; onCleanChange: (value: boolean) => void; scope: "selection" | "document"; onScopeChange: (value: "selection" | "document") => void;
}) {
  const [editor] = useLexicalComposerContext();
  const state = useLiveEditorState();
  const snapshot = state?.read(() => {
    const id = $activeElementId();
    const node = $elementNodes().find((candidate) => $getState(candidate, blockIdState) === id);
    const type = node?.getType();
    const documentColumns = $getRoot().getChildren().find((child) => child instanceof CvColumnsNode);
    return {
      document: $getState($getRoot(), documentAppearanceState),
      mode: documentColumns ? $getState(documentColumns, layoutState).mode ?? "inset" : "single",
      header: $getRoot().getChildren().some((child) => child instanceof CvHeaderNode),
      selected: node && type && isElementType(type) ? {
        type,
        id,
        dividerAppearance: node instanceof CvDividerNode ? $getState(node, dividerAppearanceState) : null,
        layout: $getState(node, layoutState),
        columnOptions: node instanceof CvColumnsNode ? node.getChildren().map((child, index) => ({ id: $getState(child, blockIdState), label: $getState(child, layoutState).label || `Column ${index + 1}` })) : [],
        primaryId: node instanceof CvColumnsNode ? $getState($primaryColumn(node), blockIdState) : "",

        text: node.getTextContent().trim(),
        blockAppearance: $getState(node, appearanceState),
        regionAppearance: node instanceof CvHeaderNode || node instanceof CvColumnNode ? $getState(node, regionAppearanceState) : null,
        columnsAppearance: node instanceof CvColumnsNode ? $getState(node, columnsAppearanceState) : null,
        sectionColumns: node instanceof CvSectionNode && !(node.getParent() instanceof CvColumnNode) ? node.getChildren().some((child) => child instanceof CvColumnsNode) : null,
      } : null,
      selectionCount: $selectedElements().length,
      text: $isRangeSelection($getSelection()),
    };
  });
  const selected = snapshot?.selected;
  const doc = snapshot?.document ?? {};

  function documentChange(patch: Partial<DocumentAppearance>) {
    editor.update(() => $setState($getRoot(), documentAppearanceState, { ...$getState($getRoot(), documentAppearanceState), ...patch }), { tag: HISTORY_PUSH_TAG });
  }
  function selectedChange(action: (node: ReturnType<typeof $elementNodes>[number]) => void) {
    editor.update(() => {
      const id = $activeElementId();
      const node = $elementNodes().find((candidate) => $getState(candidate, blockIdState) === id);
      if (node) action(node);
    }, { tag: HISTORY_PUSH_TAG });
  }
  function columnsChange(patch: Partial<ColumnsAppearance>) {
    selectedChange((node) => { if (node instanceof CvColumnsNode) $setColumnsAppearance(node, patch); });
  }
  function regionChange(patch: Partial<RegionAppearance>) {
    selectedChange((node) => { if (node instanceof CvHeaderNode || node instanceof CvColumnNode) $setRegionAppearance(node, patch); });
  }

  function dividerChange(patch: Partial<DividerAppearance>) {
    selectedChange((node) => { if (node instanceof CvDividerNode) $setState(node, dividerAppearanceState, { ...$getState(node, dividerAppearanceState), ...patch }); });
  }
  const divider = selected?.dividerAppearance;
  const region = selected?.regionAppearance;
  const columns = selected?.columnsAppearance;
  const contrast = region ? contrastRatio(region.background ?? "#ffffff", region.color ?? "#202a31") : null;

  return <div className="element-panel">
    <div className="property-scope" role="group" aria-label="Properties scope">
      <button aria-pressed={scope === "selection"} onClick={() => onScopeChange("selection")}>Selection</button>
      <button aria-pressed={scope === "document"} onClick={() => onScopeChange("document")}>Document</button>
    </div>
    <div className="sidebar-intro"><h2 className="element-panel-heading">{scope === "document" ? "Document properties" : selected ? <><ElementTypeIcon type={selected.type} size={18} />{elementTypeLabels[selected.type]}</> : "Selection properties"}</h2><p>{scope === "document" ? "Defaults and layout for the whole CV." : "Settings for your current selection."}</p></div>
    {scope === "document" ? <>
      <section className="property-section"><h3>Typography</h3>
        <label className="property-control">Default font<select aria-label="Default font" value={doc.font ?? ""} onChange={(event) => documentChange({ font: event.target.value as DocumentAppearance["font"] || undefined })}><option value="">Template font</option>{FONT_FAMILIES.map((font) => <option key={font}>{font}</option>)}</select></label>
        <label className="property-control">Base font size<select aria-label="Base font size" value={doc.size ?? 15} onChange={(event) => documentChange({ size: Number(event.target.value) })}>{[10, 12, 14, 15, 16, 18, 20].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        <label className="property-control">Default line spacing<select aria-label="Default line spacing" value={doc.lineHeight ?? 1.7} onChange={(event) => documentChange({ lineHeight: Number(event.target.value) })}>{[1, 1.15, 1.5, 1.7, 2].map((height) => <option key={height}>{height}</option>)}</select></label>
      </section>
      <section className="property-section"><h3>Page & spacing</h3>
        <p className="hint">A4 · Portrait</p>
        <NumberField label="Page margins" value={doc.margin ?? 64} min={16} max={100} disabled={snapshot?.mode === "page"} onChange={(margin) => documentChange({ margin })} />
        <NumberField label="Section spacing" value={doc.sectionSpacing ?? 30} min={0} max={80} onChange={(sectionSpacing) => documentChange({ sectionSpacing })} />
      </section>
      <section className="property-section"><h3>Layout</h3>
        <label className="property-control">Layout<select aria-label="Document columns" value={snapshot?.mode ?? "single"} onChange={(event) => editor.update(() => $setDocumentLayout(event.target.value as "single" | "inset" | "page"), { tag: HISTORY_PUSH_TAG })}><option value="single">Single column</option><option value="inset">Within margins</option><option value="page">Full-height columns</option></select></label>
        <div className="layout-presets" role="group" aria-label="Sidebar presets">{(["left", "right"] as const).map((side) => <button key={side} onClick={() => editor.update(() => $applySidebarPreset(side), { tag: HISTORY_PUSH_TAG })}><span className={`layout-preset-icon sidebar-${side}`} aria-hidden="true" />Sidebar {side}</button>)}</div>
        <p className="hint">Presets apply widths and region styles while preserving your content and any Header.</p>
        <label className="property-checkbox"><input type="checkbox" aria-label="Full-width Header" checked={snapshot?.header ?? false} onChange={(event) => editor.update(() => $setDocumentHeader(event.target.checked), { tag: HISTORY_PUSH_TAG })} /> Full-width Header</label>
        <p className="hint">{snapshot?.mode === "page" ? "Column padding replaces page margins. Backgrounds reach the page edges. An optional Header sits above the columns." : "New columns keep your content together. Move items using the outline."}</p>
        <p className="hint">Removing a Header moves its content to the primary column. Single-column conversion places primary content first. Undo restores the layout.</p>
        <button onClick={() => editor.update(() => $setState($getRoot(), documentAppearanceState, {}), { tag: HISTORY_PUSH_TAG })}>Reset document defaults</button>
      </section>
    </> : !selected && !snapshot?.text && !snapshot?.selectionCount ? <div className="panel-empty"><p>Select an element on the page or in the outline.</p></div> : <>
      <SpacingPanel />
      {selected && !divider && <section className="property-section"><h3>Content</h3><p className="property-preview">{selected.text || "Empty element"}</p></section>}
      {selected?.sectionColumns !== null && selected?.sectionColumns !== undefined && <section className="property-section"><h3>Layout</h3>
        <label className="property-control">Section columns<select aria-label="Section columns" value={selected.sectionColumns ? "2" : "1"} onChange={(event) => selectedChange((node) => { if (node instanceof CvSectionNode) $setSectionColumns(node, event.target.value === "2"); })}><option value="1">Single column</option><option value="2">Two columns</option></select></label>
        <p className="hint">The section heading stays full width.</p>
      </section>}
      {divider && <section className="property-section" key={selected?.id}><h3>Line style</h3>
        <ColorPicker value={divider.color ?? "#c5cfd3"} onChange={(color) => dividerChange({ color })} opacity={divider.opacity ?? 100} onOpacityChange={(opacity) => dividerChange({ opacity })} />
        <div className="inspector-field-row">
          <NumberField updateOnChange label="Thickness" value={divider.thickness ?? 1} min={1} max={200} onChange={(thickness) => dividerChange({ thickness })} />
          <SelectField label="Ends" value={divider.ends ?? "square"} options={[{ value: "square", label: "Square" }, { value: "rounded", label: "Rounded" }]} onChange={(ends) => dividerChange({ ends })} />
        </div>
      </section>}
      {columns && <section className="property-section"><h3>Column layout</h3>
        <label className="property-control">Primary content<select aria-label="Primary content" value={selected?.primaryId} onChange={(event) => selectedChange((node) => $setState(node, layoutState, { ...$getState(node, layoutState), primaryColumnId: event.target.value }))}>{selected?.columnOptions.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select></label>
        <button onClick={() => selectedChange((node) => { if (node instanceof CvColumnsNode) $swapColumns(node); })}>Swap column positions</button>
        <p className="hint">Primary content comes first in the ATS projection, regardless of its position.</p>
        <label className="property-range"><span>Column width <strong>{columns.ratio ?? 50} / {100 - (columns.ratio ?? 50)}</strong></span><input aria-label="Column width" type="range" min="30" max="70" value={columns.ratio ?? 50} onChange={(event) => columnsChange({ ratio: Number(event.target.value) })} /></label>
        <NumberField label="Left column percentage" value={columns.ratio ?? 50} min={30} max={70} onChange={(ratio) => columnsChange({ ratio })} />
        <label className="property-control">Divider<select aria-label="Column divider" value={columns.dividerWidth ?? 1} onChange={(event) => columnsChange({ dividerWidth: Number(event.target.value) })}><option value="0">None</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
        <label className="property-control">Divider color<input aria-label="Divider color" type="color" value={columns.dividerColor ?? "#c5cfd3"} disabled={(columns.dividerWidth ?? 1) === 0} onChange={(event) => columnsChange({ dividerColor: event.target.value })} /></label>
        <p className="hint">Drag the arrow above the divider or use its arrow keys.</p>
      </section>}
      {region && <section className="property-section"><h3>{selected?.type === "cv-header" ? "Header style" : "Column style"}</h3>
        <label className="property-control">Background<input aria-label="Region background color" type="color" value={region.background ?? "#ffffff"} onChange={(event) => regionChange({ background: event.target.value })} /></label>
        <label className="property-control">Default text<input aria-label="Region text color" type="color" value={region.color ?? "#202a31"} onChange={(event) => regionChange({ color: event.target.value })} /></label>
        {selected?.type === "cv-column" && <label className="property-control">Label<input aria-label="Column label" maxLength={60} value={selected.layout.label ?? ""} placeholder="Column" onChange={(event) => selectedChange((node) => $setState(node, layoutState, { ...$getState(node, layoutState), label: event.target.value }))} /></label>}
        <p className="hint">Padding moves content inside the background.</p>
        {contrast !== null && contrast < 4.5 && <p className="property-warning" role="status">Low text contrast ({contrast.toFixed(1)}:1). Aim for at least 4.5:1.</p>}
        <button onClick={() => selectedChange((node) => { if (node instanceof CvHeaderNode || node instanceof CvColumnNode) $setState(node, regionAppearanceState, {}); })}>Reset region style</button>
        <p className="hint">Local text color takes precedence over this default.</p>
      </section>}
      {snapshot?.text ? <section className="property-section"><h3>Text settings</h3>
        <button onMouseDown={(event) => event.preventDefault()} onClick={() => editor.update(() => { const selection = $getSelection(); if ($isRangeSelection(selection)) $patchStyleText(selection, { "font-family": null, "font-size": null, color: null }); $setBlockAppearance({ lineHeight: undefined, spaceAfter: undefined }); }, { tag: HISTORY_PUSH_TAG })}>Reset to inherited style</button>
        <p className="hint">Use the top toolbar for text styles, formatting, links and alignment.</p>
      </section> : !divider && !columns && !region && selected?.sectionColumns === null && <section className="property-section"><p className="hint">Select text inside this group to format it.</p></section>}
    </>}
    <section className="property-section"><h3>View</h3><label className="property-checkbox"><input aria-label="Clean view" type="checkbox" checked={clean} onChange={(event) => onCleanChange(event.target.checked)} /> Hide suggestion highlights</label></section>
  </div>;
}
