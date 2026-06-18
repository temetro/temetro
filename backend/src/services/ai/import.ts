import { patientInputSchema } from "../../lib/patient-validation.js";

// Result of a dry-run validation of parsed patient records. `valid` holds the
// normalized, ready-to-commit records; `invalid` keeps the *original* record
// alongside its errors so the clinician can edit and re-validate it in the UI.
export type ImportValidation = {
  valid: unknown[];
  invalid: { index: number; errors: string[]; record: unknown }[];
  total: number;
};

// Validate parsed patient records against the (tolerant) patient schema without
// writing anything. Shared by the chat `previewImport` tool and the
// re-validation endpoint the edit-before-import UI calls.
export function validatePatientImport(records: unknown[]): ImportValidation {
  const valid: unknown[] = [];
  const invalid: ImportValidation["invalid"] = [];
  records.forEach((record, index) => {
    const parsed = patientInputSchema.safeParse(record);
    if (parsed.success) {
      valid.push(parsed.data);
    } else {
      invalid.push({
        index,
        errors: parsed.error.issues.map(
          (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
        ),
        record,
      });
    }
  });
  return { valid, invalid, total: records.length };
}
