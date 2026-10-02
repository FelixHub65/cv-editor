import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDatabase, type Database } from "@/db/client";
import { applications, companies, documents, documentVersions } from "@/db/schema";
import type { Workspace } from "@/persistence/drafts";
import { createDatabaseWorkspaceStore } from "@/db/documents";
import { stateFromWorkspace } from "@/persistence/workspace-store";
import {
  groupApplications, normalizeCompanyName, parseNewApplication,
  type ApplicationStore, type ApplicationSummary,
} from "./model";

export function createDatabaseApplicationStore(database: Database = getDatabase()): ApplicationStore {
  const workspaces = createDatabaseWorkspaceStore(database);

  async function masterDocumentId(ownerId: string) {
    const [master] = await database.select({ id: documents.id }).from(documents).where(and(
      eq(documents.ownerId, ownerId), eq(documents.kind, "master"),
    )).limit(1);
    if (master) return master.id;

    // Rows created before the application dashboard had no application link.
    // Promote the newest one so an existing user's work becomes their master CV.
    const [legacy] = await database.select({ id: documents.id }).from(documents).where(and(
      eq(documents.ownerId, ownerId), isNull(documents.applicationId),
    )).orderBy(desc(documents.updatedAt)).limit(1);
    if (!legacy) return null;
    await database.update(documents).set({ kind: "master", updatedAt: new Date() }).where(eq(documents.id, legacy.id));
    return legacy.id;
  }

  async function loadMaster(ownerId: string) {
    const id = await masterDocumentId(ownerId);
    return id ? workspaces.loadByDocumentId(ownerId, id) : null;
  }

  async function company(ownerId: string, name: string) {
    const normalizedName = normalizeCompanyName(name);
    const [existing] = await database.select().from(companies).where(and(
      eq(companies.ownerId, ownerId), eq(companies.normalizedName, normalizedName),
    )).limit(1);
    if (existing) return existing;
    const [created] = await database.insert(companies).values({ ownerId, name, normalizedName })
      .onConflictDoNothing({ target: [companies.ownerId, companies.normalizedName] }).returning();
    if (created) return created;
    const [concurrent] = await database.select().from(companies).where(and(
      eq(companies.ownerId, ownerId), eq(companies.normalizedName, normalizedName),
    )).limit(1);
    if (!concurrent) throw new Error("The company could not be created.");
    return concurrent;
  }

  function summary(row: {
    application: typeof applications.$inferSelect;
    company: typeof companies.$inferSelect;
  }): ApplicationSummary {
    return {
      id: row.application.id,
      companyId: row.company.id,
      company: row.company.name,
      role: row.application.role,
      jobDescription: row.application.jobDescription,
      updatedAt: row.application.updatedAt.toISOString(),
    };
  }

  return {
    async home(ownerId) {
      const hasMaster = !!await masterDocumentId(ownerId);
      const rows = await database.select({ application: applications, company: companies })
        .from(applications).innerJoin(companies, eq(applications.companyId, companies.id))
        .where(and(eq(applications.ownerId, ownerId), eq(companies.ownerId, ownerId)))
        .orderBy(desc(applications.updatedAt));
      return { hasMaster, companies: groupApplications(rows.map(summary)) };
    },
    loadMaster,
    async createMaster(ownerId: string, workspace: Workspace) {
      const existing = await loadMaster(ownerId);
      if (existing) return existing;
      const state = stateFromWorkspace(workspace);
      const documentId = crypto.randomUUID();
      try {
        await database.insert(documents).values({
          id: documentId,
          ownerId,
          contentId: state.draft.cv.id,
          kind: "master",
          title: "Master CV",
          content: state,
        });
      } catch {
        const concurrent = await loadMaster(ownerId);
        if (concurrent) return concurrent;
        throw new Error("The master CV could not be created.");
      }
      if (workspace.versions.length) {
        await database.insert(documentVersions).values(workspace.versions.map((version) => ({
          id: version.id,
          documentId,
          content: version.draft,
          sourceRevision: 1,
          createdAt: new Date(version.savedAt),
        })));
      }
      return (await workspaces.loadByDocumentId(ownerId, documentId))!;
    },
    async createApplication(ownerId, value) {
      const input = parseNewApplication(value);
      const master = await loadMaster(ownerId);
      if (!master) throw new Error("Create your master CV before starting an application.");
      const employer = await company(ownerId, input.company);
      const applicationId = crypto.randomUUID();
      const documentId = crypto.randomUUID();
      const masterDraft = structuredClone(master.state.draft);
      const state = { schemaVersion: 2 as const, master: masterDraft, draft: structuredClone(masterDraft) };
      await database.batch([
        database.insert(applications).values({
          id: applicationId, ownerId, companyId: employer.id,
          role: input.role, jobDescription: input.jobDescription,
        }),
        database.insert(documents).values({
          id: documentId, ownerId, applicationId,
          contentId: `${masterDraft.cv.id}:${applicationId}`,
          kind: "application", title: `${input.company} · ${input.role}`, content: state,
        }),
      ]);
      return {
        id: applicationId, companyId: employer.id, company: employer.name,
        role: input.role, jobDescription: input.jobDescription, updatedAt: new Date().toISOString(),
      };
    },
    async loadApplication(ownerId, applicationId) {
      const [row] = await database.select({ application: applications, company: companies, documentId: documents.id })
        .from(applications)
        .innerJoin(companies, eq(applications.companyId, companies.id))
        .innerJoin(documents, eq(documents.applicationId, applications.id))
        .where(and(
          eq(applications.id, applicationId), eq(applications.ownerId, ownerId), eq(companies.ownerId, ownerId),
        )).limit(1);
      if (!row) return null;
      const workspace = await workspaces.loadByDocumentId(ownerId, row.documentId);
      return workspace ? { application: summary(row), workspace } : null;
    },
  };
}
