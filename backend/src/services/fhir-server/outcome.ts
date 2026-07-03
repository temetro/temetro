// FHIR OperationOutcome helpers. Errors on a FHIR endpoint are returned as an
// OperationOutcome resource (not our usual `{ error }` JSON), with the
// `application/fhir+json` content type, so conformant clients can parse them.

export const FHIR_CONTENT_TYPE = "application/fhir+json";

export type IssueSeverity = "fatal" | "error" | "warning" | "information";
export type IssueCode =
  | "not-found"
  | "not-supported"
  | "security"
  | "login"
  | "forbidden"
  | "invalid"
  | "processing"
  | "exception";

export type OperationOutcome = {
  resourceType: "OperationOutcome";
  issue: {
    severity: IssueSeverity;
    code: IssueCode;
    diagnostics?: string;
  }[];
};

export function operationOutcome(
  severity: IssueSeverity,
  code: IssueCode,
  diagnostics: string,
): OperationOutcome {
  return {
    resourceType: "OperationOutcome",
    issue: [{ severity, code, diagnostics }],
  };
}
