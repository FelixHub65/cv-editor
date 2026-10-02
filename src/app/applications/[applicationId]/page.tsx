import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { authenticatedOwnerId } from "@/auth/session";
import EditorWorkspace from "@/editor/workspace";
import { getApplicationStore } from "@/persistence/server-store";

export default async function ApplicationPage({ params }: PageProps<"/applications/[applicationId]">) {
  if (process.env.PLAYWRIGHT_TEST !== "1") await auth.protect();
  const { applicationId } = await params;
  const result = await getApplicationStore().loadApplication(await authenticatedOwnerId(), applicationId);
  if (!result) notFound();
  return <EditorWorkspace initial={result.workspace} contextLabel={`${result.application.company} · ${result.application.role}`} backHref="/" />;
}
