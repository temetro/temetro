// The canonical Appointment shape returned by the API. Mirrors the frontend
// `lib/appointments.ts` Appointment type. Patient fields are denormalized for
// display; `fileNumber` links back to a patient record when set.
export type AppointmentStatus =
  | "confirmed"
  | "checked-in"
  | "completed"
  | "cancelled";

export type Appointment = {
  id: string;
  fileNumber: string;
  name: string;
  initials: string;
  date: string; // ISO YYYY-MM-DD
  time: string; // HH:mm
  type: string;
  provider: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
};
