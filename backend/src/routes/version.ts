// GET /api/version — reports the running version and whether a newer release
// exists on GitHub. Public (no PHI); the frontend uses it for the Settings
// "About & Updates" panel and the optional update banner.
import { createRequire } from "node:module";

import { Router } from "express";

import { env } from "../env.js";

const require = createRequire(import.meta.url);
// package.json is the source of truth for the running version (copied into the
// runtime image). APP_VERSION can override it (set by the release pipeline).
const pkg = require("../../package.json") as { version?: string };
const CURRENT = env.APP_VERSION ?? pkg.version ?? "0.0.0";

const LATEST_RELEASE_URL =
  "https://api.github.com/repos/temetro/temetro/releases/latest";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h — releases are infrequent.
const ERROR_TTL = 10 * 60 * 1000; // back off ~10m after a failed lookup.

type LatestInfo = { latest: string | null; releaseUrl: string | null };
let cache: { at: number; ttl: number; info: LatestInfo } | null = null;

function parseSemver(v: string): [number, number, number] | null {
  const m = v.trim().replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
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

async function fetchLatest(): Promise<LatestInfo> {
  if (cache && Date.now() - cache.at < cache.ttl) return cache.info;
  try {
    const res = await fetch(LATEST_RELEASE_URL, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "temetro" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    const body = (await res.json()) as { tag_name?: string; html_url?: string };
    const info: LatestInfo = {
      latest: body.tag_name ? body.tag_name.replace(/^v/, "") : null,
      releaseUrl: body.html_url ?? null,
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

router.get("/", async (_req, res) => {
  const { latest, releaseUrl } = await fetchLatest();
  res.json({
    current: CURRENT,
    latest,
    updateAvailable: latest ? isNewer(latest, CURRENT) : false,
    releaseUrl,
  });
});

export const versionRouter = router;
