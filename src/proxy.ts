import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicRoute } from "@/auth/routing";

const proxy = process.env.PLAYWRIGHT_TEST === "1"
  ? (_request: NextRequest) => {
      void _request;
      return NextResponse.next();
    }
  : clerkMiddleware(async (auth, request) => {
      if (!isPublicRoute(request.nextUrl.pathname)) {
        await auth.protect();
      }
    });

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
