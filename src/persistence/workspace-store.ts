import { documentName, parseDraft, type Draft } from "@/domain/cv";
import type { SavedVersion, Workspace } from "./drafts";

export type WorkspaceState = { schemaVersion: 2; master: Draft; draft: Draft };
export type PersistedWorkspace = { documentId: string; revision: number; state: WorkspaceState; versionCount: number };
export type SaveWorkspaceResult = { status: "saved"; revision: number } | { status: "conflict"; revision: number };
export type SaveVersionResult =
  | { status: "saved"; revision: number; versionCount: number }
  | { status: "conflict"; revision: number }
  | { status: "version_failed"; revision: number };

export interface WorkspaceStore {
  load(ownerId: string): Promise<PersistedWorkspace | null>;
  loadByDocumentId(ownerId: string, documentId: string): Promise<PersistedWorkspace | null>;
  create(ownerId: string, workspace: Workspace): Promise<PersistedWorkspace>;
  save(ownerId: string, documentId: string, expectedRevision: number, state: WorkspaceState): Promise<SaveWorkspaceResult>;
  saveVersion(ownerId: string, documentId: string, expectedRevision: number, state: WorkspaceState): Promise<SaveVersionResult>;
}

export function parseWorkspaceState(value: unknown): WorkspaceState {
  if (!value || typeof value !== "object" || (value as { schemaVersion?: unknown }).schemaVersion !== 2) throw new Error("Unsupported workspace state.");
  const candidate = value as { master?: unknown; draft?: unknown };
  return { schemaVersion: 2, master: parseDraft(candidate.master), draft: parseDraft(candidate.draft) };
}
export function stateFromWorkspace(workspace: Workspace): WorkspaceState { return parseWorkspaceState(workspace); }
export function workspaceTitle(state: WorkspaceState) { return `${documentName(state.draft.cv)} · Application draft`; }

type MemoryRecord = PersistedWorkspace & { ownerId: string; versions: SavedVersion[] };

export function createMemoryWorkspaceStore(): WorkspaceStore {
  const records = new Map<string, MemoryRecord>();
  const projection = (record: MemoryRecord) => structuredClone({
    documentId: record.documentId, revision: record.revision, state: record.state, versionCount: record.versions.length,
  });
  return {
    async load(ownerId) {
      const record = [...records.values()].find((item) => item.ownerId === ownerId);
      return record ? projection(record) : null;
    },
    async loadByDocumentId(ownerId, documentId) {
      const record = records.get(documentId);
      return record?.ownerId === ownerId ? projection(record) : null;
    },
    async create(ownerId, workspace) {
      const state = stateFromWorkspace(workspace);
      const record: MemoryRecord = {
        ownerId, documentId: crypto.randomUUID(), revision: 1, state,
        versionCount: workspace.versions.length, versions: structuredClone(workspace.versions),
      };
      records.set(record.documentId, record);
      return projection(record);
    },
    async save(ownerId, documentId, expectedRevision, input) {
      const state = parseWorkspaceState(input);
      const record = records.get(documentId);
      if (!record || record.ownerId !== ownerId) return { status: "conflict", revision: 0 };
      if (record.revision !== expectedRevision) return { status: "conflict", revision: record.revision };
      record.state = structuredClone(state);
      record.revision += 1;
      return { status: "saved", revision: record.revision };
    },
    async saveVersion(ownerId, documentId, expectedRevision, input) {
      const state = parseWorkspaceState(input);
      const saved = await this.save(ownerId, documentId, expectedRevision, state);
      if (saved.status === "conflict") return saved;
      const record = records.get(documentId)!;
      record.versions.push({ id: crypto.randomUUID(), savedAt: new Date().toISOString(), draft: structuredClone(state.draft) });
      return { status: "saved", revision: saved.revision, versionCount: record.versions.length };
    },
  };
}
