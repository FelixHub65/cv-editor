<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project context
- Read PROJECT_CONTEXT.md before planning or implementing features.
- It records agreed product decisions, scope, and unresolved questions.

## Architecture
- Use Next.js App Router and TypeScript.
- Keep AI requests, credentials, and database access on the server.
- Keep editing, selection, diff review, and undo/redo on the client.
- Keep client boundaries focused. The editor workspace may be
  a Client Component.
- Keep CV schemas, diffing, and edit operations independent of
  React and Next.js.
- Store CV content as structured data with stable IDs.
- Keep HTTP streaming and parsing separate from React state.
  UI components should consume typed stream events.
- Coordinate editor history and proposal review state so undo/redo
  restores them together. Avoid independent, competing histories.

## Product behavior
- Generate proposed CV changes only when the user requests them.
- Let users accept, reject, or edit proposed changes.
- Link proposed changes to supporting CV content or interview answers.
- Save tailored application versions separately from the master CV.
- Focus on content editing. Layout and style customization are
  outside the current scope.

## Editor
- Use Lexical for rich-text editing.
- Let Lexical own active document state and text selection.
- Apply edits through Lexical APIs, not direct DOM mutations.
- Store persistent content IDs separately from Lexical node keys.
- Coordinate document changes and proposal review status in undo/redo.
- Detect stale AI proposals before applying them to edited content.

## React Compiler
- Enable React Compiler.
- Rely on it for routine memoization.
- Add manual memoization only for a demonstrated need.
- Investigate compatibility warnings and document any targeted
  "use no memo" exceptions.

  ## Development
- Use Bun for package management and package scripts.
- Follow the existing component architecture and conventions.
- Keep Next.js client boundaries narrow.
- Keep structured CV data as the source of truth. Render the
  document from that data.
- Treat document edits and their associated review state as
  one undoable transaction.

## Testing
- Use Playwright for E2E tests of critical user workflows.
- Cover editing, accepting/rejecting suggestions, undo/redo,
  and saving through user-visible interactions.
- Use unit tests for document transformations and history logic.
- Run relevant tests after implementation.
- For visual changes, inspect screenshots of the affected UI.
- Review visual differences before updating screenshot baselines.
- Fix underlying issues rather than weakening tests.
- Report any relevant tests that could not be run.