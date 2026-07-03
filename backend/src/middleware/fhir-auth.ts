import type { NextFunction, Request, Response } from "express";

import { resolveKey } from "../services/fhir-server/keys.js";
import {
  FHIR_CONTENT_TYPE,
  operationOutcome,
} from "../services/fhir-server/outcome.js";

// Bearer-token auth for the read-only FHIR server. Unlike the rest of the API
// (Better Auth session cookies), the `/fhir` endpoints authenticate with a
// per-clinic API key: `Authorization: Bearer tmf_<secret>`. On success the
// caller's organization is attached to `req.organizationId` and every downstream
// query is scoped to it. Failures return a FHIR OperationOutcome, not our
// standard error JSON.
export async function requireFhirKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const secret = match?.[1]?.trim();

  const unauthorized = (diagnostics: string) => {
    res
      .status(401)
      .type(FHIR_CONTENT_TYPE)
      .set("WWW-Authenticate", "Bearer")
      .json(operationOutcome("error", "login", diagnostics));
  };

  if (!secret) {
    unauthorized("Missing bearer token. Send Authorization: Bearer tmf_…");
    return;
  }

  try {
    const resolved = await resolveKey(secret);
    if (!resolved) {
      unauthorized("Invalid or revoked API key.");
      return;
    }
    req.organizationId = resolved.orgId;
    req.fhirKey = { id: resolved.keyId, name: resolved.keyName };
    next();
  } catch (err) {
    next(err);
  }
}
