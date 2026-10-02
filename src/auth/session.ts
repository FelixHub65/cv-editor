import "server-only";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { PLAYWRIGHT_OWNER_COOKIE } from "./routing";

export async function authenticatedOwnerId() {
  if (process.env.PLAYWRIGHT_TEST === "1") {
    const ownerId = (await cookies()).get(PLAYWRIGHT_OWNER_COOKIE)?.value;
    return ownerId ?? "playwright-readiness-probe";
  }
  const { userId } = await auth();
  if (!userId) throw new Error("Authentication is required.");
  return userId;
}
