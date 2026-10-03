"use client";

import Link from "next/link";
import { ArrowLeft, CircleAlert, CloudCheck, LoaderCircle, Maximize2, Minus, PanelLeft, PanelRight, Plus, Redo2, Undo2 } from "lucide-react";
import ActiveElementFocus from "./active-element-focus";
import { $selectedElements } from "./element-selection";
import ElementStyleToolbar from "./element-style-toolbar";
import { SpacingProvider } from "./spacing-context";
import SpacingOverlay from "./spacing-overlay";
import ElementPanel from "./element-panel";
import OutlinePanel, { type OutlineDropPreview } from "./outline-panel";
import SidebarResizer from "./sidebar-resizer";
import ColumnResizeHandles from "./column-resize-handles";
import OutlineDropIndicator from "./outline-drop-indicator";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { createWorkspace, saveWorkspace } from "@/app/actions";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { createEmptyHistoryState, registerHistory } from "@lexical/history";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from "@lexical/list";
import { $removeSelectedList } from "./formatting";
import {
  $addUpdateTag, $getRoot, $getSelection, $getState, $isRangeSelection, $setState, $setSelection,
  CAN_REDO_COMMAND, CAN_UNDO_COMMAND, COMMAND_PRIORITY_HIGH, DROP_COMMAND, FORMAT_TEXT_COMMAND,
  HISTORY_PUSH_TAG, INDENT_CONTENT_COMMAND, KEY_DOWN_COMMAND, mergeRegister, PASTE_COMMAND, PASTE_TAG, REDO_COMMAND, UNDO_COMMAND,
} from "lexical";
import { type Draft, documentName, textBlocks, needsReview, plain, textOf, safeLink } from "@/domain/cv";
import { createFixture } from "@/domain/fixture";
import { browserRepository, LEGACY_STORAGE_KEY, STORAGE_KEY } from "@/persistence/drafts";
import type { PersistedWorkspace, WorkspaceState } from "@/persistence/workspace-store";
import { IconButton, Tabs } from "@/ui/primitives";
import { ElementTypeIcon } from "@/ui/element-type-icon";
import { DocumentSparklesIcon } from "@/ui/icons";
import { registerDividers, $addDivider, registerRegionBoundaries, $insertBulletList, $addSection, $addEntry, $loadDraft, $readDraft, $review, editorNodes, proposalState, registerBlockIds } from "./adapter";

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2];

type EditorWorkspaceProps = {
  initial: PersistedWorkspace | null;
  contextLabel?: string;
  backHref?: string;
  documentKind?: "master" | "application";
};

export default function EditorWorkspace({ initial, contextLabel, backHref, documentKind = "application" }: EditorWorkspaceProps) {
  const [loaded, setLoaded] = useState<PersistedWorkspace | null>(initial);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    if (initial) return;
    let active = true;
    async function load() {
      try {
        const stored = browserRepository(window.localStorage).load();
        const fixture = createFixture();
        const workspace = stored ?? { schemaVersion: 2 as const, master: structuredClone(fixture), draft: fixture, versions: [] };
        const created = await createWorkspace(workspace);
        if (active) {
          window.localStorage.removeItem(STORAGE_KEY);
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
          setLoaded(created);
        }
      } catch {
        if (active) setLoadError("We couldn't create your database draft. Any existing browser draft is still available and has not been removed.");
      }
    }
    void load();
    return () => { active = false; };
  }, [initial]);
  if (loadError) return <main className="loading"><h1>Draft unavailable</h1><p role="alert">{loadError}</p><button onClick={() => location.reload()}>Try again</button></main>;
  if (!loaded) return <main className="loading" role="status">Loading your draft…</main>;
  return <LexicalComposer initialConfig={{
    namespace: "cv-editor-proof", nodes: editorNodes,
    theme: { text: { bold: "text-bold", italic: "text-italic", underline: "text-underline", strikethrough: "text-strikethrough", underlineStrikethrough: "text-underline-strikethrough" } },
    editorState: () => $loadDraft(loaded.state.draft),
    onError: (error) => { throw error; },
  }}><WorkspaceContent initial={loaded} contextLabel={contextLabel} backHref={backHref} documentKind={documentKind} /></LexicalComposer>;
}

function WorkspaceContent({ initial, contextLabel, backHref, documentKind }: { initial: PersistedWorkspace; contextLabel?: string; backHref?: string; documentKind: "master" | "application" }) {
  const [editor] = useLexicalComposerContext();
  const [draft, setDraft] = useState(initial.state.draft);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | "conflict">("saved");
  const [saveError, setSaveError] = useState("");
  const [hasConflict, setHasConflict] = useState(false);
  const [clean, setClean] = useState(false);
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(320);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<"outline" | "chat">("outline");
  const [rightTab, setRightTab] = useState<"element" | "suggestions">("suggestions");
  const [propertyScope, setPropertyScope] = useState<"selection" | "document">("document");
  const [outlineDropPreview, setOutlineDropPreview] = useState<OutlineDropPreview | null>(null);
  const [zoom, setZoom] = useState(0.8);
  const [pageHeight, setPageHeight] = useState(A4_HEIGHT);
  const [editingProposal, setEditingProposal] = useState(false);
  const [wording, setWording] = useState("");
  const revision = useRef(initial.revision);
  const latestDraft = useRef(initial.state.draft);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true));
  const conflicted = useRef(false);
  const history = useRef(createEmptyHistoryState());
  const canvas = useRef<HTMLDivElement | null>(null);
  const paper = useRef<HTMLElement | null>(null);

  const stateWith = useCallback(function stateWith(next: Draft): WorkspaceState {
    return { schemaVersion: 2, master: initial.state.master, draft: next };
  }, [initial.state.master]);

  const persist = useCallback(async function persist(next: Draft) {
    if (conflicted.current) return false;
    try {
      const result = await saveWorkspace(initial.documentId, revision.current, stateWith(next));
      revision.current = result.revision;
      if (result.status === "conflict") {
        conflicted.current = true;
        setHasConflict(true);
        setSaveStatus("conflict");
        setSaveError("This document changed in another tab. Reload before editing further so newer changes are not overwritten.");
        return false;
      }
      setSaveStatus("saved");
      setSaveError("");
      return true;
    } catch {
      setSaveStatus("error");
      setSaveError("Couldn't save to the database. Your current edits remain open; retry before closing this page.");
      return false;
    }
  }, [initial.documentId, stateWith]);

  const enqueueSave = useCallback(function enqueueSave(next: Draft) {
    latestDraft.current = next;
    const queued = saveQueue.current.then(() => persist(next));
    saveQueue.current = queued.catch(() => false);
    return queued;
  }, [persist]);

  const scheduleSave = useCallback(function scheduleSave(next: Draft) {
    latestDraft.current = next;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void enqueueSave(latestDraft.current);
    }, 600);
  }, [enqueueSave]);

  useEffect(() => {
    history.current.current = { editor, editorState: editor.getEditorState() };
    // Compare later updates with Lexical's own projection. The domain object is
    // equivalent to the server payload but can have a different property order.
    latestDraft.current = editor.getEditorState().read(() => $readDraft());
    const unregister = mergeRegister(
      registerBlockIds(editor),
      editor.registerCommand(INSERT_UNORDERED_LIST_COMMAND, () => { $insertBulletList(); return true; }, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(INSERT_ORDERED_LIST_COMMAND, () => { $insertBulletList("number"); return true; }, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(REMOVE_LIST_COMMAND, () => { $removeSelectedList(); return true; }, COMMAND_PRIORITY_HIGH),
      editor.registerUpdateListener(({ editorState, prevEditorState }) => {
        const next = editorState.read(() => $selectedElements().map((node) => node.getKey()).join(","));
        const before = prevEditorState.read(() => $selectedElements().map((node) => node.getKey()).join(","));
        if (next && next !== before) {
          setPropertyScope("selection");
          setLeftTab("outline");
          setLeftOpen(true);
          if (window.matchMedia("(max-width: 1050px)").matches) setRightOpen(false);
        }
      }),
      registerRegionBoundaries(editor),
      registerDividers(editor),
      registerHistory(editor, history.current, 750, Date.now, undefined, 100),
      editor.registerCommand(CAN_UNDO_COMMAND, (value) => { setCanUndo(value); return false; }, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(CAN_REDO_COMMAND, (value) => { setCanRedo(value); return false; }, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(FORMAT_TEXT_COMMAND, (format) => !["bold", "italic", "underline", "strikethrough"].includes(format), COMMAND_PRIORITY_HIGH),
      editor.registerCommand(KEY_DOWN_COMMAND, (event) => {
        if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.altKey || event.key.toLowerCase() !== "x") return false;
        event.preventDefault();
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
        return true;
      }, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(INDENT_CONTENT_COMMAND, () => true, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(DROP_COMMAND, (event) => { event.preventDefault(); return true; }, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(PASTE_COMMAND, (event) => {
        if (!event || !("clipboardData" in event)) return true;
        event.preventDefault();
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $addUpdateTag(PASTE_TAG);
          selection.setFormat(0);
          selection.setStyle("");
          selection.insertRawText(event.clipboardData?.getData("text/plain") ?? "");
        }
        return true;
      }, COMMAND_PRIORITY_HIGH),
      editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
        if (!dirtyElements.size && !dirtyLeaves.size) return;
        const next = editorState.read(() => $readDraft());
        if (JSON.stringify(next) === JSON.stringify(latestDraft.current)) return;
        setDraft(next);
        scheduleSave(next);
      }),
    );
    return () => {
      unregister();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [editor, initial, scheduleSave]);

  useEffect(() => {
    const element = paper.current;
    if (!element) return;
    const updateHeight = () => setPageHeight(Math.max(A4_HEIGHT, element.scrollHeight));
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 1050px)");
    const adapt = (matches: boolean) => { if (matches) setLeftOpen(false); };
    adapt(narrow.matches);
    const listener = (event: MediaQueryListEvent) => adapt(event.matches);
    narrow.addEventListener("change", listener);
    return () => narrow.removeEventListener("change", listener);
  }, []);

  const proposal = draft.proposal;
  const stale = needsReview(textBlocks(draft.cv), proposal);
  const current = textBlocks(draft.cv).find((block) => block.id === proposal.targetId);
  const pending = proposal.status === "pending";
  const status = pending ? stale ? "Needs review" : "Pending" : proposal.status === "accepted" ? "Accepted" : "Rejected";

  function review(action: "accepted" | "rejected") {
    editor.update(() => { $review(action); }, { tag: HISTORY_PUSH_TAG });
    setEditingProposal(false);
  }
  function updateProposal(event: FormEvent) {
    event.preventDefault();
    if (!wording.trim()) return;
    editor.update(() => {
      const value = $getState($getRoot(), proposalState);
      if (value.status === "pending") $setState($getRoot(), proposalState, { ...value, replacement: plain(wording) });
    }, { tag: HISTORY_PUSH_TAG });
    setEditingProposal(false);
  }
  function changeZoom(direction: -1 | 1) {
    const index = ZOOM_STEPS.reduce((closest, value, candidate) => Math.abs(value - zoom) < Math.abs(ZOOM_STEPS[closest] - zoom) ? candidate : closest, 0);
    setZoom(ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, index + direction))]);
  }
  function fitPage() {
    const viewport = canvas.current;
    if (!viewport) return;
    const horizontal = (viewport.clientWidth - 80) / A4_WIDTH;
    const vertical = (viewport.clientHeight - 120) / A4_HEIGHT;
    setZoom(Math.max(0.5, Math.min(1, Math.min(horizontal, vertical))));
  }
  function toggleLeftSidebar() {
    const next = !leftOpen;
    if (next && window.matchMedia("(max-width: 1050px)").matches) setRightOpen(false);
    setLeftOpen(next);
  }
  function toggleRightSidebar() {
    const next = !rightOpen;
    if (next && window.matchMedia("(max-width: 1050px)").matches) setLeftOpen(false);
    setRightOpen(next);
  }
  const zoomFrameStyle = {
    width: `${Math.round(A4_WIDTH * zoom)}px`,
    height: `${Math.round(pageHeight * zoom)}px`,
  };
  const pageColumns = draft.cv.children.some((element) => element.type === "columns" && element.mode === "page");
  const appearance = draft.cv.appearance;
  const paperStyle = { transform: `scale(${zoom})`, fontFamily: appearance?.font,
    padding: pageColumns ? 0 : appearance?.margin,
    "--cv-font-size": `${appearance?.size ?? 15}px`,
    "--cv-line-height": appearance?.lineHeight ?? 1.7,
    "--cv-section-spacing": `${appearance?.sectionSpacing ?? 30}px`,
  } as CSSProperties;
  function showDocumentProperties() {
    editor.update(() => $setSelection(null));
    setPropertyScope("document");
    setRightTab("element");
    setRightOpen(true);
    if (window.matchMedia("(max-width: 1050px)").matches) setLeftOpen(false);
  }

  const saveStatusLabel = saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving…" : saveStatus === "conflict" ? "Reload required" : "Changes not saved";
  const SaveStatusIcon = saveStatus === "saved" ? CloudCheck : saveStatus === "saving" ? LoaderCircle : CircleAlert;

  return <SpacingProvider><main style={{ "--workspace-left-width": `min(${leftWidth}px, 50vw, calc(100vw - ${rightOpen ? `min(${rightWidth}px, 50vw)` : "44px"} - 240px))`, "--workspace-right-width": `min(${rightWidth}px, 50vw, calc(100vw - ${leftOpen ? `min(${leftWidth}px, 50vw)` : "44px"} - 240px))` } as CSSProperties} className={`workspace ${leftOpen ? "" : "left-collapsed"} ${rightOpen ? "" : "right-collapsed"}`}>
    <header className="workspace-topbar">
      <div className="workspace-title">
        {backHref && <Link className="back-link" href={backHref}><ArrowLeft size={15} aria-hidden="true" />Applications</Link>}
        <span className="document-title">{documentName(draft.cv)}</span>
        <span className="document-kind">{documentKind === "master" ? "Master CV" : "Application draft"}</span>
        {contextLabel && <span className="workspace-context">{contextLabel}</span>}
      </div>
      <div className="workspace-save">
        <div className="header-history" role="toolbar" aria-label="Document history">
          <IconButton label="Undo" shortcut="⌘Z" aria-keyshortcuts="Meta+z Control+z" disabled={!canUndo} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}><Undo2 size={16} aria-hidden="true" /></IconButton>
          <IconButton label="Redo" shortcut="⇧⌘Z" aria-keyshortcuts="Meta+Shift+z Control+Shift+z" disabled={!canRedo} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}><Redo2 size={16} aria-hidden="true" /></IconButton>
        </div>
        <div className={`autosave-status ${saveStatus}`} role="status" title={saveStatusLabel}>
          <SaveStatusIcon className={saveStatus === "saving" ? "spinning" : ""} size={16} aria-hidden="true" />
          <span>{saveStatusLabel}</span>
        </div>
      </div>
    </header>
    <ElementStyleToolbar key={propertyScope} documentSelected={propertyScope === "document"} />
    {saveError && <p className="workspace-error error" role="alert">{saveError} {!hasConflict && <button onClick={() => void enqueueSave(latestDraft.current)}>Retry save</button>}</p>}
    <div className="editor-shell">
      <aside className="workspace-sidebar left-sidebar" aria-label="Document navigation">
        {leftOpen && <SidebarResizer side="left" onResize={setLeftWidth} />}
        <IconButton label={leftOpen ? "Collapse left sidebar" : "Expand left sidebar"} className="sidebar-collapse" onClick={toggleLeftSidebar}><PanelLeft size={16} aria-hidden="true" /></IconButton>
        {leftOpen && <>
          <Tabs label="Left sidebar" value={leftTab} onChange={setLeftTab} options={[{ id: "outline", label: "Outline" }, { id: "chat", label: "Chat" }]} />
          <div className="sidebar-scroll" role="tabpanel">
            {leftTab === "outline" ? <OutlinePanel onDocument={showDocumentProperties} onDropPreview={setOutlineDropPreview} /> : <div className="chat-panel">
              <div className="sidebar-intro"><h2>Interview chat</h2><p>Discuss the role without covering the document.</p></div>
              <div className="chat-empty"><DocumentSparklesIcon className="chat-empty-icon" size={24} /><h3>Chat is ready for its AI connection</h3><p>The interview model and streaming transport will plug into this panel in a later vertical slice.</p></div>
              <div className="chat-composer"><label htmlFor="chat-draft">Message</label><textarea id="chat-draft" rows={3} placeholder="Interview chat is not connected yet" disabled /><button disabled>Send</button></div>
            </div>}
          </div>
        </>}
      </aside>

      <section className="editor-center" aria-label="CV document workspace">
        <div className="canvas-scroll" ref={canvas} onClick={(event) => { if (event.target === event.currentTarget || (event.target instanceof HTMLElement && event.target.classList.contains("canvas-stage"))) showDocumentProperties(); }}>
          <div className="canvas-stage">
            {!clean && pending && <p className={`document-status-chip ${stale ? "warning" : ""}`}>{status} · Suggestion highlighted</p>}
            <div className="zoom-frame" style={zoomFrameStyle}>
              <article ref={paper} className={`paper ${pageColumns ? "page-regions" : ""} ${!clean && pending && current ? "show-proposal" : ""}`} style={paperStyle}>
                <RichTextPlugin contentEditable={<ContentEditable className="cv-input" aria-label="CV content" onPointerDown={() => {
                  setPropertyScope("selection");
                  setLeftTab("outline");
                  setLeftOpen(true);
                  if (window.matchMedia("(max-width: 1050px)").matches) setRightOpen(false);
                }} />} ErrorBoundary={LexicalErrorBoundary} />
                <OutlineDropIndicator paperRef={paper} preview={outlineDropPreview} zoom={zoom} />
                <SpacingOverlay paperRef={paper} zoom={zoom} />
                <ColumnResizeHandles paperRef={paper} zoom={zoom} />
              </article>
            </div>
          </div>
        </div>
        <div className="zoom-controls" aria-label="Document zoom">
          <IconButton label="Zoom out" disabled={zoom <= ZOOM_STEPS[0]} onClick={() => changeZoom(-1)}><Minus size={16} aria-hidden="true" /></IconButton>
          <button className="zoom-value" aria-label={`Zoom ${Math.round(zoom * 100)} percent`} onClick={fitPage}>{Math.round(zoom * 100)}%</button>
          <IconButton label="Zoom in" disabled={zoom >= ZOOM_STEPS.at(-1)!} onClick={() => changeZoom(1)}><Plus size={16} aria-hidden="true" /></IconButton>
          <button className="button-with-icon" onClick={fitPage}><Maximize2 size={14} aria-hidden="true" />Fit</button>
        </div>
        <div className="add-element-toolbar" role="toolbar" aria-label="Add element">
          <button className="button-with-icon" aria-label="Add section" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.update($addSection, { tag: HISTORY_PUSH_TAG })}><ElementTypeIcon type="cv-section" size={16} />Section</button>
          <button className="button-with-icon" aria-label="Add entry" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.update($addEntry, { tag: HISTORY_PUSH_TAG })}><ElementTypeIcon type="cv-entry" size={16} />Entry</button>
          <button className="button-with-icon" aria-label="Add divider" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.update($addDivider, { tag: HISTORY_PUSH_TAG })}><ElementTypeIcon type="cv-divider" size={16} />Divider</button>
        </div>
      </section>

      <aside className="workspace-sidebar right-sidebar" aria-label="Editor panels">
        {rightOpen && <SidebarResizer side="right" onResize={setRightWidth} />}
        <IconButton label={rightOpen ? "Collapse right sidebar" : "Expand right sidebar"} className="sidebar-collapse" onClick={toggleRightSidebar}><PanelRight size={16} aria-hidden="true" /></IconButton>
        {rightOpen && <>
          <Tabs label="Right sidebar" value={rightTab} onChange={setRightTab} options={[{ id: "element", label: "Properties" }, { id: "suggestions", label: "Suggestions", badge: pending ? 1 : 0 }]} />
          <div className="sidebar-scroll" role="tabpanel">
            {rightTab === "element" ? <ElementPanel clean={clean} onCleanChange={setClean} scope={propertyScope} onScopeChange={setPropertyScope} /> : <section className="review-panel" role="complementary" aria-label="Proposal review">
              <div className="panel-heading"><h2>Suggested change</h2><span className={`badge ${stale && pending ? "warning" : ""}`}>{status}</span></div>
              <label className="suggestion-clean"><input aria-label="Clean view" type="checkbox" checked={clean} onChange={(event) => setClean(event.target.checked)} /> Hide highlights</label>
              <p className="muted">One fixture proposal · No AI requests</p>
              {stale && pending && <p className="conflict" role="alert">This bullet changed or was removed. Accept is blocked to protect your edits. Update the CV manually using the suggestion, then dismiss it.</p>}
              <h3>{stale && pending ? "Current CV text" : "Original"}</h3>
              <p className="comparison original">{stale && pending ? current ? textOf(current.spans) : "Target block was removed." : textOf(proposal.expected.spans)}</p>
              <h3>Proposed replacement</h3>
              {editingProposal ? <form onSubmit={updateProposal}>
                <label htmlFor="proposal-wording">Proposed wording</label>
                <textarea id="proposal-wording" value={wording} onChange={(event) => setWording(event.target.value)} rows={5} />
                <div className="actions"><button type="submit" disabled={!wording.trim()}>Update proposal</button><button type="button" onClick={() => setEditingProposal(false)}>Cancel</button></div>
              </form> : <p className="comparison replacement">{proposal.replacement.map((span, index) => <span key={index} style={{ fontWeight: span.bold ? 700 : undefined, fontStyle: span.italic ? "italic" : undefined }}>{span.text}</span>)}</p>}
              {pending && !editingProposal && <button className="text-button" onClick={() => { setWording(textOf(proposal.replacement)); setEditingProposal(true); }}>Edit proposed wording</button>}
              <h3>Why this change</h3><p>{proposal.reason}</p>
              <h3>Supporting evidence</h3><blockquote>{proposal.evidence.text}<cite>{proposal.evidence.source}</cite></blockquote>
              <div className="actions review-actions">
                <button className="primary" disabled={!pending || stale || editingProposal} onClick={() => review("accepted")}>Accept</button>
                <button disabled={!pending || editingProposal} onClick={() => review("rejected")}>{stale && pending ? "Dismiss proposal" : "Reject"}</button>
              </div>
              <p className="hint">Accept, reject, and proposal updates can be undone. The master CV stays unchanged.</p>
            </section>}
          </div>
        </>}
      </aside>
    </div>
    <ActiveElementFocus />
    <ListPlugin />
    <LinkPlugin validateUrl={safeLink} />
  </main></SpacingProvider>;
}
