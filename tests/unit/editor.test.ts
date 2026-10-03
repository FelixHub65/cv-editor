import { $activeElementId } from "../../src/editor/active-element-focus";
import { describe, expect, test } from "bun:test";
import { $createTextNode, $getRoot, $getState, $setState, createEditor, HISTORY_PUSH_TAG, REDO_COMMAND, UNDO_COMMAND } from "lexical";
import { createEmptyHistoryState, registerHistory } from "@lexical/history";
import { createFixture } from "../../src/domain/fixture";
import { allElements, linearizeForAts, textBlocks, needsReview, normalizeSpans, parseDraft, plain } from "../../src/domain/cv";
import { $addDivider, $canMoveOutlineElement, $insertBulletList, $blockNodes, $elementNodes, $isOutlineElementMovable, $loadDraft, $moveOutlineElement, $readDraft, $review, $setColumnsAppearance, $setDocumentColumns, $setDocumentLayout, $setDocumentHeader, $swapColumns, $setRegionAppearance, $setSectionColumns, editorNodes, proposalState, registerBlockIds } from "../../src/editor/adapter";
import { dividerAppearanceState, CvDividerNode, layoutState, blockIdState, CvColumnNode, CvColumnsNode, CvHeaderNode, CvSectionNode } from "../../src/editor/nodes";
import { legacyDraft } from "../fixtures/legacy";
import { createMemoryWorkspaceStore } from "../../src/persistence/workspace-store";
import { browserRepository, STORAGE_KEY, LEGACY_STORAGE_KEY, type Workspace } from "../../src/persistence/drafts";
import { createMemoryApplicationStore } from "../../src/applications/memory-store";
import { normalizeCompanyName, parseNewApplication } from "../../src/applications/model";
import { $removeSelectedList, $setBlockAppearance } from "../../src/editor/formatting";

function setup() {
  const fixture = createFixture();
  const editor = createEditor({ namespace: "unit", nodes: editorNodes, onError: (e) => { throw e; } });
  registerBlockIds(editor);
  editor.update(() => $loadDraft(fixture), { discrete: true });
  const history = createEmptyHistoryState();
  history.current = { editor, editorState: editor.getEditorState() };
  registerHistory(editor, history, 750);
  return { editor, history, read: () => editor.getEditorState().read(() => $readDraft()) };
}

test("rich formatting, links, document defaults and ordered lists round-trip", () => {
  const { editor, read } = setup();
  const fixture = createFixture();
  fixture.cv.appearance = { font: "Georgia", size: 18, margin: 48, lineHeight: 1.5, sectionSpacing: 24 };
  const block = textBlocks(fixture.cv).find((node) => node.id === "block-designers")!;
  block.appearance = { alignment: "center", lineHeight: 2, spaceAfter: 16 };
  block.spans = [{ text: "Portfolio", bold: false, italic: true, underline: true, strikethrough: true, font: "Verdana", size: 24, color: "#123456", link: "https://example.com" }];
  const list = allElements(fixture.cv.children).find((element) => element.type === "list")!;
  if (list.type === "list") list.listType = "number";
  editor.update(() => $loadDraft(parseDraft(fixture)), { discrete: true });
  expect(read()).toEqual(fixture);
  editor.setEditorState(editor.parseEditorState(JSON.stringify(editor.getEditorState().toJSON())));
  expect(read()).toEqual(fixture);
});

test("alignment is undoable and makes a proposal stale; list removal keeps formatting and IDs", async () => {
  const { editor, read } = setup();
  const before = read();
  editor.update(() => {
    $blockNodes().find((node) => $getState(node, blockIdState) === "block-components")!.selectStart();
    $setBlockAppearance({ alignment: "right", lineHeight: 2 });
  }, { discrete: true, tag: HISTORY_PUSH_TAG });
  expect(needsReview(textBlocks(read().cv), read().proposal)).toBe(true);
  await command(editor, UNDO_COMMAND);
  expect(read()).toEqual(before);
  await command(editor, REDO_COMMAND);
  editor.update(() => $removeSelectedList(), { discrete: true, tag: HISTORY_PUSH_TAG });
  const block = textBlocks(parseDraft(read()).cv).find((node) => node.id === "block-components")!;
  expect(block.type).toBe("paragraph");
  expect(block.appearance).toEqual({ alignment: "right", lineHeight: 2 });
  expect(textBlocks(read().cv).find((node) => node.id === "block-designers")?.type).toBe("bullet");
});

test("format validation rejects unsafe links and invalid numeric values", () => {
  for (const patch of [{ link: "javascript:alert(1)" }, { size: -1 }, { color: "red; display:none" }]) {
    const fixture = createFixture();
    Object.assign(textBlocks(fixture.cv)[0].spans[0], patch);
    expect(() => parseDraft(fixture)).toThrow();
  }
});
async function command(editor: ReturnType<typeof createEditor>, action: typeof UNDO_COMMAND) {
  editor.dispatchCommand(action, undefined);
  await new Promise((resolve) => setTimeout(resolve, 0));
}
describe("domain and persistence", () => {
  test("conflicts include formatting and deletion, but not text segmentation", () => {
    const { cv, proposal } = createFixture();
    const blocks = textBlocks(cv).filter((block) => block.type === "bullet");
    expect(needsReview(blocks, proposal)).toBe(false);
    expect(needsReview([], proposal)).toBe(true);
    expect(needsReview([{ ...blocks[0], spans: [{ ...blocks[0].spans[0], bold: true }] }], proposal)).toBe(true);
    expect(normalizeSpans([...plain("Hello "), ...plain("world")])).toEqual(plain("Hello world"));
  });
  test("invalid schemas and duplicate IDs are rejected", () => {
    expect(() => parseDraft({ schemaVersion: 8 })).toThrow();
    const fixture = createFixture();
    textBlocks(fixture.cv).find((block) => block.id === "block-designers")!.id = textBlocks(fixture.cv).find((block) => block.id === "block-components")!.id;
    expect(() => parseDraft(fixture)).toThrow("duplicate");
  });
  test("draft writes keep master and saved versions separate", () => {
    let raw: string | null = null;
    const repository = browserRepository({ getItem: () => raw, setItem: (_, value) => { raw = value; } });
    const fixture = createFixture();
    const workspace: Workspace = { schemaVersion: 2, master: structuredClone(fixture), draft: structuredClone(fixture), versions: [{ id: "version-1", savedAt: "2026-09-22", draft: structuredClone(fixture) }] };
    textBlocks(workspace.draft.cv).find((block) => block.id === "block-components")!.spans = plain("New text");
    repository.save(workspace);
    const loaded = repository.load()!;
    expect(textBlocks(loaded.draft.cv).find((block) => block.id === "block-components")!.spans).toEqual(plain("New text"));
    expect(loaded.master).toEqual(fixture);
    expect(loaded.versions[0].draft).toEqual(fixture);
  });
});
describe("Lexical transaction integration", () => {
  test("round trip retains formatting and stable IDs", () => {
    const { editor, read } = setup();
    const fixture = createFixture();
    textBlocks(fixture.cv).find((block) => block.id === "block-designers")!.spans = [{ text: "Formatted", bold: true, italic: true }];
    editor.update(() => $loadDraft(fixture), { discrete: true });
    expect(read()).toEqual(fixture);
  });
  test("accept restores text and review state together", async () => {
    const { editor, read } = setup();
    const before = read();
    editor.update(() => { expect($review("accepted")).toBe(true); }, { discrete: true, tag: HISTORY_PUSH_TAG });
    expect(read().proposal.status).toBe("accepted");
    expect(textBlocks(read().cv).find((block) => block.id === "block-components")!.spans).toEqual(before.proposal.replacement);
    await command(editor, UNDO_COMMAND);
    expect(read()).toEqual(before);
    await command(editor, REDO_COMMAND);
    expect(read().proposal.status).toBe("accepted");
  });
  test("rejection and proposal-only edits participate in the same history", async () => {
    const { editor, read } = setup();
    const before = read();
    editor.update(() => { $setState($getRoot(), proposalState, { ...$getState($getRoot(), proposalState), replacement: plain("Edited suggestion") }); }, { discrete: true, tag: HISTORY_PUSH_TAG });
    editor.update(() => { $review("rejected"); }, { discrete: true, tag: HISTORY_PUSH_TAG });
    expect(read().proposal.status).toBe("rejected");
    expect(read().cv).toEqual(before.cv);
    await command(editor, UNDO_COMMAND);
    expect(read().proposal.status).toBe("pending");
    expect(read().proposal.replacement).toEqual(plain("Edited suggestion"));
    await command(editor, UNDO_COMMAND);
    expect(read()).toEqual(before);
    await command(editor, REDO_COMMAND);
    expect(read().proposal.replacement).toEqual(plain("Edited suggestion"));
  });
  test("deleted target cannot be accepted", () => {
    const { editor, read } = setup();
    editor.update(() => $blockNodes().find((node) => $getState(node, blockIdState) === "block-components")!.remove(), { discrete: true });
    const before = read();
    editor.update(() => { expect($review("accepted")).toBe(false); }, { discrete: true });
    expect(read()).toEqual(before);
  });
});


describe("complete document", () => {
  test("the entire tree, including root identity and groups, lives in Lexical", () => {
    const { editor, read } = setup();
    expect(read()).toEqual(createFixture());
    const serialized = JSON.stringify(editor.getEditorState().toJSON());
    for (const element of allElements(createFixture().cv.children)) expect(serialized).toContain(element.id);
    expect(serialized).toContain("cv-alex-morgan");
    // Lexical serialization also supports history/cloning; domain saves use the adapter.
    editor.setEditorState(editor.parseEditorState(serialized));
    expect(read()).toEqual(createFixture());
  });
  test("editing a heading and accepting a proposal undo in chronological order", async () => {
    const { editor, read } = setup();
    const before = read();
    editor.update(() => {
      const name = $blockNodes().find((node) => $getState(node, blockIdState) === "cv-name")!;
      name.getFirstChildOrThrow().remove();
      name.append($createTextNode("Alex Updated"));
    }, { discrete: true, tag: HISTORY_PUSH_TAG });
    const edited = read();
    editor.update(() => { $review("accepted"); }, { discrete: true, tag: HISTORY_PUSH_TAG });
    await command(editor, UNDO_COMMAND);
    expect(read()).toEqual(edited);
    await command(editor, UNDO_COMMAND);
    expect(read()).toEqual(before);
  });
  test("reject duplicate container IDs and invalid nesting", () => {
    const fixture = createFixture();
    fixture.cv.children[1].id = fixture.cv.children[0].id;
    expect(() => parseDraft(fixture)).toThrow("duplicate");
    expect(() => parseDraft({ ...createFixture(), cv: { id: "doc", children: [{ id: "bad", type: "bullet", spans: plain("orphan") }] } })).toThrow();
  });
  test("legacy migration preserves every existing block and proposal without mutating input", () => {
    const old = legacyDraft();
    const original = structuredClone(old);
    const migrated = parseDraft(old);
    expect(migrated.schemaVersion).toBe(2);
    expect(textBlocks(migrated.cv).filter((block) => block.type === "bullet")).toEqual(old.cv.section.entry.blocks);
    expect(migrated.proposal).toEqual(old.proposal);
    expect(allElements(migrated.cv.children).map((element) => element.id)).toContain(old.cv.section.entry.id);
    expect(parseDraft(migrated)).toEqual(migrated);
    expect(old).toEqual(original);
  });
  test("migrate master, draft and saved versions while retaining legacy storage", () => {
    const old = legacyDraft();
    const raw = JSON.stringify({ schemaVersion: 1, master: old, draft: old, versions: [{ id: "old-version", savedAt: "2026-09-22", draft: old }] });
    const values = new Map([[LEGACY_STORAGE_KEY, raw]]);
    const repository = browserRepository({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } });
    const loaded = repository.load()!;
    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.versions[0].draft).toEqual(parseDraft(old));
    repository.save(loaded);
    expect(values.get(LEGACY_STORAGE_KEY)).toBe(raw);
    expect(values.has(STORAGE_KEY)).toBe(true);
    expect(repository.load()).toEqual(loaded);
  });
});


test("list conversion stays inside the selected entry and preserves its block ID", () => {
  const { editor, read } = setup();
  const before = read();
  editor.update(() => {
    const dates = $blockNodes().find((node) => $getState(node, blockIdState) === "dates-northstar")!;
    dates.selectStart();
    $insertBulletList();
  }, { discrete: true, tag: HISTORY_PUSH_TAG });
  const result = parseDraft(read());
  expect(result.cv.children.map((element) => element.id)).toEqual(before.cv.children.map((element) => element.id));
  expect(textBlocks(result.cv).find((block) => block.id === "dates-northstar")?.type).toBe("bullet");
  expect(allElements(result.cv.children).find((element) => element.id === "section-experience")?.type).toBe("section");
  expect(allElements(result.cv.children).find((element) => element.id === "entry-northstar")?.type).toBe("entry");
});

test("active element identity follows selection without adding history", () => {
  const { editor, history } = setup();
  editor.update(() => {
    $blockNodes().find((node) => $getState(node, blockIdState) === "cv-name")!.selectStart();
    expect($activeElementId()).toBe("cv-name");
  }, { discrete: true });
  editor.update(() => {
    $blockNodes().find((node) => $getState(node, blockIdState) === "block-components")!.selectStart();
    expect($activeElementId()).toBe("block-components");
    $getRoot().select(0, $getRoot().getChildrenSize());
    expect($activeElementId()).toBeNull();
  }, { discrete: true });
  expect(history.undoStack).toHaveLength(0);
});

test("document columns keep content together without creating a header and preserve ATS reading order through undo", async () => {
  const { editor, read } = setup();
  const before = read();
  const originalIds = textBlocks(before.cv).map((block) => block.id);
  editor.update(() => { expect($setDocumentColumns(true)).toBe(true); }, { discrete: true, tag: HISTORY_PUSH_TAG });
  const twoColumn = parseDraft(read());
  expect(twoColumn.cv.children.map((element) => element.type)).toEqual(["columns"]);
  const columns = twoColumn.cv.children[0];
  expect(columns.type).toBe("columns");
  if (columns.type !== "columns") throw new Error("Expected columns");
  expect(columns.children).toHaveLength(2);
  expect(textBlocks(twoColumn.cv).map((block) => block.id)).toEqual(originalIds);
  expect(textBlocks(linearizeForAts(twoColumn.cv)).map((block) => block.id)).toEqual(originalIds);
  await command(editor, UNDO_COMMAND);
  expect(read()).toEqual(before);
  await command(editor, REDO_COMMAND);
  expect(read()).toEqual(twoColumn);
});

test("column layout and region colors round-trip; flattening keeps content IDs", () => {
  const { editor, read } = setup();
  editor.update(() => {
    $setDocumentColumns(true);
    const columns = $elementNodes().find((node): node is CvColumnsNode => node instanceof CvColumnsNode)!;
    $setColumnsAppearance(columns, { ratio: 62, gap: 16, dividerWidth: 2, dividerColor: "#123456" });
    const second = columns.getChildren()[1];
    if (second instanceof CvColumnNode) $setRegionAppearance(second, { background: "#17324a", color: "#f3f7f8", padding: 16 });
  }, { discrete: true, tag: HISTORY_PUSH_TAG });
  const result = parseDraft(read());
  const columns = result.cv.children.find((element) => element.type === "columns");
  expect(columns?.type).toBe("columns");
  if (!columns || columns.type !== "columns") throw new Error("Expected columns");
  expect(columns.appearance).toEqual({ ratio: 62, gap: 16, dividerWidth: 2, dividerColor: "#123456" });
  expect(columns.children[1].appearance).toEqual({ background: "#17324a", color: "#f3f7f8", padding: 16 });
  expect(parseDraft(result)).toEqual(result);
  expect(textBlocks(linearizeForAts(result.cv)).map((block) => block.id)).toEqual(textBlocks(createFixture().cv).map((block) => block.id));
});

test("sections can use columns only while they span the document width", () => {
  const { editor, read } = setup();
  editor.update(() => {
    const section = $elementNodes().find((node) => node instanceof CvSectionNode && $getState(node, blockIdState) === "section-experience") as CvSectionNode;
    expect($setSectionColumns(section, true)).toBe(true);
  }, { discrete: true, tag: HISTORY_PUSH_TAG });
  const sectionResult = parseDraft(read());
  const section = allElements(sectionResult.cv.children).find((element) => element.id === "section-experience");
  expect(section?.type).toBe("section");
  if (!section || section.type !== "section") throw new Error("Expected section");
  expect(section.children.map((element) => element.type)).toEqual(["heading", "columns"]);

  const nested = setup();
  nested.editor.update(() => {
    $setDocumentColumns(true);
    const sectionNode = $elementNodes().find((node) => node instanceof CvSectionNode && $getState(node, blockIdState) === "section-experience") as CvSectionNode;
    expect($setSectionColumns(sectionNode, true)).toBe(false);
  }, { discrete: true, tag: HISTORY_PUSH_TAG });
  const nestedSection = allElements(parseDraft(nested.read()).cv.children).find((element) => element.id === "section-experience");
  expect(nestedSection?.type).toBe("section");
  if (nestedSection?.type === "section") expect(nestedSection.children.some((element) => element.type === "columns")).toBe(false);
});

test("outline moves content into columns without moving fixed layout or group headings", async () => {
  const { editor, read } = setup();
  editor.update(() => { $setDocumentColumns(true); $setDocumentHeader(true); }, { discrete: true, tag: HISTORY_PUSH_TAG });
  let secondColumnId = "";
  let headerId = "";
  editor.getEditorState().read(() => {
    const columns = $elementNodes().find((node): node is CvColumnsNode => node instanceof CvColumnsNode)!;
    secondColumnId = $getState(columns.getChildren()[1] as CvColumnNode, blockIdState);
    headerId = $getState($elementNodes().find((node) => node instanceof CvHeaderNode)!, blockIdState);
    expect($isOutlineElementMovable("section-summary")).toBe(true);
    expect($isOutlineElementMovable("heading-summary")).toBe(false);
    expect($canMoveOutlineElement("section-summary", headerId, "inside")).toBe(false);
    expect($canMoveOutlineElement("section-summary", secondColumnId, "inside")).toBe(true);
  });
  editor.update(() => {
    expect($moveOutlineElement("section-summary", secondColumnId, "inside")).toBe(true);
  }, { discrete: true, tag: HISTORY_PUSH_TAG });
  const moved = parseDraft(read());
  const columns = moved.cv.children.find((element) => element.type === "columns");
  expect(columns?.type).toBe("columns");
  if (!columns || columns.type !== "columns") throw new Error("Expected columns");
  expect(columns.children[1].children.some((element) => element.id === "section-summary")).toBe(true);
  expect(textBlocks(linearizeForAts(moved.cv)).map((block) => block.id)).toContain("block-summary");
  await command(editor, UNDO_COMMAND);
  const undone = parseDraft(read());
  const undoneColumns = undone.cv.children.find((element) => element.type === "columns");
  if (!undoneColumns || undoneColumns.type !== "columns") throw new Error("Expected columns");
  expect(undoneColumns.children[0].children.some((element) => element.id === "section-summary")).toBe(true);
});

test("database workspace revisions prevent cross-user access and stale overwrites", async () => {
  const store = createMemoryWorkspaceStore();
  const fixture = createFixture();
  const workspace = { schemaVersion: 2 as const, master: structuredClone(fixture), draft: fixture, versions: [] };
  const created = await store.create("user-one", workspace);
  expect(await store.load("user-two")).toBeNull();
  expect(await store.save("user-two", created.documentId, created.revision, created.state)).toEqual({ status: "conflict", revision: 0 });
  const saved = await store.save("user-one", created.documentId, created.revision, created.state);
  expect(saved).toEqual({ status: "saved", revision: 2 });
  expect(await store.save("user-one", created.documentId, created.revision, created.state)).toEqual({ status: "conflict", revision: 2 });
  expect((await store.saveVersion("user-one", created.documentId, 2, created.state)).status).toBe("saved");
  expect((await store.load("user-one"))?.versionCount).toBe(1);
});

test("application input is normalized and validated", () => {
  expect(normalizeCompanyName("  Acme   Labs ")).toBe("acme labs");
  expect(parseNewApplication({
    company: "  Acme   Labs ", role: "  Product   Engineer ",
    jobDescription: "  A sufficiently detailed role description.  ",
  })).toEqual({
    company: "Acme Labs", role: "Product Engineer",
    jobDescription: "A sufficiently detailed role description.",
  });
  expect(() => parseNewApplication({ company: "A", role: "Engineer", jobDescription: "Long enough job description" })).toThrow("company");
});

test("applications clone the master and group multiple roles under one company", async () => {
  const workspaces = createMemoryWorkspaceStore();
  const store = createMemoryApplicationStore(workspaces);
  const fixture = createFixture();
  await store.createMaster("owner", {
    schemaVersion: 2, master: structuredClone(fixture), draft: structuredClone(fixture), versions: [],
  });
  const first = await store.createApplication("owner", {
    company: "Acme Labs", role: "Frontend Engineer", jobDescription: "A complete description for the frontend role.",
  });
  const second = await store.createApplication("owner", {
    company: " ACME   LABS ", role: "Product Engineer", jobDescription: "A complete description for the product role.",
  });
  const home = await store.home("owner");
  expect(home.companies).toHaveLength(1);
  expect(home.companies[0].applications.map((application) => application.id)).toEqual([first.id, second.id]);
  const application = await store.loadApplication("owner", first.id);
  expect(application?.workspace.state.draft).toEqual(fixture);
  expect(application?.workspace.documentId).not.toBe((await store.loadMaster("owner"))?.documentId);
  expect(await store.loadApplication("someone-else", first.id)).toBeNull();
});


test("page regions preserve content, primary identity, padding and history across swaps and conversion", async () => {
  const { editor, read } = setup();
  const before = read();
  editor.update(() => {
    $setDocumentLayout("page");
    const columns = $getRoot().getFirstChild() as CvColumnsNode;
    const first = columns.getFirstChild() as CvColumnNode;
    $setState(columns, layoutState, { mode: "page", primaryColumnId: $getState(first, blockIdState) });
    $setState(first, layoutState, { label: "Main" });
    $setRegionAppearance(first, { padding: { top: 10, right: 20, bottom: 30, left: 40 } });
    $swapColumns(columns);
  }, { discrete: true, tag: HISTORY_PUSH_TAG });
  const result = parseDraft(read());
  expect(textBlocks(linearizeForAts(result.cv))).toEqual(textBlocks(before.cv));
  const columns = result.cv.children[0];
  if (columns.type !== "columns") throw new Error("Expected columns");
  expect(columns.children[1].id).toBe(columns.primaryColumnId!);
  expect(columns.children[1].label).toBe("Main");
  editor.update(() => $loadDraft(result), { discrete: true });
  expect(read()).toEqual(result);
  editor.update(() => $setDocumentLayout("single"), { discrete: true, tag: HISTORY_PUSH_TAG });
  expect(textBlocks(read().cv)).toEqual(textBlocks(before.cv));
  await command(editor, UNDO_COMMAND);
  expect(read()).toEqual(result);
});

test("removing an optional Header moves its content without losing IDs", () => {
  const { editor, read } = setup();
  editor.update(() => {
    $setDocumentLayout("page");
    $setDocumentHeader(true);
    const header = $getRoot().getFirstChild() as CvHeaderNode;
    const name = $elementNodes().find((node) => $getState(node, blockIdState) === "cv-name")!;
    header.clear().append(name);
  }, { discrete: true });
  const before = textBlocks(read().cv);
  editor.update(() => $setDocumentHeader(false), { discrete: true });
  expect(textBlocks(parseDraft(read()).cv)).toEqual(before);
});

test("legacy scalar padding stays lossless and invalid primary references are rejected", () => {
  const { editor, read } = setup();
  editor.update(() => $setDocumentColumns(true), { discrete: true });
  const draft = read();
  const columns = draft.cv.children[0];
  if (columns.type !== "columns") throw new Error("Expected columns");
  columns.children[0].appearance = { padding: 16, background: "#123456" };
  expect(parseDraft(draft)).toEqual(draft);
  columns.primaryColumnId = "missing";
  expect(() => parseDraft(draft)).toThrow();
});


test("declared primary order changes projection without changing visual content or proposal eligibility", () => {
  const { editor, read } = setup();
  editor.update(() => {
    $setDocumentLayout("page");
    const columns = $getRoot().getFirstChild() as CvColumnsNode;
    const secondary = columns.getChildren()[1] as CvColumnNode;
    const id = $getState(secondary, blockIdState);
    $moveOutlineElement("section-summary", id, "inside");
    $setState(columns, layoutState, { mode: "page", primaryColumnId: id });
  }, { discrete: true });
  const result = parseDraft(read());
  expect(textBlocks(result.cv)[0].id).toBe("cv-name");
  const projection = textBlocks(linearizeForAts(result.cv));
  expect(projection[0].id).toBe("heading-summary");
  expect(new Set(projection.map((block) => block.id)).size).toBe(textBlocks(createFixture().cv).length);
  expect(needsReview(textBlocks(result.cv), result.proposal)).toBe(false);
});

test("dividers keep their identity through movement, serialization and history", async () => {
  const { editor, read } = setup();
  const before = read();
  editor.update(() => {
    $blockNodes().find((node) => $getState(node, blockIdState) === "block-components")!.selectStart();
    $addDivider();
  }, { discrete: true, tag: HISTORY_PUSH_TAG });
  const divider = allElements(read().cv.children).find((element) => element.type === "divider")!;
  expect(divider.id).toBeTruthy();
  expect(parseDraft(read())).toEqual(read());
  expect(textBlocks(read().cv)).toEqual(textBlocks(before.cv));
  expect(allElements(linearizeForAts(read().cv).children)).toContainEqual(divider);
  await command(editor, UNDO_COMMAND);
  expect(read()).toEqual(before);
  await command(editor, REDO_COMMAND);
  expect(allElements(read().cv.children)).toContainEqual(divider);
  editor.update(() => {
    expect($moveOutlineElement(divider.id, "block-designers", "inside")).toBe(false);
    expect($moveOutlineElement(divider.id, textBlocks(before.cv)[0].id, "after")).toBe(true);
  }, { discrete: true });
  const saved = read();
  editor.setEditorState(editor.parseEditorState(JSON.stringify(editor.getEditorState().toJSON())));
  expect(read()).toEqual(saved);
  editor.update(() => $loadDraft(saved), { discrete: true });
  expect(read()).toEqual(saved);
});

test("divider appearance validates bounds, persists and shares document history", async () => {
  const { editor, read } = setup();
  editor.update($addDivider, { discrete: true, tag: HISTORY_PUSH_TAG });
  const before = read();
  editor.update(() => {
    $setState($elementNodes().find((node) => node instanceof CvDividerNode)!, dividerAppearanceState, { color: "#12abef", opacity: 0, thickness: 200, ends: "rounded" });
  }, { discrete: true, tag: HISTORY_PUSH_TAG });
  const styled = read();
  expect(parseDraft(styled)).toEqual(styled);
  await command(editor, UNDO_COMMAND);
  expect(read()).toEqual(before);
  await command(editor, REDO_COMMAND);
  expect(read()).toEqual(styled);
  editor.setEditorState(editor.parseEditorState(JSON.stringify(editor.getEditorState().toJSON())));
  expect(read()).toEqual(styled);
  editor.update(() => $loadDraft(styled), { discrete: true });
  expect(read()).toEqual(styled);
  for (const appearance of [{ thickness: 0 }, { thickness: 201 }, { thickness: NaN }, { opacity: -1 }, { opacity: 101 }, { color: "red" }, { ends: "triangle" }]) {
    const invalid = structuredClone(styled);
    const divider = allElements(invalid.cv.children).find((element) => element.type === "divider")!;
    Object.assign(divider, { appearance });
    expect(() => parseDraft(invalid)).toThrow();
  }
});

test("spacing boundaries share ownership, normalize list gaps, and round-trip through history", async () => {
  const { $spacingControls, $setSpace } = await import("../../src/editor/spacing");
  const { $selectElementRange, $selectedElements, $adjacentElements } = await import("../../src/editor/element-selection");
  const { spacingState } = await import("../../src/editor/nodes");
  const { editor, read } = setup();
  let beforeId = "";
  editor.update(() => {
    const first = $blockNodes().find((node) => $getState(node, blockIdState) === "block-components")!;
    const next = first.getNextSibling()!;
    first.selectEnd();
    const below = $spacingControls().find((control) => control.id === "below")!;
    beforeId = below.keys[0];
    $setSpace(below, 24);
    $selectElementRange(next as typeof first, "block-components", true, false);
    expect($selectedElements()).toHaveLength(2);
    expect($adjacentElements($selectedElements())).toBe(true);
    const between = $spacingControls().find((control) => control.id === "between")!;
    expect(between.keys).toEqual([beforeId]);
    $setSpace(between, 32);
  }, { discrete: true, tag: HISTORY_PUSH_TAG });
  expect(textBlocks(read().cv).find((node) => node.id === "block-designers")?.spacing?.before).toBe(32);
  const saved = read();
  editor.dispatchCommand(UNDO_COMMAND, undefined);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(textBlocks(read().cv).find((node) => node.id === "block-designers")?.spacing).toBeUndefined();
  editor.update(() => $loadDraft(saved), { discrete: true });
  expect(read()).toEqual(saved);
  editor.update(() => {
    const first = $blockNodes().find((node) => $getState(node, blockIdState) === "block-components")!;
    const list = first.getParentOrThrow();
    $selectElementRange(list, null, false, false);
    $setSpace($spacingControls().find((control) => control.id === "items")!, 16);
    expect($getState(list, spacingState).itemGap).toBe(16);
    expect($getState(first.getNextSibling()!, spacingState).before).toBeUndefined();
  }, { discrete: true });
  const invalid = structuredClone(read());
  invalid.cv.children[0].spacing = { before: -1 };
  expect(() => parseDraft(invalid)).toThrow();
});

test("nested edge spacing resolves to its containing region and text styles keep gap overrides", async () => {
  const { $spacingControls, $setSpace } = await import("../../src/editor/spacing");
  const { $setTextStyle } = await import("../../src/editor/formatting");
  const { spacingState } = await import("../../src/editor/nodes");
  const { editor, read } = setup();
  editor.update(() => {
    $setDocumentLayout("page");
    const title = $blockNodes()[0];
    title.selectEnd();
    const inset = $spacingControls().find((control) => control.id === "above")!;
    expect(inset.kind).toBe("padding");
    expect(inset.side).toBe("top");
    $setSpace(inset, 40);
    expect($getState(title, spacingState).before).toBeUndefined();
    const subtitle = $blockNodes()[1];
    subtitle.selectEnd();
    $setSpace($spacingControls().find((control) => control.id === "above")!, 18);
    $setTextStyle("h3");
  }, { discrete: true });
  expect(textBlocks(read().cv)[1].spacing?.before).toBe(18);
  const columns = read().cv.children.find((node) => node.type === "columns");
  expect(columns && "children" in columns && columns.children[0].appearance).toMatchObject({ padding: { top: 40 } });
  expect(() => parseDraft(read())).not.toThrow();
});
