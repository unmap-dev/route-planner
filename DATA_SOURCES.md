# Data sources

Everything on screen, where it comes from, and how far to trust it.

| What | Source | Licence | Live? |
| --- | --- | --- | --- |
| Basemap (streets, labels, water, parks) | Unmap Maps API, built from OpenStreetMap | ODbL, © OpenStreetMap contributors | Live |
| Route lines, distances, drive times, turn-by-turn directions, route warnings | Unmap Routing API (`/route`), Valhalla over the Canadian OpenStreetMap graph | ODbL, © OpenStreetMap contributors | Live |
| Optimized stop order and its tour distance and time | Unmap Routing API (`/optimized-route`) | ODbL, © OpenStreetMap contributors | Live |
| Drive times between every pair of stops | Unmap Routing API (`/matrix`) | ODbL, © OpenStreetMap contributors | Live |
| Search results when adding a stop | Unmap Geocoding API (`/geocode/autocomplete`) | the sources the Geocoding API credits | Live |
| Company, depot, customer names, addresses, delivery notes, service times, departure time | **Sample data**, invented for this demo: `data/route.sample.json` | Free to reuse | No |
| The courier's position and each stop's job state | **Simulated** in the browser from the live route geometry and drive times | — | No |

## The sample round

Chinook Parcel Co. is a **fictional** courier with one van. Its warehouse and its seven customers
are placed at approximate points on real Calgary streets so that routing has something real to work
with, but:

- the business and every customer name are invented, and none of the customers exist;
- the street addresses are approximate, and the coordinates may sit mid-block or across the street
  from the address;
- the service times (4 to 10 minutes on site) and the 08:30 departure are invented, chosen to look
  like a small parcel round;
- the delivery notes are invented.

The app labels this as sample data wherever it is shown (the header, the plan card, each stop's
service time and note, and the Built with Unmap panel). Unmap supplies no business, customer or
delivery data.

## The simulation

The courier is a playback, not tracking. It leaves the depot at the planned time, follows each
leg's route geometry from Unmap at a constant speed that makes the leg take exactly Unmap's drive
time, waits each stop's sample service time, and returns. It does not use GPS, does not know about
traffic, and does not report anything anywhere. It is labelled "Simulated" where it is seen.

## Accuracy and limitations

- **Drive times are free-flow estimates.** The routing graph carries no live or predicted traffic,
  so neither the schedule nor the simulation should be read as a promise of an arrival time.
- **Canada only.** Routing and search cover Canada; a stop outside it is refused by the API
  (`422 outside_coverage`) and shown as such. Inside Canada, a place with no road connection (such
  as Iqaluit from Calgary) is `422 no_route`, shown on the stop.
- **Endpoint relocation.** When a stop is off the road network, the engine moves it to the nearest
  road it can use; the API reports `ENDPOINT_RELOCATED` past 250 m and the app shows it on the stop.
- **Closure warnings** cover Ontario, Alberta and British Columbia, where authoritative feeds exist;
  no closure warning elsewhere means nothing was checked, not that nothing is closed.
- **Two ways to total a round.** "Your order" sums one `/route` per leg; "Optimized by Unmap" is the
  tour total `/optimized-route` returned. They are computed separately, so small differences can
  come from that alone; the app only calls a difference a saving when it is larger than that.
- **A blank matrix cell** means the engine gave no answer for that pair, not that no road exists.
