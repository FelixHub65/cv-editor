"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { SpaceControl } from "./spacing";
const Context = createContext<{ preview: SpaceControl | null; setPreview: (value: SpaceControl | null) => void }>({ preview: null, setPreview: () => {} });
export function SpacingProvider({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState<SpaceControl | null>(null);
  return <Context.Provider value={{ preview, setPreview }}>{children}</Context.Provider>;
}
export const useSpacingPreview = () => useContext(Context);
