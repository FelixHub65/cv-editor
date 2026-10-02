import { auth } from "@clerk/nextjs/server";
import { authenticatedOwnerId } from "@/auth/session";
import EditorWorkspace from "@/editor/workspace";
import { getApplicationStore } from "@/persistence/server-store";

export default async function MasterCvPage() {
  if (process.env.PLAYWRIGHT_TEST !== "1") await auth.protect();
  const initial = await getApplicationStore().loadMaster(await authenticatedOwnerId());
  return <EditorWorkspace initial={initial} backHref="/" documentKind="master" />;
}
