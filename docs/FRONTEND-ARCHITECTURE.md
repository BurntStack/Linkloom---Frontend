# Frontend architecture

The frontend is a multi-page Vite application. Each HTML document is a separate app entry point, and the product surfaces share only the API, live-update, vendor, and motion modules that are intentionally common.

## Source layout

```text
src/
  apps/
    brand/       Brand dashboard: screens, session, data adapters, UI, and styles
    creator/     Creator dashboard: screens, core runtime, session, data adapters, and styles
    landing/     Public marketing page and its interactions
    signin/      Shared sign-in flow and handoff helpers
  shared/
    analytics.ts  Vercel Web Analytics initialization for all four pages
    api/         HTTP, authentication, onboarding, uploads, Google, and realtime clients
    live.ts      Shared formatting and live-data helpers
    motion.ts    Shared motion implementation configured by each dashboard shell
    vendor-gsap.ts
```

The HTML files at the repository root are the deployable page shells. `vite.config.ts` lists them as the build inputs and replaces dashboard seed data with empty state in regular builds.

## Dependency direction

- An app may import its own modules and modules from `shared/`.
- `shared/` must not import from `apps/`.
- Cross-app navigation belongs in the shared sign-in handoff, not in another app's screen implementation.
- Screen modules register their route handlers as side effects. Keep the ordered imports in each app's `main.ts` stable unless the registration lifecycle is changed deliberately.
- Use the `@/` alias for app imports that cross several folders; keep nearby feature imports relative.

## Where to make changes

- API contract or transport: `src/shared/api/`
- Shared live data helpers, formatting, or motion: `src/shared/`
- Creator screen or creator runtime: `src/apps/creator/`
- Brand screen or brand runtime: `src/apps/brand/`
- Landing-page content or behavior: `src/apps/landing/`
- Authentication and app handoff: `src/apps/signin/` and `src/shared/api/auth.ts`
- Page shell or build entry: root HTML files and `vite.config.ts`
