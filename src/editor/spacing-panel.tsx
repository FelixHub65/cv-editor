"use client";
import { useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HISTORY_MERGE_TAG, HISTORY_PUSH_TAG } from "lexical";
import { NumberField } from "@/ui/property-fields";
import { useLiveEditorState } from "./use-live-editor-state";
import { $selectedElements } from "./element-selection";
import { $setSpace, $spacingControls, readSpaceValue, type SpaceControl } from "./spacing";
import { useSpacingPreview } from "./spacing-context";

function SpaceField({ control }: { control: SpaceControl }) {
  const [editor] = useLexicalComposerContext();
  useLiveEditorState();
  const value = readSpaceValue(editor, control);
  const started = useRef(false);
  const { setPreview } = useSpacingPreview();
  function change(next: number) {
    editor.update(() => $setSpace(control, next), { tag: started.current ? HISTORY_MERGE_TAG : HISTORY_PUSH_TAG });
    started.current = true;
  }
  return <div className={`space-field ${control.kind === "padding" ? "padding" : "gap"}`}
    onMouseEnter={() => setPreview(control)} onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setPreview(null); }}
    onFocus={() => setPreview(control)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { started.current = false; setPreview(null); } }}>
    <NumberField label={control.label} value={value} placeholder="Mixed" min={0} max={80} updateOnChange onCommit={() => { started.current = false; }} onChange={change} />
    <input type="range" aria-label={`${control.label} slider`} aria-valuetext={value === null ? "Mixed" : String(value)} min={0} max={80} value={value ?? 0}
      onPointerDown={() => { started.current = false; }} onPointerUp={() => { started.current = false; }} onPointerCancel={() => { started.current = false; }}
      onKeyUp={() => { started.current = false; }} onChange={(event) => change(Number(event.target.value))} />
  </div>;
}
export default function SpacingPanel() {
  const state = useLiveEditorState();
  const controls = state?.read($spacingControls) ?? [];
  const nodes = state?.read(() => $selectedElements().map((node) => node.getKey())) ?? [];
  if (!nodes.length) return null;
  return <section className="property-section spacing-properties"><h3>{nodes.length > 1 ? `${nodes.length} elements · Spacing` : "Spacing"}</h3>
    {!controls.length && <p className="hint">Select adjacent elements in the same container to adjust their gaps together.</p>}
    {controls.map((control) => <SpaceField key={`${nodes.join(",")}-${control.id}`} control={control} />)}
  </section>;
}
