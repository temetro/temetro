"use client";

import { LocateFixed } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FieldLabel,
  SettingsCard,
  SettingsSection,
  whiteButton,
} from "@/components/settings/settings-parts";
import { cn } from "@/lib/utils";
import { getClinicSettings, saveClinicLocation } from "@/lib/clinic";
import { reverseGeocode } from "@/lib/geocode";
import { notify } from "@/lib/toast";

// Parse a coordinate input into a number or null (empty ⇒ null). Returns
// `false` when the string is present but not a finite number, so we can flag it.
function parseCoord(value: string): number | null | false {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : false;
}

// Clinic location editor (owner/admin only — mounted inside the Signing panel).
// Persists the clinic's address + optional map coordinates so the wallet app can
// display the clinic location later.
export function ClinicLocationSection() {
  const { t, i18n } = useTranslation();
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let active = true;
    getClinicSettings()
      .then((settings) => {
        if (!active) return;
        const loc = settings.location;
        setAddress(loc.address);
        setCity(loc.city);
        setCountry(loc.country);
        setLatitude(loc.latitude === null ? "" : String(loc.latitude));
        setLongitude(loc.longitude === null ? "" : String(loc.longitude));
      })
      .catch(() => {
        /* keep empty defaults */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Fill the location from the browser's geolocation (the clinician runs this on
  // a device at the clinic): sets the coordinates, then reverse-geocodes them to
  // also fill address / city / country. The address lookup is best-effort — on
  // failure we keep the coordinates and just tell the user to fill the rest.
  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      notify.error(
        t("settings.location.errorTitle"),
        t("settings.location.geoUnsupported"),
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        const place = await reverseGeocode(lat, lng, i18n.language);
        setLocating(false);
        if (place) {
          if (place.address) setAddress(place.address);
          if (place.city) setCity(place.city);
          if (place.country) setCountry(place.country);
        } else {
          notify.info(
            t("settings.location.savedTitle"),
            t("settings.location.geoPartial"),
          );
        }
      },
      () => {
        setLocating(false);
        notify.error(
          t("settings.location.errorTitle"),
          t("settings.location.geoError"),
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const save = async () => {
    const lat = parseCoord(latitude);
    const lng = parseCoord(longitude);
    if (lat === false || lng === false) {
      notify.error(
        t("settings.location.errorTitle"),
        t("settings.location.invalidCoords"),
      );
      return;
    }
    setSaving(true);
    try {
      await saveClinicLocation({
        address: address.trim(),
        city: city.trim(),
        country: country.trim(),
        latitude: lat,
        longitude: lng,
      });
      notify.success(
        t("settings.location.savedTitle"),
        t("settings.location.savedBody"),
      );
    } catch {
      notify.error(
        t("settings.location.errorTitle"),
        t("settings.location.error"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      description={t("settings.location.description")}
      title={t("settings.location.title")}
    >
      <SettingsCard className="flex flex-col gap-4 p-5">
        <label className="flex flex-col gap-1.5">
          <FieldLabel>{t("settings.location.address")}</FieldLabel>
          <Input
            disabled={loading}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("settings.location.addressPlaceholder")}
            value={address}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("settings.location.city")}</FieldLabel>
            <Input
              disabled={loading}
              onChange={(e) => setCity(e.target.value)}
              value={city}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("settings.location.country")}</FieldLabel>
            <Input
              disabled={loading}
              onChange={(e) => setCountry(e.target.value)}
              value={country}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("settings.location.latitude")}</FieldLabel>
            <Input
              disabled={loading}
              inputMode="decimal"
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="e.g. 2.0469"
              value={latitude}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("settings.location.longitude")}</FieldLabel>
            <Input
              disabled={loading}
              inputMode="decimal"
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="e.g. 45.3182"
              value={longitude}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("settings.location.coordinatesHint")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            className={cn("rounded-lg", whiteButton)}
            disabled={loading || saving}
            onClick={save}
            type="button"
          >
            {saving
              ? t("settings.location.saving")
              : t("settings.location.save")}
          </Button>
          <Button
            className="rounded-lg"
            disabled={loading || locating}
            onClick={useMyLocation}
            type="button"
            variant="outline"
          >
            <LocateFixed className="size-4" />
            {locating
              ? t("settings.location.locating")
              : t("settings.location.useMyLocation")}
          </Button>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
