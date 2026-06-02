import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { HttpError } from "../lib/http-error.js";

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

// Express error handler (must take 4 args).
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: err.issues });
    return;
  }
  console.error("[error]", err);
  res.status(500).json({ error: "Internal server error" });
}
