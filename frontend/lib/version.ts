// Client helpers for the backend's version + network endpoints (both public).
import { apiFetch } from "@/lib/api-client";

export type VersionInfo = {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
};

export type NetworkInfo = {
  port: number;
  addresses: string[];
  urls: string[];
};

export function getVersionInfo(force = false): Promise<VersionInfo> {
  return apiFetch<VersionInfo>(`/api/version${force ? "?refresh=1" : ""}`);
}

export function getNetworkInfo(): Promise<NetworkInfo> {
  return apiFetch<NetworkInfo>("/api/network");
}
