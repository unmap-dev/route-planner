# Features

What Delivery Route Planner does, which Unmap API does it, what the API itself guarantees, and what the app
deliberately does not do.

## Implemented

| Feature | How | Unmap |
| --- | --- | --- |
| Map of the depot, numbered stops and the route | registry `map`, `marker-popup` pins (coloured by job state), `route-line`; one line when every leg answered, each answered leg on its own otherwise, so a failed leg is a gap and never a straight line | Maps API (`/styles`, `/tiles`) |
| Route and summary distance and drive time | one `unmap.router.route(from, to)` per leg (depot → stop 1 → … → depot), summed; each leg is asked for once and kept, so a reorder asks only for new legs; legs no longer in the plan are cancelled | Routing `GET /route` |
| Editable stop list | remove, move earlier/later with buttons (no drag; focus follows the moved stop), at most eight stops | — |
| Add a stop by search | registry `geocoder` (debounced, cancels stale searches, Combobox keyboard support), results preferred near Calgary, any Canadian place accepted | Geocoding `GET /geocode/autocomplete` |
| Optimize stop order | `unmap.router.optimize([depot, ...stops, depot])`; the depot is the fixed first and last stop; asked only on the button, once per sequence | Optimization `POST /optimized-route` |
| Compare your order with Unmap's | both totals side by side, the optimized sequence in your stop numbers, a saving only when it is larger than the two calculations could differ by; "Optimized by Unmap" only when the order on screen is the one the API returned, "Your order" after any manual edit | `/route` legs vs `/optimized-route` total |
| Optimization switched off | a `404 not_found` from `/optimized-route` keeps the supplied order, explains why, and stops asking | — |
| Estimated arrival schedule | departure (sample, 08:30) + each leg's `/route` drive time + each stop's sample service time; stops estimating after a leg with no answer instead of guessing | Routing (`durationSeconds` per leg) |
| Job state per stop | pending → in progress (from leaving for it to the end of its service time) → completed, driven by the simulation | — (simulated) |
| Simulated courier | play, pause, next stop, reset, 60×/120×/300×; moves along the legs' own geometry by distance at each leg's drive time and waits each stop's service time; labelled "Simulated", "Not GPS, not live tracking"; under `prefers-reduced-motion` it moves a simulated minute at a time and the camera never animates | — (simulated from Routing output) |
| Route warnings | `ENDPOINT_RELOCATED` shown on the stop it concerns, once (both legs that meet there report it), with the distance moved and the API's own message; closure warnings likewise | Routing `warnings` |
| Invalid and unreachable stops | a leg's `422 no_route` on the stop it arrives at ("No road route", with the gateway's message); other failures (`422 outside_coverage`, `403`, `429`, `5xx`, network) through the kit's `ApiProblemAlert`; the summary says how many legs failed and offers a retry; the simulation waits for a complete route | Routing errors |
| Drive times between stops | a table from one matrix call over the depot and every stop, loaded only when opened, once per set of points; a `null` cell is shown as a gap with a note that it is not proof there is no road | Matrix `POST /matrix` |
| Turn-by-turn directions | per leg, on request, in the page's language, through the registry `route-steps` item (hover or focus a step to highlight it, Enter to frame it) | Routing `GET /route?steps=true&lang=` |
| English and French | the header switch and `?lang=fr`; map labels, search results and directions follow | Maps `lang`, Geocoding `lang`, Routing `lang` |
| No-key state | lists the plan and explains how to get a key; calls nothing | — |
| Built with Unmap | the services, the SDK calls, the registry items and every non-live thing on screen | — |

## API facts this app is built on

Verified in the source on 2026-10-12 (the sandbox this was built in cannot reach `api.unmap.dev`,
so none of it was exercised live here; the end-to-end tests mock the gateway with responses shaped
by the types and code below).

### `GET /route`

- Exactly two points, `from` and `to`; there are no via points
  (`apps/web/content/docs/apis/routing.mdx`, "Route"; `Router.route` in
  `packages/routing/src/index.ts:763`). A multi-stop round is therefore one request per leg.
- Returns `RouteResult`: `distanceMeters`, `durationSeconds`, `geometry` (a GeoJSON `LineString`),
  `warnings?`, and `steps?` with `steps: true` (`packages/routing/src/index.ts:458`).
- `steps: true` with `lang` (`en` or `fr`, French from Valhalla's `fr-FR` locale) adds written
  turn-by-turn steps; `lang` without `steps` is a `400` (`StepOptions`, `packages/routing/src/index.ts:163`;
  `docs/services/routing.md`, "Turn-by-turn steps").
- `warnings` is absent when empty. `ENDPOINT_RELOCATED` (`where: "origin" | "destination"`) is
  reported on every mode when the engine moved an endpoint more than 250 m to reach a road
  (`ENDPOINT_RELOCATION_LIMIT_METRES`, `apps/gateway/src/route-relocation.ts:49`; attached in
  `withCompliance`, `apps/gateway/src/routing/service.ts`). `CLOSURE_IN_FORCE_NEAR_ROUTE` /
  `CLOSURE_SCHEDULED_NEAR_ROUTE` (`where: "route"`) cover Ontario, Alberta and British Columbia
  only (`RouteWarning`, `packages/routing/src/index.ts:395`). Branch on `code`; the message may be
  reworded, which is why the app shows it as sent and parses only the distance, falling back to
  the bare message.
- Free-flow drive times: there is no live or predicted traffic anywhere in the routing API.

### `POST /optimized-route`

- `unmap.router.optimize(stops, opts)` (`packages/routing/src/index.ts:866`). Body `{ stops, mode,
  … }`; at least 3 and at most 10 stops (`MIN_OPTIMIZE_STOPS`, `MAX_OPTIMIZE_STOPS`,
  `apps/gateway/src/routing/service.ts:206-207`): fewer is `400 invalid_location`, more is
  `400 too_many_locations`.
- **The first and last stop are fixed**; only the stops between are reordered. There is no
  round-trip or open-route option (`optimizedRouteRequestBody`, `apps/gateway/src/routing/valhalla.ts`).
  The app sends the depot twice, so seven or eight customer stops fit.
- Returns `OptimizedRouteResult` = `RouteResult` + `order`, the request's indices in visiting
  order, always a permutation (`packages/routing/src/index.ts:691`). The gateway refuses (`502
  upstream_error`) rather than invent an order when the engine's answer is not one
  (`toOptimizedRouteResult`, `apps/gateway/src/routing/valhalla.ts:1196`). It carries no per-leg
  durations and no `warnings` (the relocation check runs on `/route` only), which is one reason the
  app routes the applied order leg by leg.
- A stop the others cannot reach, or a set wider than the engine's straight-line limit, fails the
  whole request: `422 no_route`, "no optimized route: a stop is unreachable or beyond the engine's
  distance limit". A stop outside Canada is `422 outside_coverage` first. A `null` in the
  underlying matrix does not fail the tour (`docs/services/routing.md`, "Optimize").
- **Feature flag.** The route is always mounted but answers `404` with the gateway's
  `{ "error": "no such endpoint…", "code": "not_found" }` when `OPTIMIZE_ENABLED` is unset
  (`apps/gateway/src/index.ts:2735`, the `notFound` handler at `:248`). **In production it is
  set: `"OPTIMIZE_ENABLED": "1"` in `apps/gateway/wrangler.jsonc:227`** (set on 2026-09-17 per
  `docs/services/routing.md`, "Matrix, match and optimize are flag-gated"). The public page
  `apps/web/content/docs/apis/routing.mdx` ("Optimize") still says "Rolling out … answers 404 until
  the founder enables it", which is stale. The app handles the `404` either way.
- A different "Unmap Optimize" API (PR #360) is not used; this app uses `/optimized-route`
  through `@unmap/sdk` only.

### `POST /matrix`

- `unmap.router.matrix(origins, destinations)` (`packages/routing/src/index.ts:836`): at most 10
  origins and 10 destinations (`MAX_MATRIX_ORIGINS`, `MAX_MATRIX_DESTINATIONS`,
  `apps/gateway/src/routing/service.ts:186-187`). The app sends the depot and every stop, at most
  nine.
- Returns `{ durations, distances }`, seconds and metres, rows are origins
  (`MatrixResult`, `packages/routing/src/index.ts:678`). **A `null` cell is a real answer**: a
  pair the engine could not connect is nulled in place; it is never proof there is no road (every
  null probed so far was a pair `/route` answers). A `0` is real (the diagonal).
- Whole-request failures: `400 invalid_location`, `422 outside_coverage`, `422 no_route` (a
  location with no road near it, a set the network does not connect, or a pair beyond the
  straight-line limit).
- Behind `MATRIX_ENABLED`, also set in production (`apps/gateway/wrangler.jsonc:217`).

### Errors, retries, metering

- Every error body is `{ error, code }`; the SDK throws a `RouterError` / `UnmapError` with
  `status`, `code` and the gateway's sentence in `message` (`errorFrom`, `packages/routing/src/index.ts`).
- Routing codes: `invalid_location` 400, `invalid_mode` 400, `invalid_route_option` 400,
  `invalid_body` 400, `too_many_locations` 400, `outside_coverage` 422, `no_route` 422,
  `upstream_error` 502, `service_unavailable` 503 (`docs/services/routing.md`, error table).
- The SDK retries `429`, `502`, `503` and transport failures on its own (`fetchWithRetry`,
  `packages/core/src/http.ts:96`); the app's "Try again" is the user's, never automatic.
- Each `/route`, `/matrix` and `/optimized-route` call meters as one routing call. A sample round
  costs 8 `/route` calls on load; a reorder costs only the new legs.

### Why the schedule uses `/route` legs, not the matrix

Both could give a leg's drive time. The schedule and the simulated courier need the leg's geometry
as well, which only `/route` returns, and they need the exact legs drawn on the map. The matrix is
kept for what it is good at: every pair at once, on request.

## Not goals

Multi-vehicle dispatch, time windows, vehicle capacity, real fleet telemetry or GPS, traffic
prediction or any real-time traffic claim, proof of delivery, saving plans or a fleet-management
backend (spec §5). The courier is a simulation and says so. The business data is a sample and says
so.

## Registry candidates

Built here as app code because the registry has no item for them yet (not edited in this change):

- Multi-stop playback along a route: `lib/simulation.ts` (timeline of drive and service segments,
  position by distance along a `LineString`, job states, reduced-motion stepping). The
  `delivery-tracker` block plays back one leg; a `route-playback` lib item could serve both.
- A stop-sequence list with keyboard reordering and focus that follows the moved item
  (`components/routes/stop-list.tsx`), and the leg-by-leg routing hook with per-leg caching and
  cancellation (`hooks/use-route-legs.ts`).
- A matrix table that renders `null` cells honestly (`components/routes/matrix-card.tsx`).
- In the app kit: a `no-route` problem kind. `describeError` reads every `422` as "outside
  coverage", which is wrong for `no_route`; `components/routes/route-problem.tsx` works around it.
