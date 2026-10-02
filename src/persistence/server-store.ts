import "server-only";
import { createDatabaseWorkspaceStore } from "@/db/documents";
import { createDatabaseApplicationStore } from "@/applications/database-store";
import { createMemoryApplicationStore } from "@/applications/memory-store";
import type { ApplicationStore } from "@/applications/model";
import { createMemoryWorkspaceStore, type WorkspaceStore } from "./workspace-store";

const testStoreKey = Symbol.for("cv-editor.playwright-workspace-store");
const testApplicationStoreKey = Symbol.for("cv-editor.playwright-application-store");
type StoreGlobal = typeof globalThis & {
  [testStoreKey]?: WorkspaceStore;
  [testApplicationStoreKey]?: ApplicationStore;
};

export function getWorkspaceStore(): WorkspaceStore {
  if (process.env.PLAYWRIGHT_TEST === "1") {
    const scope = globalThis as StoreGlobal;
    scope[testStoreKey] ??= createMemoryWorkspaceStore();
    return scope[testStoreKey];
  }
  return createDatabaseWorkspaceStore();
}

export function getApplicationStore(): ApplicationStore {
  if (process.env.PLAYWRIGHT_TEST === "1") {
    const scope = globalThis as StoreGlobal;
    scope[testApplicationStoreKey] ??= createMemoryApplicationStore(getWorkspaceStore());
    return scope[testApplicationStoreKey];
  }
  return createDatabaseApplicationStore();
}
