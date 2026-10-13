"use client";

import type { GeocodeResult } from "@unmap/sdk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Geocoder } from "@/components/ui/geocoder";
import { API_KEY, GATEWAY } from "@/lib/kit/config";
import { format, type Lang } from "@/lib/kit/i18n";
import { DEFAULT_SERVICE_SECONDS, MAX_STOPS, type Stop } from "@/lib/plan";
import { TEXT } from "@/lib/text";

/** Downtown Calgary: search prefers places near it, and still finds anywhere in Canada. */
const NEAR: [number, number] = [-114.07, 51.05];

/** A search result as a stop, with the default sample service time. */
export function stopFromResult(result: GeocodeResult): Stop {
  const a = result.address;
  const street = [a?.housenumber, a?.street].filter(Boolean).join(" ");
  const address = [street, a?.city, a?.region].filter(Boolean).join(", ");
  return {
    id: `geo-${result.id}`,
    name: result.name,
    address: address || `${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}`,
    coordinates: [result.lng, result.lat],
    serviceSeconds: DEFAULT_SERVICE_SECONDS,
    added: true,
  };
}

/**
 * Add a stop by searching for it: the registry `geocoder` (debounced, cancels stale searches,
 * keyboard and screen-reader friendly through shadcn's Combobox). Refuses past eight stops.
 */
export function AddStop({ count, notice, onAdd, lang }: { count: number; notice: "full" | "duplicate" | null; onAdd: (result: GeocodeResult) => void; lang: Lang }) {
  const t = TEXT[lang];
  const full = count >= MAX_STOPS;
  return (
    <Card size="sm" data-add-stop="">
      <CardHeader>
        <CardTitle>{t.addTitle}</CardTitle>
        <CardDescription>{full ? t.full : format(t.addHint, { min: DEFAULT_SERVICE_SECONDS / 60 })}</CardDescription>
      </CardHeader>
      {full ? null : (
        <CardContent className="flex flex-col gap-2">
          <Geocoder apiKey={API_KEY} gateway={GATEWAY} lang={lang} placeholder={t.addPlaceholder} proximity={NEAR} flyToZoom={13} onSelect={onAdd} />
          {notice === "duplicate" ? (
            <p role="status" className="text-xs text-destructive">
              {t.duplicate}
            </p>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}
