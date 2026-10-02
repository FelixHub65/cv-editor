import { type Draft, parseDraft } from "@/domain/cv";

export const LEGACY_STORAGE_KEY = "cv-editor.prototype.v1";
export const STORAGE_KEY = "cv-editor.workspace.v2";
export type SavedVersion = { id: string; savedAt: string; draft: Draft };
export type Workspace = { schemaVersion: 2; master: Draft; draft: Draft; versions: SavedVersion[] };
export interface DraftRepository {
  load(): Workspace | null;
  save(workspace: Workspace): void;
}
// Temporary adapter. Replace with server-backed persistence after the initial test.
export function browserRepository(storage: Pick<Storage, "getItem" | "setItem">): DraftRepository {
  return {
    load() {
      const raw = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (![1, 2].includes(value?.schemaVersion) || !Array.isArray(value.versions)) throw new Error("Unsupported saved workspace.");
      return {
        schemaVersion: 2, master: parseDraft(value.master), draft: parseDraft(value.draft),
        versions: value.versions.map((version: SavedVersion) => {
          if (typeof version?.id !== "string" || typeof version.savedAt !== "string") throw new Error("Invalid saved version.");
          return { id: version.id, savedAt: version.savedAt, draft: parseDraft(version.draft) };
        }),
      };
    },
    save(workspace) { storage.setItem(STORAGE_KEY, JSON.stringify(workspace)); },
  };
}
