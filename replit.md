# MessMate

A student-facing mobile app for rating hostel mess meals in a few taps.

## Run & Operate

- Managed workflow `artifacts/api-server: API Server` — API scaffold (currently unused by the student flow)
- Managed workflow `artifacts/messmate-mobile: expo` — mobile preview
- `pnpm --filter @workspace/messmate-mobile run typecheck` — check the student app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- The student flow has no required backend or database configuration yet.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Student flow: `artifacts/messmate-mobile/app/(tabs)/index.tsx`
- Mobile theme: `artifacts/messmate-mobile/constants/colors.ts`
- Mobile icon: `artifacts/messmate-mobile/assets/images/icon.png`

## Architecture decisions

- The first release is intentionally student-only. Manager sign-in is informational; there is no manager app yet.
- Submissions and same-day meal limits are kept on the device with AsyncStorage. Offline submissions are also kept in a separate queue for future delivery; no server sync exists yet.
- The supplied rating brief referenced CSS that was not attached, so the native app uses animated SVG face controls instead.

## Product

Students choose a meal, tap a face rating, optionally select quick tags or add a short comment, and save anonymous feedback. Positive ratings get a celebratory thank-you screen.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
