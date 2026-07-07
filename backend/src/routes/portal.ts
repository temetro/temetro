import { and, asc, eq, inArray } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";

import { db } from "../db/index.js";
import { member, organization, user } from "../db/schema/auth.js";
import { staffProfile } from "../db/schema/staff-profile.js";
import { appointmentInputSchema } from "../lib/appointment-validation.js";
import { HttpError } from "../lib/http-error.js";
import { initialsFromName } from "../lib/initials.js";
import { patientInputSchema } from "../lib/patient-validation.js";
import { recordActivity } from "../services/activity.js";
import { createAppointment, listAppointments } from "../services/appointments.js";
import { createPatient, getPatient } from "../services/patients.js";

// Clinical-capable roles that can be a patient's provider (mirrors
// staff.ts PROVIDER_ROLES). Department roles (reception, pharmacy, lab) excluded.
const PROVIDER_ROLES = ["owner", "admin", "doctor", "member"] as const;

// Public, unauthenticated kiosk API for a clinic's Patient Portal (an iPad in the
// waiting room). Scoped by the clinic slug in the URL — there is no session.
//
// PHI exposure is deliberately minimal: lookups require BOTH a file number and a
// matching name, and "results" return only appointment status + whether results
// exist, never lab values. A kiosk token / one-time code would be the safer
// long-term design (see docs).
export const portalRouter = Router();

async function resolveClinic(req: Request): Promise<{ id: string; name: string }> {
  const slug = String(req.params.clinic ?? "").trim();
  if (!slug) throw new HttpError(404, "Clinic not found.");
  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  if (!org) throw new HttpError(404, "Clinic not found.");
  return org;
}

const norm = (s: string) => s.trim().toLowerCase();

// GET /api/portal/:clinic — clinic name for the kiosk header.
portalRouter.get("/:clinic", async (req, res, next) => {
  try {
    const clinic = await resolveClinic(req);
    res.json({ name: clinic.name });
  } catch (err) {
    next(err);
  }
});

// GET /api/portal/:clinic/doctors — public list of the clinic's providers so a
// patient can pick who to see. Returns only display-safe fields (name +
// specialty); no ids, emails, or usernames leave this unauthenticated surface.
portalRouter.get("/:clinic/doctors", async (req, res, next) => {
  try {
    const clinic = await resolveClinic(req);
    const rows = await db
      .select({ name: user.name, specialty: staffProfile.specialty })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .leftJoin(
        staffProfile,
        and(
          eq(staffProfile.userId, member.userId),
          eq(staffProfile.organizationId, member.organizationId),
        ),
      )
      .where(
        and(
          eq(member.organizationId, clinic.id),
          inArray(member.role, PROVIDER_ROLES as unknown as string[]),
        ),
      )
      .orderBy(asc(user.name));
    res.json(rows.map((r) => ({ name: r.name, specialty: r.specialty ?? null })));
  } catch (err) {
    next(err);
  }
});

const availabilitySchema = z.object({
  provider: z.string().trim().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
});

// GET /api/portal/:clinic/availability?provider=&date= — the taken time slots
// for a provider on a given day, so the kiosk can render only free slots. The
// filter mirrors the booking conflict check (an empty-provider appointment
// blocks the slot clinic-wide). Booking still re-checks server-side (409).
portalRouter.get("/:clinic/availability", async (req, res, next) => {
  try {
    const clinic = await resolveClinic(req);
    const q = availabilitySchema.parse({
      provider: req.query.provider,
      date: req.query.date,
    });
    const provider = q.provider ?? "";
    const taken = (await listAppointments(clinic.id))
      .filter(
        (a) =>
          a.status !== "cancelled" &&
          a.date === q.date &&
          (!provider || !a.provider || a.provider === provider),
      )
      .map((a) => a.time);
    res.json({ date: q.date, provider, taken: [...new Set(taken)].sort() });
  } catch (err) {
    next(err);
  }
});

const bookingSchema = z.object({
  fileNumber: z.string().trim().min(1, "A file number is required.").max(64),
  name: z.string().trim().min(1, "Your name is required.").max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:mm."),
  type: z.string().trim().max(120).optional(),
  // Chosen provider (doctor name) from the portal's doctor picker; falls back
  // to the patient's PCP when omitted.
  provider: z.string().trim().max(200).optional(),
});

const newPatientSchema = z.object({
  name: z.string().trim().min(1, "Your name is required.").max(200),
  sex: z.string().trim().optional(),
  age: z.coerce.number().int().min(0).max(150).optional(),
});

// POST /api/portal/:clinic/patients — register a new (demographics-only) patient
// from the kiosk so a first-time visitor can get a file number and then book.
// Writes only demographics (no clinical PHI) from this unauthenticated surface.
portalRouter.post("/:clinic/patients", async (req, res, next) => {
  try {
    const clinic = await resolveClinic(req);
    const body = newPatientSchema.parse(req.body);
    const input = patientInputSchema.parse({
      name: body.name,
      sex: body.sex ?? "M",
      age: body.age ?? 0,
      source: "manual",
    });
    const created = await createPatient(clinic.id, "", input, true);
    await recordActivity({
      orgId: clinic.id,
      actor: { id: "", name: created.name },
      action: `Patient portal registration — ${created.name}`,
      entityType: "patient",
      entityId: created.fileNumber,
    });
    res.status(201).json({ fileNumber: created.fileNumber, name: created.name });
  } catch (err) {
    next(err);
  }
});

// POST /api/portal/:clinic/appointments — self-service booking for a registered
// patient. Verifies the file number + name, then creates a confirmed appointment
// that shows up on the clinic's Appointments page.
portalRouter.post("/:clinic/appointments", async (req, res, next) => {
  try {
    const clinic = await resolveClinic(req);
    const body = bookingSchema.parse(req.body);

    const patient = await getPatient(clinic.id, body.fileNumber);
    if (!patient || norm(patient.name) !== norm(body.name)) {
      throw new HttpError(
        404,
        "We couldn't find a record matching that name and file number.",
      );
    }
    // Don't allow booking in the past.
    const today = new Date().toISOString().slice(0, 10);
    if (body.date < today) {
      throw new HttpError(400, "Please pick a future date.");
    }

    const input = appointmentInputSchema.parse({
      fileNumber: patient.fileNumber,
      name: patient.name,
      initials: patient.initials || initialsFromName(patient.name),
      date: body.date,
      time: body.time,
      type: body.type || "Self-service booking",
      provider: body.provider || patient.pcp || "",
      status: "confirmed",
      source: "manual",
    });

    // Prevent double-booking the same slot: a provider can't have two
    // appointments at the same date+time (clinic-wide when the provider is
    // unknown). Cancelled appointments don't count.
    const taken = (await listAppointments(clinic.id)).some(
      (a) =>
        a.status !== "cancelled" &&
        a.date === input.date &&
        a.time === input.time &&
        (!input.provider || !a.provider || a.provider === input.provider),
    );
    if (taken) {
      throw new HttpError(
        409,
        "That time slot is already taken. Please choose another time.",
      );
    }

    const created = await createAppointment(clinic.id, "", input);
    await recordActivity({
      orgId: clinic.id,
      actor: { id: "", name: patient.name },
      action: `Patient portal booking — ${patient.name} on ${created.date} ${created.time}`,
      entityType: "appointment",
      entityId: created.id,
    });
    res.status(201).json({
      date: created.date,
      time: created.time,
      type: created.type,
      provider: created.provider,
    });
  } catch (err) {
    next(err);
  }
});

const lookupSchema = z.object({
  fileNumber: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
});

// GET /api/portal/:clinic/results?fileNumber=&name= — minimal status view.
// Returns upcoming appointments and whether results are on file, never the
// underlying clinical values.
portalRouter.get("/:clinic/results", async (req, res, next) => {
  try {
    const clinic = await resolveClinic(req);
    const q = lookupSchema.parse({
      fileNumber: req.query.fileNumber,
      name: req.query.name,
    });
    const patient = await getPatient(clinic.id, q.fileNumber);
    if (!patient || norm(patient.name) !== norm(q.name)) {
      throw new HttpError(
        404,
        "We couldn't find a record matching that name and file number.",
      );
    }
    const now = new Date();
    const upcoming = (await listAppointments(clinic.id))
      .filter(
        (a) =>
          a.fileNumber === patient.fileNumber &&
          a.status !== "cancelled" &&
          new Date(`${a.date}T${a.time}`) >= now,
      )
      .map((a) => ({
        date: a.date,
        time: a.time,
        type: a.type,
        provider: a.provider,
        status: a.status,
      }));
    res.json({
      name: patient.name,
      upcoming,
      hasResults: patient.labs.length > 0,
      resultCount: patient.labs.length,
    });
  } catch (err) {
    next(err);
  }
});
