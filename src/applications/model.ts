import type { Workspace } from "@/persistence/drafts";
import type { PersistedWorkspace } from "@/persistence/workspace-store";

export type NewApplication = { company: string; role: string; jobDescription: string };
export type ApplicationSummary = {
  id: string;
  companyId: string;
  company: string;
  role: string;
  jobDescription: string;
  updatedAt: string;
};
export type CompanyApplications = { id: string; name: string; applications: ApplicationSummary[] };
export type ApplicationHome = { hasMaster: boolean; companies: CompanyApplications[] };
export type ApplicationEditor = { application: ApplicationSummary; workspace: PersistedWorkspace };

export interface ApplicationStore {
  home(ownerId: string): Promise<ApplicationHome>;
  loadMaster(ownerId: string): Promise<PersistedWorkspace | null>;
  createMaster(ownerId: string, workspace: Workspace): Promise<PersistedWorkspace>;
  createApplication(ownerId: string, input: NewApplication): Promise<ApplicationSummary>;
  loadApplication(ownerId: string, applicationId: string): Promise<ApplicationEditor | null>;
}

export function normalizeCompanyName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function parseNewApplication(value: NewApplication): NewApplication {
  const company = value.company.trim().replace(/\s+/g, " ");
  const role = value.role.trim().replace(/\s+/g, " ");
  const jobDescription = value.jobDescription.trim();
  if (company.length < 2 || company.length > 120) throw new Error("Enter a company name between 2 and 120 characters.");
  if (role.length < 2 || role.length > 160) throw new Error("Enter a role between 2 and 160 characters.");
  if (jobDescription.length < 20 || jobDescription.length > 50_000) throw new Error("Paste a job description between 20 and 50,000 characters.");
  return { company, role, jobDescription };
}

export function groupApplications(applications: ApplicationSummary[]): CompanyApplications[] {
  const groups = new Map<string, CompanyApplications>();
  for (const application of applications) {
    const group = groups.get(application.companyId) ?? { id: application.companyId, name: application.company, applications: [] };
    group.applications.push(application);
    groups.set(application.companyId, group);
  }
  return [...groups.values()];
}
