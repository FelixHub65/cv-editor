"use client";

import { useSyncExternalStore } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { EditorState } from "lexical";

// Lexical's initialization can commit at different times during SSR and in the
// browser. Both hydration renders use null; React then reads the live snapshot.
const serverSnapshot = (): EditorState | null => null;

export function useLiveEditorState() {
  const [editor] = useLexicalComposerContext();
  return useSyncExternalStore(
    (notify) => editor.registerUpdateListener(() => notify()),
    (): EditorState | null => editor.getEditorState(),
    serverSnapshot,
  );
}
