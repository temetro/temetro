// Minimal GS1 Application Identifier parser for medication barcodes (the GS1
// DataMatrix printed on drug packaging). We only care about the AIs a pharmacy
// add-item flow can use: 01 GTIN, 17 expiry, 10 lot/batch, 21 serial. Variable
// -length fields are terminated by the FNC1/GS separator (ASCII 29); the AIs
// below have fixed lengths per the GS1 General Specifications.

export type Gs1Fields = {
  gtin?: string;
  /** AI 17 normalised to YYYY-MM-DD. */
  expiry?: string;
  lot?: string;
  serial?: string;
};

const GS = "\x1d";

// value length (excluding the 2-digit AI) for the fixed-length AIs we handle.
const FIXED_LEN: Record<string, number> = {
  "00": 18,
  "01": 14,
  "02": 14,
  "11": 6,
  "12": 6,
  "13": 6,
  "15": 6,
  "16": 6,
  "17": 6,
  "20": 2,
};

function yymmddToIso(v: string): string | undefined {
  if (!/^\d{6}$/.test(v)) return undefined;
  const year = 2000 + Number(v.slice(0, 2));
  const month = Number(v.slice(2, 4));
  let day = Number(v.slice(4, 6));
  if (month < 1 || month > 12) return undefined;
  // GS1 allows DD=00 to mean "end of the month".
  if (day === 0) day = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Parse a scanned string as GS1. Returns null when it isn't GS1-structured (a
// plain EAN-13 / Code128 barcode), so callers can fall back to the raw value.
export function parseGs1(raw: string): Gs1Fields | null {
  if (!raw) return null;
  let s = raw;
  // Strip a leading symbology identifier (e.g. "]d2", "]C1", "]e0").
  if (s.startsWith("]")) s = s.slice(3);
  if (s.startsWith(GS)) s = s.slice(1);
  // GS1 medication codes lead with (01) GTIN; bail early otherwise so a plain
  // numeric barcode isn't mis-parsed.
  if (!s.startsWith("01")) return null;

  const out: Gs1Fields = {};
  let i = 0;
  let matched = false;
  while (i + 2 <= s.length) {
    const ai = s.slice(i, i + 2);
    i += 2;
    const fixed = FIXED_LEN[ai];
    let value: string;
    if (fixed != null) {
      value = s.slice(i, i + fixed);
      i += fixed;
    } else {
      const gsIdx = s.indexOf(GS, i);
      if (gsIdx === -1) {
        value = s.slice(i);
        i = s.length;
      } else {
        value = s.slice(i, gsIdx);
        i = gsIdx + 1;
      }
    }
    if (s[i] === GS) i += 1; // consume a separator trailing a fixed field
    if (!value) break;
    matched = true;
    if (ai === "01") out.gtin = value;
    else if (ai === "17") out.expiry = yymmddToIso(value);
    else if (ai === "10") out.lot = value;
    else if (ai === "21") out.serial = value;
  }
  return matched ? out : null;
}
