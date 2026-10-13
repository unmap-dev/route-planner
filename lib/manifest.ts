import type { DemoManifest } from "@/lib/kit/provenance";

/**
 * What the "Built with Unmap" panel and the header say about Routes. Lists only what the app really
 * calls; a service is added here in the same change that starts calling it.
 */
export const MANIFEST: DemoManifest = {
  slug: "routes",
  name: { en: "Routes · delivery planner", fr: "Routes · planificateur de livraisons" },
  tagline: {
    en: "Plan, optimize and play back a day of deliveries, with live Unmap routing.",
    fr: "Planifiez, optimisez et rejouez une journée de livraisons, avec les itinéraires Unmap en direct.",
  },
  services: [
    {
      name: "Maps",
      role: {
        en: "The basemap under the round: vector tiles and the base style, with labels in the page's language.",
        fr: "La carte de base sous la tournée : tuiles vectorielles et style de base, étiquettes dans la langue de la page.",
      },
      calls: ['<Map apiKey={key} style="base" lang={lang} />'],
      docs: "https://unmap.dev/docs/apis/maps",
    },
    {
      name: "Routing",
      role: {
        en: "One route per leg (depot → stops → depot): the line on the map, the distance and drive time, the arrival schedule and the courier's path. Directions on request, in English or French.",
        fr: "Un itinéraire par tronçon (entrepôt → arrêts → entrepôt) : le tracé, la distance et le temps de route, l'horaire d'arrivée et le trajet du livreur. Indications sur demande, en anglais ou en français.",
      },
      calls: ["unmap.router.route(from, to, { mode: \"auto\", signal })", "unmap.router.route(from, to, { steps: true, lang })"],
      docs: "https://unmap.dev/docs/apis/routing#route",
    },
    {
      name: "Route optimization",
      role: {
        en: "Reorders the stops between the fixed depot ends and returns the tour's distance and time, compared with your order.",
        fr: "Réordonne les arrêts entre les deux passages fixes à l'entrepôt et renvoie la distance et la durée de la tournée, comparées à votre ordre.",
      },
      calls: ["unmap.router.optimize([depot, ...stops, depot], { mode: \"auto\" })"],
      docs: "https://unmap.dev/docs/apis/routing#optimize",
    },
    {
      name: "Matrix",
      role: {
        en: "Drive times between every pair of points in the round, on request, with unanswered pairs shown as gaps.",
        fr: "Temps de route entre chaque paire de points de la tournée, sur demande, les paires sans réponse affichées comme des vides.",
      },
      calls: ["unmap.router.matrix(points, points, { mode: \"auto\" })"],
      docs: "https://unmap.dev/docs/apis/routing#matrix",
    },
    {
      name: "Geocoding",
      role: {
        en: "Search-as-you-type to add a stop by address or place name, anywhere in Canada.",
        fr: "Recherche à la saisie pour ajouter un arrêt par adresse ou nom de lieu, partout au Canada.",
      },
      calls: ['<Geocoder apiKey={key} proximity={[-114.07, 51.05]} />  // geocoder.autocomplete(q, { focus })'],
      docs: "https://unmap.dev/docs/apis/geocoding",
    },
  ],
  items: ["map", "marker-popup", "map-controls", "route-line", "route-steps", "geocoder"],
  provenance: [
    {
      kind: "sample",
      label: {
        en: "Chinook Parcel Co.: the depot, customer names, addresses, notes, service times and departure time",
        fr: "Chinook Parcel Co. : l'entrepôt, les noms des clients, les adresses, les notes, les temps de service et l'heure de départ",
      },
      source: "Fictional, written for this demo (data/route.sample.json)",
    },
    {
      kind: "simulated",
      label: {
        en: "The courier's position and each job's state (pending, in progress, completed)",
        fr: "La position du livreur et l'état de chaque livraison (en attente, en cours, terminé)",
      },
      source: "Played back in the browser from Unmap's route geometry and drive times",
    },
    {
      kind: "live",
      label: { en: "Basemap, routes, drive times, optimized order, matrix, search results", fr: "Carte de base, itinéraires, temps de route, ordre optimisé, matrice, résultats de recherche" },
      source: "Unmap",
      attribution: "© unmap © OpenStreetMap contributors",
    },
  ],
  source: "https://github.com/unmap-dev/route-planner",
};
