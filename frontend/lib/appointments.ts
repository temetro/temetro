import { apiFetch } from "@/lib/api-client";

// An appointment. Mirrors the backend `src/types/appointment.ts`. Scoped to the
// active clinic. `fileNumber` links back to a patient record when set.
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

export type AppointmentInput = {
  fileNumber: string;
  name: string;
  initials: string;
  date: string;
  time: string;
  type: string;
  provider: string;
  status?: AppointmentStatus;
};

export function listAppointments(): Promise<Appointment[]> {
  return apiFetch<Appointment[]>("/api/appointments");
}

export function createAppointment(
  input: AppointmentInput,
): Promise<Appointment> {
  return apiFetch<Appointment>("/api/appointments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAppointment(
  id: string,
  input: AppointmentInput,
): Promise<Appointment> {
  return apiFetch<Appointment>(`/api/appointments/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteAppointment(id: string): Promise<void> {
  return apiFetch<void>(`/api/appointments/${id}`, { method: "DELETE" });
}
