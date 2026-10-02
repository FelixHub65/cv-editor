# CV editor proof

A Next.js App Router + Lexical prototype for editing a fictional CV and reviewing one evidence-backed replacement. React Compiler is enabled.

## Development setup

Install dependencies and create the local environment file:

```sh
bun install
cp .env.example .env.local
```

Create a Clerk development application and copy its publishable and secret keys into `.env.local`. Create a Neon project with a `development` branch, then copy that branch's pooled PostgreSQL connection string into `DATABASE_URL`.

Verify the connection and apply committed migrations:

```sh
bun run db:verify
bun run db:migrate
bun run dev
```

Open http://localhost:3000 and sign up through Clerk. No local PostgreSQL or Docker installation is required. Run `bun run db:studio` when you want to inspect the development database.

The home screen organizes applications by company. Create or edit the master CV, then enter a company, role, and pasted job description to start a tailored draft. Reusing a company name adds another application to the same company group. Each draft starts as a copy of the current master and then autosaves independently through the authenticated Neon database.

On a user's first visit to the master editor, an existing browser draft is imported once; otherwise the fictional fixture creates the initial master document. Browser data is removed only after the database import succeeds.

Edit the name, contact details, headings, dates, paragraphs, and bullets directly in the CV. Select text to apply bold or italic. Use **Add section** and **Add entry** to extend the document; entries are added to the section containing the cursor (or a new Experience section when no section is selected). Inspect/edit the proposal, accept or reject it, then undo/redo. Editing its target marks it “Needs review” and blocks acceptance.

The editor uses a Figma-style workspace. The left sidebar switches between the live Lexical outline and a placeholder interview-chat shell. The center canvas contains the floating A4 document, overlay formatting toolbar, and 50–200% zoom controls. The right sidebar switches between selected-element properties and suggestions. Both sidebars collapse; on narrow screens they act as drawers.

Draft changes are debounced and saved automatically to the authenticated user's document. **Save version** creates a separate immutable row in `document_versions`; the master fixture remains unchanged. Revision checks prevent an older browser tab from silently overwriting newer database content. Undo history remains transient and resets on reload.

## Checks

```sh
bun run lint
bun run typecheck
bun run test:unit
bun run db:check
bunx playwright install chromium
bun run test:e2e
```

If Turbopack’s internal worker ports are restricted in your environment, run `PLAYWRIGHT_WEBPACK=1 bun run test:e2e` to use the Webpack production build with React Compiler still enabled.

Playwright builds and starts the production application on port 3100. Tests cover editing, formatting, proposals, history, stale targets, paste, IDs, and save/reload. Desktop/mobile screenshots are written into `test-results/` for inspection. No screenshot baseline is accepted automatically.

## Architecture

- `src/domain`: framework-independent CV, proposal, fixture, validation, and conflict logic.
- `src/applications`: application validation, company grouping, and database/in-memory application stores.
- `src/db`: server-only Neon client, Drizzle schema, and owner-scoped queries.
- `src/editor`: Lexical nodes, load/save adapters, review transactions, and the client workspace.
- `src/ui`: small shared interface primitives used by the workspace.
- `src/persistence`: database workspace contract, server store selection, and the one-time legacy browser import adapter.

Clerk protects every application and API route except its sign-in and sign-up entry routes. Database rows use the Clerk user ID as `owner_id`; company, application, and document queries include that ownership constraint. Each owner has one master document, each application has one document, and one company may have several applications. `documents.revision` provides optimistic concurrency for autosave and version creation. Playwright uses owner-isolated, in-memory implementations of the same store contracts and never relies on real Clerk or Neon credentials.

Lexical owns active content and selection. Proposal metadata lives in root NodeState, participating in the same history as text. Acceptance/rejection/proposal updates use explicit history boundaries; consecutive typing uses Lexical's grouping. There is no second React document history. Panel navigation and unsaved proposal-form input are transient UI state. Submitting **Update proposal** commits that wording as one undoable action.

The complete CV lives in Lexical: a document contains headings, paragraphs, lists, and sections; sections can contain entries; lists contain single-level bullets. All document elements, including the document root, sections, entries, and lists, have persistent IDs independent of Lexical keys. Text uses bold/italic and plain-text paste. Section/entry containers are ordinary Lexical elements, so selection and deletion can span the whole document. A scoped list command converts text blocks without wrapping a whole section. Proposed wording edits use plain text. It does not yet include AI, imports, export, or a saved-version browser. Future custom elements can extend the typed domain model and Lexical adapters.

## Development state inspector

`bun run dev` displays a collapsible, read-only Lexical state inspector below the editor. It shows the live node tree with runtime keys and persistent block IDs, range/node selection, and serialized document JSON including proposal metadata. Updates include selection-only changes; inspecting or collapsing the view does not enter document history. The inspector is not rendered in production (`bun run build` / `bun run start`).

## Icons

Standard interface actions use tree-shakeable named imports from `lucide-react`. Custom product icons are exported from a 24×24 Figma frame into `src/ui/icons/source` and converted into optimized, typed React components:

```sh
bun run icons:generate
bun run icons:check
```

While the development server is running, open `/icon-gallery` to inspect every custom icon and the selected Lucide set at common sizes and colors. The gallery returns 404 in production. See `src/ui/icons/README.md` for the Figma specification, accessibility rules, and import examples.


## Document persistence and migration

Domain schema v2 is an ordered, typed document tree, independent of Lexical and React. Headings have levels 1–3; sections and entries are structural groups. All displayed CV text comes from editor state. `$loadDraft` imports this tree, and `$readDraft` exports the full current state without merging in an older React snapshot. New element types such as dividers will require explicit domain, Lexical, and export adapters; they are not implemented yet.

Existing `cv-editor.prototype.v1` browser workspaces are migrated on load, including master, draft, and saved versions. Their text, formatting, proposal status, and existing IDs are preserved. Former static headings gain deterministic, collision-safe IDs. New saves go to `cv-editor.workspace.v2`; the old storage key is retained as a fallback copy. Unknown schemas/invalid IDs are rejected rather than reset silently. The new example contact, profile, dates, and education are only for fresh fictional fixtures; migration does not invent those details for existing drafts.
