import type { TFunction } from "i18next";

import type { Patient } from "@/lib/patients";

// Build and print a clean, one-page clinical summary for a patient. We render an
// isolated HTML document in a new window and trigger the browser's print dialog
// (where the user picks "Save as PDF") — no PDF library needed, and the output
// follows the user's locale via the passed `t`.

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rows(items: { label: string; value: string }[]): string {
  return items
    .filter((r) => r.value)
    .map(
      (r) =>
        `<tr><td class="l">${esc(r.label)}</td><td class="v">${esc(r.value)}</td></tr>`,
    )
    .join("");
}

export function printPatientSummary(patient: Patient, t: TFunction): void {
  const sexLabel = t(`patientCard.sex.${patient.sex}`);
  const generated = new Date().toLocaleString();

  const section = (title: string, body: string, empty: string): string =>
    `<section><h2>${esc(title)}</h2>${body || `<p class="empty">${esc(empty)}</p>`}</section>`;

  const list = (items: string[]): string =>
    items.length
      ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
      : "";

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(patient.name)} — ${esc(t("patientCard.pdf.title"))}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    color: #111; margin: 32px; font-size: 12px; line-height: 1.5; }
  header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #555; font-size: 12px; }
  .gen { color: #888; font-size: 10px; margin-top: 6px; }
  section { margin-bottom: 16px; break-inside: avoid; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em;
    border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  td.l { color: #555; width: 38%; padding-right: 12px; }
  td.v { color: #111; }
  ul { margin: 0; padding-left: 18px; }
  li { margin: 1px 0; }
  .empty { color: #999; font-style: italic; margin: 0; }
  @media print { body { margin: 16px; } }
</style>
</head>
<body>
  <header>
    <h1>${esc(patient.name)}</h1>
    <div class="sub">${esc(`${patient.age} · ${sexLabel} · ${t("patientCard.summary.mrn")} ${patient.fileNumber}`)}</div>
    <div class="gen">${esc(t("patientCard.pdf.generated", { date: generated }))}</div>
  </header>

  ${section(
    t("patientCard.overview"),
    `<table>${rows([
      { label: t("patientCard.summary.primaryCare"), value: patient.pcp },
      { label: t("patientCard.summary.lastSeen"), value: patient.encounters[0]?.date ?? "" },
      { label: t("patientCard.summary.status"), value: t(`patients.status.${patient.status}`) },
    ])}</table>`,
    "",
  )}

  ${section(
    t("patientCard.allergies.title"),
    list(
      patient.allergies.map((a) =>
        [a.substance, a.reaction, t(`patientCard.severity.${a.severity}`)]
          .filter(Boolean)
          .join(" — "),
      ),
    ),
    t("patientCard.allergies.none"),
  )}

  ${section(
    t("patientCard.problems.title"),
    list(
      patient.problems.map((p) =>
        p.since ? `${p.label} (${p.since})` : p.label,
      ),
    ),
    t("patientCard.problems.empty"),
  )}

  ${section(
    t("patientCard.medications.title"),
    list(
      patient.medications.map((m) =>
        [m.name, m.dose, m.frequency].filter(Boolean).join(" · "),
      ),
    ),
    t("patientCard.medications.empty"),
  )}

  ${section(
    t("patientCard.vitals.title"),
    `<table>${rows([
      { label: t("patientCard.vitals.bp"), value: patient.vitals.bp },
      { label: t("patientCard.vitals.hr"), value: patient.vitals.hr },
      { label: t("patientCard.vitals.temp"), value: patient.vitals.temp },
      { label: t("patientCard.vitals.spo2"), value: patient.vitals.spo2 },
    ])}</table>`,
    "",
  )}

  ${section(
    t("patientCard.labs.title"),
    list(
      patient.labs.map((l) =>
        `${l.name}: ${l.value} (${t(`patientCard.labFlag.${l.flag}`)})`,
      ),
    ),
    t("patientCard.labs.empty"),
  )}

  ${section(
    t("patientCard.visits.title"),
    patient.encounters
      .map(
        (e) =>
          `<div style="margin-bottom:6px"><strong>${esc(e.type)}</strong> <span style="color:#888">${esc(e.date)} ${esc(e.provider)}</span><br/>${esc(e.summary)}</div>`,
      )
      .join(""),
    t("patientCard.visits.empty"),
  )}
</body>
</html>`;

  const win = window.open("", "_blank", "width=820,height=1000");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  // Let layout settle before invoking print.
  win.setTimeout(() => win.print(), 250);
}
