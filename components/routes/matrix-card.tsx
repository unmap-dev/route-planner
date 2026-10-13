"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiProblemAlert } from "@/lib/kit/api-problem";
import { format, formatNumber, type Lang } from "@/lib/kit/i18n";
import { countGaps, matrixCells } from "@/lib/matrix";
import { TEXT } from "@/lib/text";
import type { MatrixState } from "@/hooks/use-matrix";

/**
 * Drive times between every pair of points (`/matrix`), loaded only when opened. The depot is D,
 * the stops are numbered as in the list. A null cell is shown as a gap, labelled, never as a
 * number and never as "unreachable".
 */
export function MatrixCard({ open, onToggle, state, labels, lang }: { open: boolean; onToggle: () => void; state: MatrixState; labels: string[]; lang: Lang }) {
  const t = TEXT[lang];
  const cells = state.status === "ok" ? matrixCells(state.result) : null;
  const gaps = cells ? countGaps(cells) : 0;
  return (
    <Card size="sm" data-matrix="">
      <CardHeader>
        <CardTitle>{t.matrixTitle}</CardTitle>
        <CardDescription>{t.matrixIntro}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button variant="outline" size="sm" className="self-start" aria-expanded={open} onClick={onToggle} disabled={labels.length < 2}>
          {open ? t.matrixHide : t.matrixShow}
        </Button>
        {!open ? null : state.status === "error" ? (
          <ApiProblemAlert error={state.error} lang={lang} />
        ) : !cells ? (
          <p className="flex items-center gap-2 text-sm" role="status">
            <Spinner />
            {t.matrixLoading}
          </p>
        ) : (
          <>
            <Table className="text-xs tabular-nums">
              <TableCaption className="sr-only">{t.matrixCaption}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">
                    <span className="sr-only">{t.matrixFrom}</span>
                  </TableHead>
                  {labels.map((label) => (
                    <TableHead key={label} scope="col" className="text-right">
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cells.map((row, i) => (
                  <TableRow key={labels[i]}>
                    <TableHead scope="row">{labels[i]}</TableHead>
                    {row.map((cell, j) => (
                      <TableCell key={j} className="text-right" data-cell={cell.kind}>
                        {cell.kind === "self" ? (
                          <span className="text-muted-foreground" aria-hidden>
                            ·
                          </span>
                        ) : cell.kind === "none" ? (
                          <span className="text-muted-foreground" title={t.matrixGap}>
                            — <span className="sr-only">{t.matrixGap}</span>
                          </span>
                        ) : (
                          formatNumber(cell.seconds / 60, lang)
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {gaps > 0 ? (
              <p className="text-xs text-muted-foreground" data-matrix-gaps={gaps}>
                {format(t.matrixGaps, { n: gaps })}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
