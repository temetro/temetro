import { apiFetch } from "@/lib/api-client";

// Server-computed clinic analytics. Mirrors the backend `src/types/analytics.ts`.
// All figures are aggregates over the active clinic's real data.
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
};

export function getAnalytics(): Promise<Analytics> {
  return apiFetch<Analytics>("/api/analytics");
}
