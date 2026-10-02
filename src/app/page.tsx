import { auth } from "@clerk/nextjs/server";
import ApplicationHomeScreen from "@/applications/home-screen";
import { authenticatedOwnerId } from "@/auth/session";
import { getApplicationStore } from "@/persistence/server-store";

export default async function Home() {
  if (process.env.PLAYWRIGHT_TEST !== "1") {
    await auth.protect();
  }

  const home = await getApplicationStore().home(await authenticatedOwnerId());
  return <ApplicationHomeScreen initial={home} />;
}
