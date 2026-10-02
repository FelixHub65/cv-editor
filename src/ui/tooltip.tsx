"use client";

import * as Primitive from "@radix-ui/react-tooltip";
import type { ReactElement, ReactNode } from "react";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <Primitive.Provider delayDuration={400} skipDelayDuration={300}>{children}</Primitive.Provider>;
}

/** Use an existing control as the trigger; passive spans need no extra tab stop. */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactElement }) {
  return <Primitive.Root>
    <Primitive.Trigger asChild>{children}</Primitive.Trigger>
    <Primitive.Portal>
      <Primitive.Content className="app-tooltip" side="top" sideOffset={7} collisionPadding={8}>
        {content}
        <Primitive.Arrow className="app-tooltip-arrow" width={8} height={4} />
      </Primitive.Content>
    </Primitive.Portal>
  </Primitive.Root>;
}
