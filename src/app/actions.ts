"use server";

import { authenticatedOwnerId } from "@/auth/session";
import { parseNewApplication, type NewApplication } from "@/applications/model";
import type { Workspace } from "@/persistence/drafts";
import { getApplicationStore, getWorkspaceStore } from "@/persistence/server-store";
import { parseWorkspaceState, type WorkspaceState } from "@/persistence/workspace-store";

function validDocumentId(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("Invalid document ID.");
  return value;
}

export async function createWorkspace(workspace: Workspace) {
  return getApplicationStore().createMaster(await authenticatedOwnerId(), workspace);
}
export async function createApplication(input: NewApplication) {
  const application = await getApplicationStore().createApplication(await authenticatedOwnerId(), parseNewApplication(input));
  return { id: application.id };
}
export async function saveWorkspace(documentId: string, expectedRevision: number, input: WorkspaceState) {
  return getWorkspaceStore().save(await authenticatedOwnerId(), validDocumentId(documentId), expectedRevision, parseWorkspaceState(input));
}
export async function saveWorkspaceVersion(documentId: string, expectedRevision: number, input: WorkspaceState) {
  return getWorkspaceStore().saveVersion(await authenticatedOwnerId(), validDocumentId(documentId), expectedRevision, parseWorkspaceState(input));
}
