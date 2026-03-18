# Project Brain

## Purpose
Central navigation document for the repository Brain. Use it to quickly find the right project context before making product, architecture, API, database, or implementation changes.

## How To Use
- Start here when onboarding or before a substantial code change.
- Update links or summaries when new Brain documents are added.
- Keep this file high level; detailed decisions belong in the section files it links to.

## Template

### Quick Links
- [System Overview](./SYSTEM_OVERVIEW.md)
- [Project Index](./PROJECT_INDEX.md)
- [AI Workflow](./AI_WORKFLOW.md)
- [AI Prompt Rules](./AI_PROMPT_RULES.md)

### Core Areas
- System: [`brain/system/overview.md`](./system/overview.md), [`brain/system/architecture.md`](./system/architecture.md), [`brain/system/tech-stack.md`](./system/tech-stack.md)
- Product: [`brain/product/vision.md`](./product/vision.md), [`brain/product/roadmap.md`](./product/roadmap.md)
- Engineering: [`brain/engineering/coding-standards.md`](./engineering/coding-standards.md), [`brain/engineering/repo-structure.md`](./engineering/repo-structure.md), [`brain/engineering/ai-rules.md`](./engineering/ai-rules.md)
- Database: [`brain/database/schema.md`](./database/schema.md), [`brain/database/relationships.md`](./database/relationships.md), [`brain/database/migrations.md`](./database/migrations.md)
- API: [`brain/api/endpoints.md`](./api/endpoints.md), [`brain/api/contracts.md`](./api/contracts.md), [`brain/api/permissions.md`](./api/permissions.md)
- Features: [`brain/features/books.md`](./features/books.md), [`brain/features/audio.md`](./features/audio.md), [`brain/features/blog.md`](./features/blog.md)
- UX: [`brain/engineering/design-language.md`](./engineering/design-language.md)
- Tasks: [`brain/tasks/backlog.md`](./tasks/backlog.md), [`brain/tasks/in-progress.md`](./tasks/in-progress.md), [`brain/tasks/done.md`](./tasks/done.md), [`brain/tasks/roadmap.md`](./tasks/roadmap.md)
- Reusable templates: [`brain/templates/feature.md`](./templates/feature.md), [`brain/templates/adr.md`](./templates/adr.md), [`brain/templates/bug.md`](./templates/bug.md)

### Current Snapshot
- Product: Islamic content and learning platform with Telegram-inspired content ingestion and reading/listening flows.
- Platforms: Expo mobile app, Next.js web app, Hono/tRPC API, Prisma/PostgreSQL data layer.
- Repo style: Bun workspaces + Turborepo monorepo with shared packages for auth, db, UI, utils, Telegram integration, and jobs.
- Canonical source: keep project memory in `brain/`; `CLAUDE.md` is only a pointer to Brain.
