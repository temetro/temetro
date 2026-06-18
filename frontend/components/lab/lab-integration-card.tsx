"use client";

import { Cable, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import {
  getIntegration,
  type IntegrationConfig,
  syncFhirLabs,
} from "@/lib/integrations";
import type { Patient } from "@/lib/patients";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

// The Lab page's HL7/FHIR connection panel: shows the connection status and, when
// enabled, lets staff pull a patient's results from the configured lab system.
export function LabIntegrationCard({
  patients,
  onSynced,
}: {
  patients: Patient[];
  onSynced: () => void;
}) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    getIntegration("fhir").then((c) => active && setConfig(c));
    return () => {
      active = false;
    };
  }, []);

  const search = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!search) return [];
    return patients
      .filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.fileNumber.includes(search),
      )
      .slice(0, 5);
  }, [patients, search]);

  // Hide entirely until we know the config (avoids a flash); render a muted
  // "configure me" card when present but disabled.
  if (!config) return null;

  const sync = async () => {
    if (!selected) return;
    setSyncing(true);
    try {
      const { imported } = await syncFhirLabs(selected.fileNumber);
      notify.success(
        t("integrations.fhir.syncedTitle"),
        t("integrations.fhir.syncedBody", {
          count: imported,
          name: selected.name,
        }),
      );
      setSelected(null);
      setQuery("");
      onSynced();
    } catch (err) {
      notify.error(
        t("integrations.fhir.failedTitle"),
        err instanceof ApiError
          ? err.message
          : t("integrations.fhir.failedBody"),
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card/30 p-4">
      <div className="flex items-center gap-2">
        <Cable className="size-4 text-muted-foreground" />
        <h2 className="font-medium text-foreground text-sm">
          {t("integrations.fhir.cardTitle")}
        </h2>
        <Badge
          className="ml-auto"
          variant={
            config.status === "connected"
              ? "secondary"
              : config.status === "error"
                ? "destructive"
                : "outline"
          }
        >
          {t(`settings.integrations.status.${config.status}`)}
        </Badge>
      </div>

      {!config.enabled ? (
        <p className="text-muted-foreground text-sm">
          {t("integrations.fhir.disabledHint")}
        </p>
      ) : selected ? (
        <div className="flex items-center gap-3 rounded-xl border bg-background/40 px-3 py-2">
          <Avatar className="size-8">
            <AvatarFallback>{selected.initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium text-foreground text-sm">
              {selected.name}
            </span>
            <span className="text-muted-foreground text-xs">
              #{selected.fileNumber}
            </span>
          </div>
          <Button
            disabled={syncing}
            onClick={() => setSelected(null)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("integrations.fhir.change")}
          </Button>
          <Button disabled={syncing} onClick={sync} size="sm" type="button">
            <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
            {syncing
              ? t("integrations.fhir.syncing")
              : t("integrations.fhir.sync")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("integrations.fhir.searchPlaceholder")}
              value={query}
            />
          </div>
          {matches.length > 0 && (
            <div className="flex flex-col gap-1">
              {matches.map((p) => (
                <button
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                  key={p.fileNumber}
                  onClick={() => setSelected(p)}
                  type="button"
                >
                  <Avatar className="size-7">
                    <AvatarFallback>{p.initials}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate text-sm">{p.name}</span>
                  <span className="ms-auto text-muted-foreground text-xs">
                    #{p.fileNumber}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
