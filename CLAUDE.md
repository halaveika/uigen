# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server (Turbopack)
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run all Vitest tests
npm run test -- src/components/chat/__tests__/ChatInterface.test.tsx  # Run single test file
npm run setup        # Install deps + generate Prisma client + run migrations
npm run db:reset     # Clear and re-initialize SQLite database
```

All npm scripts inject `NODE_OPTIONS='--require ./node-compat.cjs'` for Turbopack + `@babel/standalone` compatibility.

## Environment Variables

- `ANTHROPIC_API_KEY` — optional; falls back to `MockLanguageModel` with static responses if absent
- `JWT_SECRET` — defaults to `"development-secret-key"`

## Architecture Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language and the AI generates code using tool calls that modify a virtual (in-memory) file system, which then renders in a sandboxed iframe.

### Request Flow

```
User prompt → ChatInterface
  → POST /api/chat  (src/app/api/chat/route.ts)
    → Claude (Vercel AI SDK + @ai-sdk/anthropic, model: claude-haiku-4-5)
      → tool calls: str_replace_editor, file_manager
        → VirtualFileSystem (src/lib/file-system.ts)
          → file-system-context serializes state → PreviewFrame
            → Babel (JSX→JS in browser) + import maps → sandboxed iframe
  → for auth'd users: Prisma saves conversation + files to SQLite (in onFinish only)
```

### Key Modules

**`src/app/api/chat/route.ts`** — Streaming chat endpoint. Uses Vercel AI SDK `streamText` with tool calling. Prompt caching via `providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }`. `maxSteps` is 40 for real Claude, 4 for `MockLanguageModel`.

**`src/lib/file-system.ts`** — `VirtualFileSystem` class: in-memory CRUD for files/directories. The entire file system is serialized as JSON and passed in each chat request; tool results update it. `serialize()` returns a flat `Record<string, FileNode>` — directory `children` Maps are stripped. `deserializeFromNodes()` reconstructs the tree by sorting paths and building parent dirs first.

**`src/lib/tools/`** — AI tool definitions:
- `str-replace.ts`: `str_replace_editor` tool — view, create, str_replace, insert, undo_edit (undo not yet implemented)
- `file-manager.ts`: `file_manager` tool — rename, delete (rename can move files across directories)

**`src/lib/transform/jsx-transformer.ts`** — Runs Babel in the browser to transpile JSX→JS and generates ES module import maps so components can import React and other libraries at runtime. Third-party imports (no `/`, `.`, or `@/` prefix) are CDN-linked to `esm.sh`. CSS imports are silently stripped from JS/JSX and injected as `<style>` tags. Modules with Babel parse errors are replaced with styled error cards in the preview HTML.

**`src/lib/provider.ts`** — `getLanguageModel()` returns the real Claude model if `ANTHROPIC_API_KEY` is set, otherwise a `MockLanguageModel`. The mock counts tool messages in the message array to determine which step it's on and returns deterministically different hardcoded components (counter → form → card).

**`src/lib/contexts/`** — Two core React contexts:
- `file-system-context.tsx`: holds virtual FS state, handles tool call results from the AI stream via `handleToolCall()`, increments a `refreshTrigger` counter to signal PreviewFrame re-renders
- `chat-context.tsx`: holds message history, input state, and streaming status; serializes full FS state into the POST body on each send

**`src/app/[projectId]/page.tsx`** — Project workspace page. Loads saved project data for auth'd users; anonymous users start with an empty file system. Anonymous work is tracked in `sessionStorage` via `anon-work-tracker.ts` (triggers sign-up prompts).

**`src/actions/`** — Next.js server actions for auth (signUp/signIn/signOut/getUser) and project CRUD.

### Preview Entry Point Resolution

`PreviewFrame` searches for the root component in this order: `/App.jsx` → `/App.tsx` → `/index.jsx` → `/index.tsx` → `/src/App.jsx` → `/src/App.tsx` → first `.jsx`/`.tsx` found. First load with no entry point shows a "Welcome" state; subsequent renders with no entry point show an error.

### AI System Prompt Constraints

The system prompt directs Claude to:
- Always create `/App.jsx` as the root entrypoint with a default-exported React component
- Use Tailwind CSS exclusively (no hardcoded styles)
- Use `@/` alias for all non-library imports
- Keep the virtual FS root as `/` (no OS-level paths)

### Auth

Custom JWT-based auth using `jose` (HS256, 7-day sessions) for signing/verification and `bcrypt` (10 rounds) for password hashing. Sessions stored in HTTP-only cookies. `src/middleware.ts` gates `/api/projects` and `/api/filesystem`; anonymous usage is allowed on the root page.

### Database

Prisma + SQLite. Models: `User` (email, hashed password) and `Project` (nullable userId FK, messages JSON string, data JSON string). `messages` and `data` must be JSON-stringified on write and parsed on read — they are not structured columns. Prisma client is generated to `src/generated/prisma`. Only persists data for registered users; project state is saved once per chat turn in the `onFinish` callback.

### Testing

Vitest with jsdom + React Testing Library. Tests mock child components, hooks, and contexts with `vi.mock()`. Use `renderHook()` with wrapper providers for context tests.
