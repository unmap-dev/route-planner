# Routes: a delivery route planner built with Unmap

A lightweight dispatcher for a small delivery business: one van leaves a warehouse, visits up to
eight customers and comes back. Plan the round on a live Unmap map, add stops by searching for
them, reorder them, let Unmap optimize the order and compare it with yours, read an estimated
arrival schedule, and play a simulated courier through the day. Part of the
[Unmap demo suite](https://unmap.dev/demos); live at
[apps.unmap.dev/routes](https://apps.unmap.dev/routes).

The round belongs to **Chinook Parcel Co., a fictional courier in Calgary**. The company, the
customers, their addresses, notes and service times are sample data, and the courier is a
simulation (see [`DATA_SOURCES.md`](DATA_SOURCES.md)). The map, the routes, the drive times, the
optimized order, the drive-time matrix and the search are live Unmap. What each feature uses, and
what the API guarantees, is in [`FEATURES.md`](FEATURES.md).

## Run it

You need Node 24, pnpm and a free Unmap browser key from
[unmap.dev/dashboard](https://unmap.dev/dashboard).

```bash
cp .env.example .env.local      # then set NEXT_PUBLIC_UNMAP_KEY
pnpm install
pnpm dev                        # http://localhost:3202
```

Without a key the app still shows the plan and says how to get one; it never calls the API with a
missing key.

| Command | |
| --- | --- |
| `pnpm dev` | development server on port 3202 |
| `pnpm build` | static export in `out/` |
| `pnpm test` | unit and component tests (Vitest) |
| `pnpm lint` / `pnpm typecheck` | |
| `pnpm deploy` | build, then `wrangler deploy` to your Cloudflare account (edit `wrangler.jsonc` first) |

The key ships in the browser bundle. Restrict it to your origins (`http://localhost:3202` and your
domain) in the dashboard. Any static host works: `out/` is plain files.

### What it costs in API calls

Loading the sample round makes one `/route` call per leg (eight). Reordering asks only for legs it
has not seen; switching language asks for nothing new. Optimizing is one `/optimized-route` call,
only when you press the button. The drive-time table is one `/matrix` call, only when you open it.
Directions are one `/route` call per leg and language, only when you open them. Search is debounced
and cancels stale requests. The simulation calls nothing.

### When optimization is switched off

`/optimized-route` sits behind a per-deployment flag. Where it is off the API answers `404`; the
app keeps your order, says optimization is not available, and stops asking. Nothing is ever labelled
"Optimized by Unmap" unless that order came back from the API.

## Use your own round

Replace [`data/route.sample.json`](data/route.sample.json) with your own plan:

```jsonc
{
  "company": "Your company",
  "vehicle": { "en": "Van 1", "fr": "Fourgon 1" },
  "departAt": "08:30",                       // local time, 24-hour
  "depot": { "id": "depot", "name": "Warehouse", "address": "…", "coordinates": [-114.07, 51.05] },
  "stops": [
    {
      "id": "unique-id",
      "name": "Customer",
      "address": "…",
      "coordinates": [-114.1, 51.04],        // [longitude, latitude], WGS84
      "serviceMinutes": 6,                   // time on site
      "note": { "en": "…", "fr": "…" }       // optional
    }
  ]
}
```

At most eight stops: `/optimized-route` takes ten points and the depot is sent twice (first and
last). `parsePlan()` in `lib/plan.ts` validates the file and lists every problem it finds. Then
update the `sample` entry in `lib/manifest.ts` and `DATA_SOURCES.md`, since your data is no longer a
sample. To track real vehicles, replace the simulated clock in `hooks/use-simulation.ts` with your
fleet's positions and drop the "Simulated" labels only for what is then live.

## How it is built

```
app/page.tsx                 the one page; renders the app in the browser
components/routes/           the app: plan card, comparison, simulation controls, stop list, map,
                             add-stop search, directions, drive-time matrix
components/ui/  lib/map-*    Unmap registry items and shadcn primitives, copied in unmodified
lib/kit/                     the Unmap demo kit (header, Built with Unmap panel, errors, en/fr), copied in
hooks/                       React hooks: route legs, optimization, matrix, directions, simulation clock
lib/plan.ts                  the plan model: validation, reorder/add/remove, applying an optimized order
lib/legs.ts  lib/schedule.ts the route as legs, totals, warnings placed on stops; the arrival schedule
lib/simulation.ts            the courier: a timeline of drives and stops, position along a LineString
lib/compare.ts lib/matrix.ts your order against Unmap's; matrix cells with null kept as a gap
lib/manifest.ts              what the Built with Unmap panel lists
lib/text.ts                  this app's words in English and French
data/route.sample.json       the sample round
```

Layers run one way: components → hooks → `lib/` (plain TypeScript, no React, no fetch,
unit-tested) → `@unmap/sdk`, the only thing that talks to the API (the registry `geocoder` uses
`@unmap/geocoding`, the same client the SDK wraps). The map, pins, route line, directions and
search are Unmap registry items; install them in your own project with
`npx @unmap/cli add map marker-popup map-controls route-line route-steps geocoder`.

In the Unmap monorepo the copied files are kept in step by `pnpm sync` and `test/sync.test.ts`; in
your own copy they are ordinary source you can edit.

## Deploy

`pnpm deploy` builds the static export and uploads it as an assets-only Cloudflare Worker named in
`wrangler.jsonc`. Set `NEXT_PUBLIC_UNMAP_KEY` at build time. To serve it under a path, set
`BASE_PATH` (for example `/routes`) for the build.

## Licence

Code: MIT. The sample data is fictional and free to reuse. Map and routing data © OpenStreetMap
contributors (ODbL), served by Unmap.
