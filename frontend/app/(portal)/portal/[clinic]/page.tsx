"use client";

import { useParams } from "next/navigation";

import { PortalKiosk } from "@/components/portal/portal-kiosk";

export default function PatientPortalPage() {
  const params = useParams<{ clinic: string }>();
  const clinic = Array.isArray(params.clinic) ? params.clinic[0] : params.clinic;
  return <PortalKiosk clinic={clinic ?? ""} />;
}
