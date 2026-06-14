import { and, count, eq, gte, lte, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db } from "../db/index.js";
import { appointments } from "../db/schema/appointments.js";
import { invoices } from "../db/schema/invoices.js";
import { patients } from "../db/schema/patients.js";
import { prescriptions } from "../db/schema/prescriptions.js";
import { tasks } from "../db/schema/tasks.js";
import type { Analytics } from "../types/analytics.js";
import { invoiceTotal } from "./invoices.js";

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function countWhere(table: PgTable, where: SQL): Promise<number> {
  const [row] = await db.select({ value: count() }).from(table).where(where);
  return row?.value ?? 0;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  // New patients per month over the last 6 months (oldest → newest). One query,
  // bucketed in JS by the patient's createdAt month.
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return {
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      label: MONTH_LABELS[d.getMonth()]!,
    };
  });
  const patientRows = await db
    .select({ createdAt: patients.createdAt })
    .from(patients)
    .where(
      and(
        eq(patients.organizationId, orgId),
        gte(patients.createdAt, sixMonthsAgo),
      )!,
    );
  const monthCounts = new Map(months.map((m) => [m.key, 0]));
  for (const r of patientRows) {
    const d = r.createdAt;
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    if (monthCounts.has(key)) monthCounts.set(key, monthCounts.get(key)! + 1);
  }
  const patientsByMonth = months.map((m) => ({
    label: m.label,
    count: monthCounts.get(m.key) ?? 0,
  }));

  // Appointments per day across the current week (Sun → Sat). One query,
  // bucketed in JS by the appointment's date key.
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(
      startOfWeek.getFullYear(),
      startOfWeek.getMonth(),
      startOfWeek.getDate() + i,
    );
    return { key: keyOf(d), label: WEEKDAY_LABELS[d.getDay()]! };
  });
  const apptRows = await db
    .select({ date: appointments.date })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, orgId),
        gte(appointments.date, weekStartKey),
        lte(appointments.date, weekEndKey),
      )!,
    );
  const dayCounts = new Map(weekDays.map((d) => [d.key, 0]));
  for (const r of apptRows) {
    if (dayCounts.has(r.date)) dayCounts.set(r.date, dayCounts.get(r.date)! + 1);
  }
  const appointmentsByWeekday = weekDays.map((d) => ({
    label: d.label,
    count: dayCounts.get(d.key) ?? 0,
  }));

  // Earnings from invoices (real money). `void` invoices are excluded entirely.
  const invoiceRows = await db
    .select({
      lineItems: invoices.lineItems,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
    })
    .from(invoices)
    .where(eq(invoices.organizationId, orgId));
  let totalBilled = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  const billedByMonth = new Map(months.map((m) => [m.key, 0]));
  const paidByMonth = new Map(months.map((m) => [m.key, 0]));
  for (const inv of invoiceRows) {
    if (inv.status === "void") continue;
    const amount = invoiceTotal({ lineItems: inv.lineItems });
    totalBilled += amount;
    if (inv.status === "paid") totalPaid += amount;
    else totalOutstanding += amount; // draft + sent
    // issuedAt is a YYYY-MM-DD string; its YYYY-MM prefix is the month key.
    const monthKey = inv.issuedAt.slice(0, 7);
    if (billedByMonth.has(monthKey)) {
      billedByMonth.set(monthKey, billedByMonth.get(monthKey)! + amount);
      if (inv.status === "paid") {
        paidByMonth.set(monthKey, paidByMonth.get(monthKey)! + amount);
      }
    }
  }
  const earningsByMonth = months.map((m) => ({
    label: m.label,
    billed: billedByMonth.get(m.key) ?? 0,
    paid: paidByMonth.get(m.key) ?? 0,
  }));

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
    earnings: {
      totalBilled,
      totalPaid,
      totalOutstanding,
      byMonth: earningsByMonth,
    },
    trends: { patientsByMonth, appointmentsByWeekday },
  };
}

// "In the building now" — today's appointments that are checked in. Cheap query
// for the Analysis Live card to poll.
export async function getLiveMetric(orgId: string): Promise<number> {
  const todayKey = keyOf(new Date());
  return countWhere(
    appointments,
    and(
      eq(appointments.organizationId, orgId),
      eq(appointments.date, todayKey),
      eq(appointments.status, "checked-in"),
    )!,
  );
}
