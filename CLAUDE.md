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
  → for auth'd users: Prisma saves conversation + files to SQLite
```

### Key Modules

**`src/app/api/chat/route.ts`** — Streaming chat endpoint. Uses Vercel AI SDK `streamText` with tool calling. Prompt caching via `providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }`.

**`src/lib/file-system.ts`** — `VirtualFileSystem` class: in-memory CRUD for files/directories. The entire file system is serialized as JSON and passed in each chat request; tool results update it.

**`src/lib/tools/`** — AI tool definitions:
- `str-replace.ts`: `str_replace_editor` tool — view, create, str_replace, insert operations
- `file-manager.ts`: `file_manager` tool — rename, delete

**`src/lib/transform/jsx-transformer.ts`** — Runs Babel in the browser to transpile JSX→JS and generates ES module import maps so components can import React and other libraries at runtime.

**`src/lib/provider.ts`** — `getLanguageModel()` returns the real Claude model if `ANTHROPIC_API_KEY` is set, otherwise a `MockLanguageModel` that returns hardcoded responses (useful for dev/testing without an API key).

**`src/lib/contexts/`** — Two core React contexts:
- `file-system-context.tsx`: holds virtual FS state, handles tool call results from the AI stream, triggers preview re-renders
- `chat-context.tsx`: holds message history, input state, and streaming status

**`src/app/[projectId]/page.tsx`** — Project workspace page. Loads saved project data for auth'd users; anonymous users start with an empty file system.

**`src/actions/`** — Next.js server actions for auth (signUp/signIn/signOut/getUser) and project CRUD.

### Auth

Custom JWT-based auth using `jose` for signing/verification and `bcrypt` for password hashing. Sessions stored in HTTP-only cookies. `src/middleware.ts` gates project routes; anonymous usage is allowed on the root page.

### Database

Prisma + SQLite. Models: `User` (email, hashed password) and `Project` (owner FK, serialized files JSON, serialized messages JSON). Only persists data for registered users.

### Testing

Vitest with jsdom + React Testing Library. Tests mock child components, hooks, and contexts with `vi.mock()`. Use `renderHook()` with wrapper providers for context tests.
