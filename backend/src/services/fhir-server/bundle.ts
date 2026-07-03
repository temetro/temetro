import type { FhirResource } from "./resources.js";

// searchset Bundle assembly + offset/limit pagination for the FHIR server.

export const DEFAULT_COUNT = 50;
export const MAX_COUNT = 200;

// Clamp a client-supplied `_count` into [1, MAX_COUNT], defaulting when absent.
export function parseCount(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_COUNT;
  return Math.min(Math.floor(n), MAX_COUNT);
}

export function parseOffset(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

// Slice an already-materialized resource array to the requested page.
export function paginate<T>(
  all: T[],
  count: number,
  offset: number,
): { page: T[]; total: number } {
  return { page: all.slice(offset, offset + count), total: all.length };
}

export type SearchsetBundle = {
  resourceType: "Bundle";
  type: "searchset";
  total: number;
  link: { relation: string; url: string }[];
  entry: { fullUrl: string; resource: FhirResource; search: { mode: "match" } }[];
};

// Build a FHIR searchset Bundle. `page` is the current slice; `total` the full
// match count; `params` the effective query (already carrying `_count`/`_offset`)
// used to derive self/next/prev links.
export function searchsetBundle(opts: {
  baseUrl: string; // e.g. https://host/fhir
  resourceType: string;
  page: FhirResource[];
  total: number;
  count: number;
  offset: number;
  params: URLSearchParams;
}): SearchsetBundle {
  const { baseUrl, resourceType, page, total, count, offset, params } = opts;

  const linkFor = (nextOffset: number): string => {
    const q = new URLSearchParams(params);
    q.set("_count", String(count));
    q.set("_offset", String(nextOffset));
    return `${baseUrl}/${resourceType}?${q.toString()}`;
  };

  const link: { relation: string; url: string }[] = [
    { relation: "self", url: linkFor(offset) },
  ];
  if (offset + count < total) link.push({ relation: "next", url: linkFor(offset + count) });
  if (offset > 0)
    link.push({ relation: "previous", url: linkFor(Math.max(0, offset - count)) });

  return {
    resourceType: "Bundle",
    type: "searchset",
    total,
    link,
    entry: page.map((resource) => ({
      fullUrl: `${baseUrl}/${resource.resourceType}/${resource.id}`,
      resource,
      search: { mode: "match" },
    })),
  };
}
