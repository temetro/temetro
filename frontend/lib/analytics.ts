import { apiFetch } from "@/lib/api-client";

// Server-computed clinic analytics. Mirrors the backend `src/types/analytics.ts`.
// All figures are aggregates over the active clinic's real data.
export type TrendPoint = { label: string; count: number };
export type EarningsPoint = { label: string; billed: number; paid: number };

export type Analytics = {
  patients: {
    total: number;
    newThisMonth: number;
    active: number;
  };
  appointments: {
    thisWeek: number;
    completed: number;
    cancelled: number;
    upcoming: number;
  };
  prescriptions: {
    total: number;
    active: number;
  };
  tasks: {
    open: number;
    done: number;
  };
  earnings: {
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    byMonth: EarningsPoint[];
  };
  trends: {
    patientsByMonth: TrendPoint[];
    appointmentsByWeekday: TrendPoint[];
  };
};

export function getAnalytics(): Promise<Analytics> {
  return apiFetch<Analytics>("/api/analytics");
}

// Current "in the building now" count — checked-in appointments today. Polled by
// the Analysis Live card.
export function getLiveMetric(): Promise<{ value: number }> {
  return apiFetch<{ value: number }>("/api/analytics/live");
}
