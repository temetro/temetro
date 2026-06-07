// Server-computed clinic analytics returned by GET /api/analytics. All figures
// are aggregates over the active clinic's real data (no fabricated financials).
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
