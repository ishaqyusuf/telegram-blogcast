# Coding Standards

## Purpose
Defines repository-wide implementation norms so code stays consistent across apps and packages.

## How To Use
- Update when the team agrees on a new code pattern or naming rule.
- Prefer linking to deeper standards if this grows too large.
- Keep rules tied to conventions already visible in the codebase or project docs.

## Template

### General Standards
- Prefer TypeScript across all packages and apps.
- Reuse shared workspace packages before adding duplicate logic.
- Keep domain logic separated from app-specific rendering code.
- Favor typed contracts and schema validation at API boundaries.
- In React Native components, do not mix `className` and `style` on the same element by default. Prefer one styling path per element; only use both when there is a clear platform-specific need and document that exception inline.

### Naming
- File names: `kebab-case`
- Components: `PascalCase`
- Variables/functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Repo Practices
- Preserve existing user changes unless explicitly asked to overwrite them.
- Update Brain docs after meaningful architecture, feature, API, or database changes.
- Add ADRs for major long-term decisions.
