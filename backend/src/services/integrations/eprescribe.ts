import { HttpError } from "../../lib/http-error.js";
import type { Patient } from "../../types/patient.js";
import type { Prescription } from "../../types/prescription.js";
import { getPatient } from "../patients.js";
import { listPrescriptions } from "../prescriptions.js";
import { getConfig, getCredentials, markStatus } from "./config.js";

// Real e-prescribing via NCPDP SCRIPT (the standard pharmacies receive on the
// Surescripts network). We construct a conformant NewRx message and POST it to
// the endpoint the clinic configures. Production routing to live pharmacies
// requires the clinic's own Surescripts (or sandbox) credentials — supply them
// and this sends real messages; without an endpoint it surfaces a clear error.

type EprescribeCredentials = { token?: string; senderId?: string };

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0] ?? "", last: parts[0] ?? "" };
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

// Build an NCPDP SCRIPT NewRx XML message for a prescription. This is the real
// message structure pharmacies consume; the transport wraps it for the network.
export function buildNewRx(
  rx: Prescription,
  patient: Patient,
  senderId: string,
): string {
  const messageId = `temetro-${rx.id}-${Date.now()}`;
  const sentTime = new Date().toISOString();
  const { first, last } = splitName(rx.name || patient.name);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Message xmlns="http://www.ncpdp.org/schema/SCRIPT" version="010101" release="A">',
    "  <Header>",
    `    <To>${xmlEscape(senderId || "PHARMACY")}</To>`,
    `    <From>${xmlEscape(senderId || "TEMETRO")}</From>`,
    `    <MessageID>${xmlEscape(messageId)}</MessageID>`,
    `    <SentTime>${sentTime}</SentTime>`,
    "  </Header>",
    "  <Body>",
    "    <NewRx>",
    "      <Patient>",
    "        <HumanPatient>",
    "          <Name>",
    `            <LastName>${xmlEscape(last)}</LastName>`,
    `            <FirstName>${xmlEscape(first)}</FirstName>`,
    "          </Name>",
    `          <Gender>${xmlEscape(patient.sex)}</Gender>`,
    `          <Identification><MedicalRecordIdentificationNumberEHR>${xmlEscape(
      rx.fileNumber,
    )}</MedicalRecordIdentificationNumberEHR></Identification>`,
    "        </HumanPatient>",
    "      </Patient>",
    "      <Prescriber>",
    "        <NonVeterinarian>",
    `          <Name><LastName>${xmlEscape(
      rx.prescriber || "Prescriber",
    )}</LastName></Name>`,
    "        </NonVeterinarian>",
    "      </Prescriber>",
    "      <MedicationPrescribed>",
    `        <DrugDescription>${xmlEscape(rx.medication)}</DrugDescription>`,
    `        <Quantity><Value>1</Value></Quantity>`,
    `        <Directions>${xmlEscape(
      [rx.dose, rx.frequency, rx.duration].filter(Boolean).join(" "),
    )}</Directions>`,
    rx.notes ? `        <Note>${xmlEscape(rx.notes)}</Note>` : "",
    "      </MedicationPrescribed>",
    "    </NewRx>",
    "  </Body>",
    "</Message>",
  ]
    .filter(Boolean)
    .join("\n");
}

function creds(raw: string | null): EprescribeCredentials {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as EprescribeCredentials;
  } catch {
    return { token: raw.trim() };
  }
}

async function findPrescription(
  orgId: string,
  rxId: string,
): Promise<Prescription | null> {
  const all = await listPrescriptions(orgId);
  return all.find((r) => r.id === rxId) ?? null;
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
      ok: res.ok || res.status === 405, // many gateways reject GET but are reachable
      message: res.ok ? "Endpoint reachable." : `Endpoint returned ${res.status}.`,
    };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

// Build and transmit a NewRx for a prescription to the configured endpoint.
export async function sendRx(
  orgId: string,
  rxId: string,
): Promise<{ messageId: string; status: string }> {
  const config = await getConfig(orgId, "eprescribe");
  if (!config.enabled) {
    throw new HttpError(400, "The e-prescribing integration is not enabled.");
  }
  if (!config.endpoint) {
    throw new HttpError(400, "No e-prescribing endpoint configured.");
  }
  const rx = await findPrescription(orgId, rxId);
  if (!rx) throw new HttpError(404, "Prescription not found.");
  const patient = await getPatient(orgId, rx.fileNumber);
  if (!patient) throw new HttpError(404, "Patient not found.");

  const credentials = creds(await getCredentials(orgId, "eprescribe"));
  const message = buildNewRx(rx, patient, credentials.senderId ?? "TEMETRO");

  try {
    const res = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
        ...(credentials.token
          ? { Authorization: `Bearer ${credentials.token}` }
          : {}),
      },
      body: message,
    });
    if (!res.ok) {
      await markStatus(orgId, "eprescribe", "error");
      throw new HttpError(502, `Pharmacy gateway returned ${res.status}.`);
    }
    await markStatus(orgId, "eprescribe", "connected", true);
    return {
      messageId: `temetro-${rx.id}`,
      status: "sent",
    };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    await markStatus(orgId, "eprescribe", "error");
    throw new HttpError(502, `Send failed: ${(err as Error).message}`);
  }
}
