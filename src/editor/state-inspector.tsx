"use client";

import { useState } from "react";
import { useLiveEditorState } from "./use-live-editor-state";
import { $getRoot, $getSelection, $getState, $isElementNode, $isRangeSelection, type LexicalNode } from "lexical";
import { blockIdState } from "./nodes";

function LiveState() {
  const state = useLiveEditorState();
  if (!state) return null;
  const snapshot = state.read(() => {
    const lines: string[] = [];
    const ids: { id: string; key: string; type: string; text: string }[] = [];
    function visit(node: LexicalNode, depth: number) {
      const id = $getState(node, blockIdState);
      if (id) ids.push({ id, key: node.getKey(), type: node.getType(), text: node.getTextContent() });
      const text = $isElementNode(node) ? "" : ` ${JSON.stringify(node.getTextContent())}`;
      lines.push(`${"  ".repeat(depth)}${node.getType()} · key=${node.getKey()}${id ? ` · id=${id}` : ""}${text}`);
      if ($isElementNode(node)) node.getChildren().forEach((child) => visit(child, depth + 1));
    }
    visit($getRoot(), 0);
    const selection = $getSelection();
    return {
      tree: lines.join("\n"),
      ids,
      selection: selection === null ? null : $isRangeSelection(selection) ? {
        type: "range", collapsed: selection.isCollapsed(),
        anchor: { key: selection.anchor.key, offset: selection.anchor.offset, type: selection.anchor.type },
        focus: { key: selection.focus.key, offset: selection.focus.offset, type: selection.focus.type },
        bold: selection.hasFormat("bold"), italic: selection.hasFormat("italic"),
      } : { type: "node", keys: selection.getNodes().map((node) => node.getKey()) },
    };
  });
  return <>
    <p className="hint">Read-only live state. Keys are Lexical runtime identities; IDs belong to saved document elements. Selection is shown separately because it is not included in serialized document JSON.</p>
    <div className="inspector-grid">
      <section><h3>Node tree</h3><pre aria-label="Lexical node tree">{snapshot.tree}</pre></section>
      <section><h3>Selection</h3><pre aria-label="Lexical selection">{JSON.stringify(snapshot.selection, null, 2)}</pre></section>
    </div>
    <section aria-label="Persistent document IDs">
      <h3>Persistent document IDs ({snapshot.ids.length})</h3>
      <p className="hint">Live IDs attached to Lexical nodes, in document order. Includes the document, sections, entries, lists, headings, and text blocks.</p>
      {snapshot.ids.length === 0 ? <p className="hint">No persistent IDs in the current editor state.</p> : <div className="inspector-id-table">
        <table>
          <caption className="sr-only">Persistent IDs mapped to current Lexical nodes</caption>
          <thead><tr><th scope="col">Persistent ID</th><th scope="col">Node type</th><th scope="col">Runtime key</th><th scope="col">Content</th></tr></thead>
          <tbody>{snapshot.ids.map((node) => <tr key={node.key}>
            <td><code>{node.id}</code></td><td><code>{node.type}</code></td><td><code>{node.key}</code></td><td>{node.text || "(Empty element)"}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
    <details><summary>Serialized editor state (including proposal metadata)</summary><pre aria-label="Lexical JSON">{JSON.stringify(state.toJSON(), null, 2)}</pre></details>
  </>;
}

export default function StateInspector() {
  const [open, setOpen] = useState(false);
  return <section className="state-inspector" aria-label="Lexical state inspector">
    <button className="inspector-toggle" aria-expanded={open} aria-controls="lexical-state-content" onClick={() => setOpen(!open)}>
      {open ? "▾" : "▸"} Lexical state <span>Development only</span>
    </button>
    {open && <div id="lexical-state-content"><LiveState /></div>}
  </section>;
}
