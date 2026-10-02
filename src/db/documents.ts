import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { Workspace } from "@/persistence/drafts";
import {
  parseWorkspaceState, stateFromWorkspace, workspaceTitle,
  type PersistedWorkspace, type SaveVersionResult, type SaveWorkspaceResult,
  type WorkspaceState, type WorkspaceStore,
} from "@/persistence/workspace-store";
import { getDatabase, type Database } from "./client";
import { documents, documentVersions } from "./schema";

export function documentsOwnedBy(database: Database, ownerId: string) {
  return database.select().from(documents)
    .where(eq(documents.ownerId, ownerId))
    .orderBy(desc(documents.updatedAt));
}

async function versionCount(database: Database, documentId: string) {
  const [result] = await database.select({ value: count() }).from(documentVersions)
    .where(eq(documentVersions.documentId, documentId));
  return result.value;
}

export function createDatabaseWorkspaceStore(database = getDatabase()): WorkspaceStore {
  async function project(record: typeof documents.$inferSelect): Promise<PersistedWorkspace> {
    return {
      documentId: record.id, revision: record.revision,
      state: parseWorkspaceState(record.content), versionCount: await versionCount(database, record.id),
    };
  }
  async function load(ownerId: string): Promise<PersistedWorkspace | null> {
    const [record] = await documentsOwnedBy(database, ownerId).limit(1);
    return record ? project(record) : null;
  }

  async function save(
    ownerId: string, documentId: string, expectedRevision: number, input: WorkspaceState,
  ): Promise<SaveWorkspaceResult> {
    const state = parseWorkspaceState(input);
    const [updated] = await database.update(documents).set({
      content: state,
      title: workspaceTitle(state),
      revision: sql`${documents.revision} + 1`,
      updatedAt: new Date(),
    }).where(and(
      eq(documents.id, documentId), eq(documents.ownerId, ownerId), eq(documents.revision, expectedRevision),
    )).returning({ revision: documents.revision });
    if (updated) return { status: "saved", revision: updated.revision };
    const [current] = await database.select({ revision: documents.revision }).from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.ownerId, ownerId))).limit(1);
    return { status: "conflict", revision: current?.revision ?? 0 };
  }

  return {
    load,
    async loadByDocumentId(ownerId, documentId) {
      const [record] = await database.select().from(documents).where(and(
        eq(documents.id, documentId), eq(documents.ownerId, ownerId),
      )).limit(1);
      return record ? project(record) : null;
    },
    async create(ownerId: string, workspace: Workspace) {
      const state = stateFromWorkspace(workspace);
      const [created] = await database.insert(documents).values({
        ownerId, contentId: state.draft.cv.id, kind: "application",
        title: workspaceTitle(state), content: state,
      }).returning();
      if (!created) throw new Error("The document could not be created.");
      if (workspace.versions.length) {
        await database.insert(documentVersions).values(workspace.versions.map((version) => ({
          id: version.id, documentId: created.id, content: version.draft,
          sourceRevision: created.revision, createdAt: new Date(version.savedAt),
        })));
      }
      return project(created);
    },
    save,
    async saveVersion(ownerId, documentId, expectedRevision, input): Promise<SaveVersionResult> {
      const state = parseWorkspaceState(input);
      const saved = await save(ownerId, documentId, expectedRevision, state);
      if (saved.status === "conflict") return saved;
      try {
        await database.insert(documentVersions).values({
          documentId, content: state.draft, sourceRevision: saved.revision,
        });
        return { status: "saved", revision: saved.revision, versionCount: await versionCount(database, documentId) };
      } catch {
        return { status: "version_failed", revision: saved.revision };
      }
    },
  };
}
