import { and, count, eq, gte, lte, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db } from "../db/index.js";
import { appointments } from "../db/schema/appointments.js";
import { patients } from "../db/schema/patients.js";
import { prescriptions } from "../db/schema/prescriptions.js";
import { tasks } from "../db/schema/tasks.js";
import type { Analytics } from "../types/analytics.js";

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function countWhere(table: PgTable, where: SQL): Promise<number> {
  const [row] = await db.select({ value: count() }).from(table).where(where);
  return row?.value ?? 0;
}

export async function getAnalytics(orgId: string): Promise<Analytics> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - now.getDay(),
  );
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const weekStartKey = keyOf(startOfWeek);
  const weekEndKey = keyOf(endOfWeek);
  const todayKey = keyOf(now);

  const [
    patientsTotal,
    patientsNew,
    patientsActive,
    apptWeek,
    apptCompleted,
    apptCancelled,
    apptUpcoming,
    rxTotal,
    rxActive,
    tasksOpen,
    tasksDone,
  ] = await Promise.all([
    countWhere(patients, eq(patients.organizationId, orgId)),
    countWhere(
      patients,
      and(
        eq(patients.organizationId, orgId),
        gte(patients.createdAt, startOfMonth),
      )!,
    ),
    countWhere(
      patients,
      and(eq(patients.organizationId, orgId), eq(patients.status, "active"))!,
    ),
    countWhere(
      appointments,
      and(
        eq(appointments.organizationId, orgId),
        gte(appointments.date, weekStartKey),
        lte(appointments.date, weekEndKey),
      )!,
    ),
    countWhere(
      appointments,
      and(
        eq(appointments.organizationId, orgId),
        eq(appointments.status, "completed"),
      )!,
    ),
    countWhere(
      appointments,
      and(
        eq(appointments.organizationId, orgId),
        eq(appointments.status, "cancelled"),
      )!,
    ),
    countWhere(
      appointments,
      and(
        eq(appointments.organizationId, orgId),
        gte(appointments.date, todayKey),
      )!,
    ),
    countWhere(prescriptions, eq(prescriptions.organizationId, orgId)),
    countWhere(
      prescriptions,
      and(
        eq(prescriptions.organizationId, orgId),
        eq(prescriptions.status, "active"),
      )!,
    ),
    countWhere(
      tasks,
      and(eq(tasks.organizationId, orgId), eq(tasks.done, false))!,
    ),
    countWhere(
      tasks,
      and(eq(tasks.organizationId, orgId), eq(tasks.done, true))!,
    ),
  ]);

  return {
    patients: {
      total: patientsTotal,
      newThisMonth: patientsNew,
      active: patientsActive,
    },
    appointments: {
      thisWeek: apptWeek,
      completed: apptCompleted,
      cancelled: apptCancelled,
      upcoming: apptUpcoming,
    },
    prescriptions: { total: rxTotal, active: rxActive },
    tasks: { open: tasksOpen, done: tasksDone },
  };
}
