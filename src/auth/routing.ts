export const PLAYWRIGHT_OWNER_COOKIE = "cv-editor-playwright-owner";

export function isPublicRoute(pathname: string) {
  return (process.env.NODE_ENV !== "production" && pathname === "/icon-gallery")
    || pathname === "/sign-in" || pathname.startsWith("/sign-in/")
    || pathname === "/sign-up" || pathname.startsWith("/sign-up/");
}
