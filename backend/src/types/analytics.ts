// A single bar/point in a time-series chart (e.g. one month or one weekday).
export type TrendPoint = { label: string; count: number };

// One month of billing, in currency units (computed from invoices).
export type EarningsPoint = { label: string; billed: number; paid: number };

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
  // Real money, computed from invoices: billed = sum of line items; paid =
  // invoices marked paid; outstanding = draft + sent. `void` is excluded.
  earnings: {
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    byMonth: EarningsPoint[];
  };
  // Time-series for charts: new patients over the last 6 months, and
  // appointments per day across the current week.
  trends: {
    patientsByMonth: TrendPoint[];
    appointmentsByWeekday: TrendPoint[];
  };
};
