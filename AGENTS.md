\# SCRM Workbench - Project Context



\## Tech Stack

\- Electron + Next.js (static export)

\- TypeScript, Tailwind CSS

\- better-sqlite3 + Drizzle ORM (migrating from localStorage)



\## Architecture

\- `electron/` - Main process \& IPC

\- `lib/` - Renderer process (React components, store)

\- `electron/adapters/` - Platform-specific injection scripts (WhatsApp, LINE, Telegram)



\## Data Migration Task

1\. Install better-sqlite3 + Drizzle ORM

2\. Create schema per `db/schema.ts` (accounts, chats, messages, profiles, translations, settings)

3\. Implement `electron/db.cjs` for DB init \& CRUD

4\. Migrate existing localStorage data to SQLite on first launch

5\. Implement auto-backup (keep last 7 copies)



\## Injection Layer Refactor

\- Use WPPConnect/WA-JS for WhatsApp Web automation

\- Abstract platform adapters into `electron/adapters/`

\- Keep LINE/Telegram selectors externalized in config files

