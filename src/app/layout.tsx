import type { Metadata } from "next";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { TooltipProvider } from "@/ui/tooltip";
import "./tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CV editor prototype",
  description: "A small editor proof for reviewing evidence-backed CV changes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const content = process.env.PLAYWRIGHT_TEST === "1" ? children : <ClerkProvider>
    {children}
    <div className="account-menu" aria-label="Account"><UserButton /></div>
  </ClerkProvider>;

  return <html lang="en"><body><TooltipProvider>{content}</TooltipProvider></body></html>;
}
