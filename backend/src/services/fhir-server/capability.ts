// A static CapabilityStatement describing exactly what this read-only FHIR R4
// server supports. It is intentionally honest: only the resources and search
// params implemented below are listed, everything is `read`/`search-type` only,
// and clinical concepts are text-only (no SNOMED/LOINC coding).

type ResourceCapability = {
  type: string;
  interaction: { code: "read" | "search-type" }[];
  searchParam?: { name: string; type: "token" | "string" | "reference" }[];
};

const RESOURCES: ResourceCapability[] = [
  {
    type: "Patient",
    interaction: [{ code: "read" }, { code: "search-type" }],
    searchParam: [
      { name: "identifier", type: "token" },
      { name: "name", type: "string" },
    ],
  },
  {
    type: "Observation",
    interaction: [{ code: "read" }, { code: "search-type" }],
    searchParam: [
      { name: "patient", type: "reference" },
      { name: "patient.identifier", type: "token" },
      { name: "category", type: "token" },
    ],
  },
  {
    type: "AllergyIntolerance",
    interaction: [{ code: "read" }, { code: "search-type" }],
    searchParam: [
      { name: "patient", type: "reference" },
      { name: "patient.identifier", type: "token" },
    ],
  },
  {
    type: "Condition",
    interaction: [{ code: "read" }, { code: "search-type" }],
    searchParam: [
      { name: "patient", type: "reference" },
      { name: "patient.identifier", type: "token" },
    ],
  },
  {
    type: "MedicationRequest",
    interaction: [{ code: "read" }, { code: "search-type" }],
    searchParam: [
      { name: "patient", type: "reference" },
      { name: "patient.identifier", type: "token" },
    ],
  },
  {
    type: "Encounter",
    interaction: [{ code: "read" }, { code: "search-type" }],
    searchParam: [
      { name: "patient", type: "reference" },
      { name: "patient.identifier", type: "token" },
    ],
  },
  {
    type: "Appointment",
    interaction: [{ code: "read" }, { code: "search-type" }],
    searchParam: [
      { name: "patient", type: "reference" },
      { name: "patient.identifier", type: "token" },
    ],
  },
];

export function capabilityStatement(
  baseUrl: string,
  version: string,
): Record<string, unknown> {
  return {
    resourceType: "CapabilityStatement",
    status: "active",
    date: new Date().toISOString(),
    publisher: "temetro",
    kind: "instance",
    implementation: { description: "temetro FHIR server", url: baseUrl },
    software: { name: "temetro", version },
    fhirVersion: "4.0.1",
    format: ["application/fhir+json", "json"],
    rest: [
      {
        mode: "server",
        documentation:
          "Read-only FHIR R4 server. Authenticate with a per-clinic API key: " +
          "Authorization: Bearer tmf_…. Clinical values are text-only " +
          "CodeableConcepts (no SNOMED/LOINC). Patients expose age (extension), " +
          "not birthDate. Pagination via _count (default 50, max 200) and _offset.",
        security: {
          description: "Bearer token (per-organization API key, tmf_ prefix).",
          service: [
            {
              coding: [
                {
                  system:
                    "http://terminology.hl7.org/CodeSystem/restful-security-service",
                  code: "OAuth",
                  display: "OAuth",
                },
              ],
              text: "API key bearer token",
            },
          ],
        },
        resource: RESOURCES,
      },
    ],
  };
}
