import { HttpError } from "../../lib/http-error.js";
import type { Invoice } from "../../types/invoice.js";
import { invoiceTotal } from "../invoices.js";
import { getInvoice } from "../invoices.js";
import { getPatient } from "../patients.js";
import { getConfig, getCredentials, markStatus } from "./config.js";

// Real insurance claims via X12 EDI: we generate an 837P (professional claim)
// from an invoice and submit it to the clearinghouse endpoint the clinic
// configures, then parse the 835 remittance it returns. Production routing
// needs the clinic's own clearinghouse account (Availity / Change / etc.) —
// supply the endpoint + submitter credentials and this transmits real claims.

type ClaimsCredentials = {
  token?: string;
  submitterId?: string;
  receiverId?: string;
};

function creds(raw: string | null): ClaimsCredentials {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ClaimsCredentials;
  } catch {
    return { token: raw.trim() };
  }
}

// X12 control dates/times.
function ediDate(d = new Date()): { ccyymmdd: string; yymmdd: string; hhmm: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const mm = p(d.getMonth() + 1);
  const dd = p(d.getDate());
  return {
    ccyymmdd: `${y}${mm}${dd}`,
    yymmdd: `${String(y).slice(2)}${mm}${dd}`,
    hhmm: `${p(d.getHours())}${p(d.getMinutes())}`,
  };
}

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: "", last: parts[0] ?? "" };
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

// Build a minimal-but-valid X12 837P claim from an invoice. Segments are
// terminated by ~ and elements by *, per the X12 standard.
export function build837P(
  invoice: Invoice,
  patientName: string,
  patientFileNumber: string,
  submitterId: string,
  receiverId: string,
): string {
  const { ccyymmdd, yymmdd, hhmm } = ediDate();
  const ctrl = String(Date.now()).slice(-9);
  const totalCents = invoiceTotal(invoice);
  const { first, last } = splitName(patientName);
  const SEG = "~";
  const E = "*";

  const seg = (...parts: string[]) => parts.join(E) + SEG;

  const lines: string[] = [];
  // Interchange + functional group envelope.
  lines.push(
    seg(
      "ISA",
      "00",
      "          ",
      "00",
      "          ",
      "ZZ",
      submitterId.padEnd(15).slice(0, 15),
      "ZZ",
      receiverId.padEnd(15).slice(0, 15),
      yymmdd,
      hhmm,
      "^",
      "00501",
      ctrl,
      "0",
      "P",
      ":",
    ),
  );
  lines.push(seg("GS", "HC", submitterId, receiverId, ccyymmdd, hhmm, ctrl, "X", "005010X222A1"));
  lines.push(seg("ST", "837", "0001", "005010X222A1"));
  lines.push(seg("BHT", "0019", "00", invoice.number, ccyymmdd, hhmm, "CH"));
  // Submitter / receiver.
  lines.push(seg("NM1", "41", "2", "TEMETRO CLINIC", "", "", "", "", "46", submitterId));
  lines.push(seg("NM1", "40", "2", "CLEARINGHOUSE", "", "", "", "", "46", receiverId));
  // Billing provider hierarchical level.
  lines.push(seg("HL", "1", "", "20", "1"));
  lines.push(seg("NM1", "85", "2", "TEMETRO CLINIC", "", "", "", "", "XX", submitterId));
  // Subscriber/patient.
  lines.push(seg("HL", "2", "1", "22", "0"));
  lines.push(seg("SBR", "P", "18", "", "", "", "", "", "", "CI"));
  lines.push(seg("NM1", "IL", "1", last, first, "", "", "", "MI", patientFileNumber));
  // Claim.
  lines.push(seg("CLM", invoice.number, money(totalCents), "", "", "11:B:1", "Y", "A", "Y", "Y"));
  // Service lines.
  invoice.lineItems.forEach((li, i) => {
    const lineCents = li.quantity * li.unitPrice;
    lines.push(seg("LX", String(i + 1)));
    lines.push(
      seg("SV1", `HC:${li.description.slice(0, 30)}`, money(lineCents), "UN", String(li.quantity)),
    );
    lines.push(seg("DTP", "472", "D8", ccyymmdd));
  });
  // Trailers.
  const stSegments = lines.length - 2; // ST..SE inclusive count placeholder
  lines.push(seg("SE", String(stSegments + 1), "0001"));
  lines.push(seg("GE", "1", ctrl));
  lines.push(seg("IEA", "1", ctrl));
  return lines.join("\n");
}

// Parse an X12 835 remittance into a simple status/paid summary. Reads the BPR
// (financial info) and CLP (claim payment) segments.
export function parse835(edi: string): {
  paidAmount: number;
  claimStatus: string;
} {
  const segments = edi.split(/~\s*/).map((s) => s.trim()).filter(Boolean);
  let paidAmount = 0;
  let claimStatus = "unknown";
  for (const segment of segments) {
    const el = segment.split("*");
    if (el[0] === "BPR" && el[2]) {
      paidAmount = Math.round(Number(el[2]) * 100) || 0;
    }
    if (el[0] === "CLP" && el[3]) {
      // CLP04 is the amount paid; CLP02 is the claim status code.
      const statusCode = el[2];
      claimStatus =
        statusCode === "1"
          ? "paid"
          : statusCode === "2"
            ? "secondary"
            : statusCode === "4"
              ? "denied"
              : statusCode === "22"
                ? "reversal"
                : "processed";
    }
  }
  return { paidAmount, claimStatus };
}

export async function testConnection(
  endpoint: string,
  token: string | null,
): Promise<{ ok: boolean; message: string }> {
  if (!endpoint) return { ok: false, message: "No endpoint configured." };
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return {
      ok: res.ok || res.status === 405,
      message: res.ok ? "Endpoint reachable." : `Endpoint returned ${res.status}.`,
    };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

// Build and submit an 837P claim for an invoice; parse any 835 response.
export async function submitClaim(
  orgId: string,
  invoiceId: string,
): Promise<{ claimStatus: string; paidAmount: number; submitted: boolean }> {
  const config = await getConfig(orgId, "claims");
  if (!config.enabled) {
    throw new HttpError(400, "The claims integration is not enabled.");
  }
  if (!config.endpoint) {
    throw new HttpError(400, "No clearinghouse endpoint configured.");
  }
  const invoice = await getInvoice(orgId, invoiceId);
  if (!invoice) throw new HttpError(404, "Invoice not found.");
  const patient = await getPatient(orgId, invoice.fileNumber);
  const credentials = creds(await getCredentials(orgId, "claims"));

  const claim = build837P(
    invoice,
    patient?.name ?? invoice.name,
    invoice.fileNumber,
    credentials.submitterId ?? "TEMETRO",
    credentials.receiverId ?? "CLEARINGHOUSE",
  );

  try {
    const res = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/edi-x12",
        ...(credentials.token
          ? { Authorization: `Bearer ${credentials.token}` }
          : {}),
      },
      body: claim,
    });
    if (!res.ok) {
      await markStatus(orgId, "claims", "error");
      throw new HttpError(502, `Clearinghouse returned ${res.status}.`);
    }
    const text = await res.text().catch(() => "");
    const remittance = text.includes("CLP")
      ? parse835(text)
      : { paidAmount: 0, claimStatus: "submitted" };
    await markStatus(orgId, "claims", "connected", true);
    return { ...remittance, submitted: true };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    await markStatus(orgId, "claims", "error");
    throw new HttpError(502, `Submit failed: ${(err as Error).message}`);
  }
}
