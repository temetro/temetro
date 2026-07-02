#!/usr/bin/env node
// Locale parity check: every locale under lib/i18n/locales must have the same set
// of logical keys as English, with matching {{interpolation}} placeholders.
//
// "Logical key" collapses i18next plural suffixes: `foo`, `foo_one`, `foo_other`,
// `foo_zero`, `foo_two`, `foo_few`, `foo_many` all map to the logical key `foo`.
// This lets Arabic carry six CLDR plural forms where English has two, without the
// check flagging a mismatch.
//
// Exit code is non-zero if any locale is missing/extra keys or has a placeholder
// mismatch. Arabic count-keys missing the full six CLDR forms are warnings only.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, "..", "lib", "i18n", "locales");
const REFERENCE = "en";
const PLURAL_SUFFIXES = ["zero", "one", "two", "few", "many", "other"];
const AR_REQUIRED = ["zero", "one", "two", "few", "many", "other"];

/** Flatten a nested object into dotted paths → string values. */
function flatten(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out[path] = value;
    }
  }
  return out;
}

/** Strip a trailing i18next plural suffix, returning [logicalKey, suffix|null]. */
function splitPlural(path) {
  for (const suffix of PLURAL_SUFFIXES) {
    if (path.endsWith(`_${suffix}`)) {
      return [path.slice(0, -(suffix.length + 1)), suffix];
    }
  }
  return [path, null];
}

/** All {{placeholder}} names in a string, sorted and de-duplicated. */
function placeholders(value) {
  if (typeof value !== "string") return [];
  const found = new Set();
  for (const match of value.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) {
    found.add(match[1]);
  }
  return [...found].sort();
}

function logicalKeys(flat) {
  // logicalKey → { suffixes: Set, placeholders: string[] }
  const map = new Map();
  for (const [path, value] of Object.entries(flat)) {
    const [logical, suffix] = splitPlural(path);
    const entry = map.get(logical) ?? { suffixes: new Set(), placeholders: [] };
    if (suffix) entry.suffixes.add(suffix);
    // Placeholders should be identical across plural forms; take the richest set.
    const ph = placeholders(value);
    if (ph.length > entry.placeholders.length) entry.placeholders = ph;
    map.set(logical, entry);
  }
  return map;
}

const load = (lng) =>
  JSON.parse(readFileSync(join(localesDir, lng, "translation.json"), "utf8"));

const reference = logicalKeys(flatten(load(REFERENCE)));
const locales = readdirSync(localesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== REFERENCE)
  .map((d) => d.name);

let hadError = false;

for (const lng of locales) {
  const flat = flatten(load(lng));
  const keys = logicalKeys(flat);
  const errors = [];
  const warnings = [];

  for (const [key, ref] of reference) {
    if (!keys.has(key)) {
      errors.push(`missing key: ${key}`);
      continue;
    }
    const got = keys.get(key);
    const refPh = ref.placeholders.join(",");
    const gotPh = got.placeholders.join(",");
    if (refPh !== gotPh) {
      errors.push(`placeholder mismatch at ${key}: en[${refPh}] vs ${lng}[${gotPh}]`);
    }
    if (lng === "ar" && ref.suffixes.size > 0) {
      const missing = AR_REQUIRED.filter((s) => !got.suffixes.has(s));
      if (missing.length) {
        warnings.push(`ar plural ${key} missing CLDR forms: ${missing.join(", ")}`);
      }
    }
  }
  for (const key of keys.keys()) {
    if (!reference.has(key)) errors.push(`extra key not in en: ${key}`);
  }

  if (errors.length) {
    hadError = true;
    console.error(`\n✖ ${lng}: ${errors.length} error(s)`);
    for (const e of errors) console.error(`  - ${e}`);
  } else {
    console.log(`✔ ${lng}: parity OK (${reference.size} keys)`);
  }
  for (const w of warnings) console.warn(`  ⚠ ${w}`);
}

process.exit(hadError ? 1 : 0);
