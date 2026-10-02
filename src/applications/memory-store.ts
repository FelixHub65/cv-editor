import type { Workspace } from "@/persistence/drafts";
import type { WorkspaceStore } from "@/persistence/workspace-store";
import { groupApplications, parseNewApplication, type ApplicationStore, type ApplicationSummary } from "./model";

export function createMemoryApplicationStore(workspaces: WorkspaceStore): ApplicationStore {
  const masters = new Map<string, string>();
  const applications = new Map<string, ApplicationSummary & { ownerId: string; documentId: string }>();

  return {
    async home(ownerId) {
      const owned = [...applications.values()].filter((application) => application.ownerId === ownerId);
      return { hasMaster: masters.has(ownerId), companies: groupApplications(owned) };
    },
    async loadMaster(ownerId) {
      const documentId = masters.get(ownerId);
      return documentId ? workspaces.loadByDocumentId(ownerId, documentId) : null;
    },
    async createMaster(ownerId, workspace: Workspace) {
      const existing = masters.get(ownerId);
      if (existing) return (await workspaces.loadByDocumentId(ownerId, existing))!;
      const created = await workspaces.create(ownerId, workspace);
      masters.set(ownerId, created.documentId);
      return created;
    },
    async createApplication(ownerId, value) {
      const input = parseNewApplication(value);
      const master = await this.loadMaster(ownerId);
      if (!master) throw new Error("Create your master CV before starting an application.");
      const companyId = `${ownerId}:${input.company.toLocaleLowerCase("en-US")}`;
      const id = crypto.randomUUID();
      const draft = structuredClone(master.state.draft);
      const workspace = await workspaces.create(ownerId, {
        schemaVersion: 2, master: structuredClone(master.state.draft), draft, versions: [],
      });
      const application = {
        id, companyId, company: input.company, role: input.role,
        jobDescription: input.jobDescription, updatedAt: new Date().toISOString(), ownerId,
        documentId: workspace.documentId,
      };
      applications.set(id, application);
      return application;
    },
    async loadApplication(ownerId, applicationId) {
      const application = applications.get(applicationId);
      if (!application || application.ownerId !== ownerId) return null;
      const workspace = await workspaces.loadByDocumentId(ownerId, application.documentId);
      return workspace ? { application, workspace } : null;
    },
  };
}
