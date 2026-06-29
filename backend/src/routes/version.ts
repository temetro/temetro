// GET /api/version — reports the running version and whether a newer image is
// available. The latest version is read from Docker Hub (the actual update
// channel: clinics run `docker compose pull`), falling back to the GitHub
// release if Docker Hub's API is unreachable. Public (no PHI); the frontend uses
// it for the Settings "About & Updates" panel and the optional update banner.
import { createRequire } from "node:module";

import { Router } from "express";

import { env } from "../env.js";

const require = createRequire(import.meta.url);
// package.json is the source of truth for the running version (copied into the
// runtime image). APP_VERSION can override it (set by the release pipeline).
const pkg = require("../../package.json") as { version?: string };
const CURRENT = env.APP_VERSION ?? pkg.version ?? "0.0.0";

// The published image whose tags reflect what `docker compose pull` would fetch.
const DOCKERHUB_TAGS_URL =
  "https://hub.docker.com/v2/repositories/khalidxv/temetro-backend/tags?page_size=100";
// GitHub release of a given version — used for the human-readable "what's new"
// link, and as a fallback source for the latest version.
const GITHUB_LATEST_RELEASE_URL =
  "https://api.github.com/repos/temetro/temetro/releases/latest";
const releaseUrlFor = (version: string) =>
  `https://github.com/temetro/temetro/releases/tag/v${version}`;

const CACHE_TTL = 60 * 60 * 1000; // 1h — surface a new release reasonably fast.
const ERROR_TTL = 10 * 60 * 1000; // back off ~10m after a failed lookup.

type LatestInfo = { latest: string | null; releaseUrl: string | null };
let cache: { at: number; ttl: number; info: LatestInfo } | null = null;

function parseSemver(v: string): [number, number, number] | null {
  const m = v.trim().replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** True if `latest` is a strictly newer semver than `current`. */
function isNewer(latest: string, current: string): boolean {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i]! > b[i]!) return true;
    if (a[i]! < b[i]!) return false;
  }
  return false;
}

// Highest strict X.Y.Z tag in the list (ignores `latest` and any non-semver).
function maxSemver(versions: string[]): string | null {
  let best: string | null = null;
  for (const v of versions) {
    if (parseSemver(v) && (best === null || isNewer(v, best))) best = v;
  }
  return best;
}

// Primary source: the published Docker Hub image tags.
async function fetchFromDockerHub(): Promise<string | null> {
  const res = await fetch(DOCKERHUB_TAGS_URL, {
    headers: { Accept: "application/json", "User-Agent": "temetro" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Docker Hub responded ${res.status}`);
  const body = (await res.json()) as { results?: Array<{ name?: string }> };
  const names = (body.results ?? [])
    .map((r) => r.name)
    .filter((n): n is string => typeof n === "string");
  return maxSemver(names);
}

// Fallback source: the latest GitHub release tag (used if Docker Hub is blocked).
async function fetchFromGitHub(): Promise<string | null> {
  const res = await fetch(GITHUB_LATEST_RELEASE_URL, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "temetro" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  const body = (await res.json()) as { tag_name?: string };
  return body.tag_name ? body.tag_name.replace(/^v/, "") : null;
}

async function fetchLatest(force = false): Promise<LatestInfo> {
  if (!force && cache && Date.now() - cache.at < cache.ttl) return cache.info;
  try {
    let latest: string | null = null;
    try {
      latest = await fetchFromDockerHub();
    } catch {
      latest = await fetchFromGitHub();
    }
    const info: LatestInfo = {
      latest,
      releaseUrl: latest ? releaseUrlFor(latest) : null,
    };
    cache = { at: Date.now(), ttl: CACHE_TTL, info };
    return info;
  } catch {
    // Fail soft: keep any prior value, briefly cache the miss to avoid hammering.
    const info: LatestInfo = cache?.info ?? { latest: null, releaseUrl: null };
    cache = { at: Date.now(), ttl: ERROR_TTL, info };
    return info;
  }
}

const router = Router();

router.get("/", async (req, res) => {
  // `?refresh=1` powers the "Check for updates" button — bypass the cache.
  const force = req.query.refresh === "1" || req.query.refresh === "true";
  const { latest, releaseUrl } = await fetchLatest(force);
  res.json({
    current: CURRENT,
    latest,
    updateAvailable: latest ? isNewer(latest, CURRENT) : false,
    releaseUrl,
  });
});

export const versionRouter = router;
