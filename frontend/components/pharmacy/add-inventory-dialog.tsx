"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { InventoryInput } from "@/lib/inventory";
import { notify } from "@/lib/toast";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  );
}

// "Add item" dialog for the pharmacy inventory. Only the medication name is
// required (matches the backend schema); the rest is optional descriptive +
// stock detail. The new item is handed back via onAdd, which persists it
// through the inventory API and prepends it to the page list.
export function AddInventoryDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: InventoryInput) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [form, setForm] = useState("");
  const [strength, setStrength] = useState("");
  const [unit, setUnit] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [reorderThreshold, setReorderThreshold] = useState("0");
  const [location, setLocation] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const reset = () => {
    setName("");
    setForm("");
    setStrength("");
    setUnit("");
    setStockQuantity("0");
    setReorderThreshold("0");
    setLocation("");
    setExpiresAt("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      notify.error(
        t("inventory.dialog.nameRequiredTitle"),
        t("inventory.dialog.nameRequiredBody"),
      );
      return;
    }
    onAdd({
      name: trimmed,
      form: form.trim(),
      strength: strength.trim(),
      unit: unit.trim(),
      stockQuantity: Number.parseInt(stockQuantity, 10) || 0,
      reorderThreshold: Number.parseInt(reorderThreshold, 10) || 0,
      location: location.trim(),
      expiresAt: expiresAt || null,
    });
    notify.success(t("inventory.dialog.addedTitle"), trimmed);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      open={open}
    >
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("inventory.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("inventory.dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <form className="contents" onSubmit={submit}>
          <DialogPanel className="flex flex-col gap-4">
            <Field label={t("inventory.dialog.name")}>
              <Input
                autoFocus
                onChange={(event) => setName(event.target.value)}
                placeholder={t("inventory.dialog.namePlaceholder")}
                value={name}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("inventory.dialog.form")}>
                <Input
                  onChange={(event) => setForm(event.target.value)}
                  placeholder={t("inventory.dialog.formPlaceholder")}
                  value={form}
                />
              </Field>
              <Field label={t("inventory.dialog.strength")}>
                <Input
                  onChange={(event) => setStrength(event.target.value)}
                  placeholder={t("inventory.dialog.strengthPlaceholder")}
                  value={strength}
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label={t("inventory.dialog.stock")}>
                <Input
                  inputMode="numeric"
                  min={0}
                  onChange={(event) => setStockQuantity(event.target.value)}
                  type="number"
                  value={stockQuantity}
                />
              </Field>
              <Field label={t("inventory.dialog.unit")}>
                <Input
                  onChange={(event) => setUnit(event.target.value)}
                  placeholder={t("inventory.dialog.unitPlaceholder")}
                  value={unit}
                />
              </Field>
              <Field label={t("inventory.dialog.reorder")}>
                <Input
                  inputMode="numeric"
                  min={0}
                  onChange={(event) => setReorderThreshold(event.target.value)}
                  type="number"
                  value={reorderThreshold}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("inventory.dialog.location")}>
                <Input
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder={t("inventory.dialog.locationPlaceholder")}
                  value={location}
                />
              </Field>
              <Field label={t("inventory.dialog.expires")}>
                <Input
                  onChange={(event) => setExpiresAt(event.target.value)}
                  type="date"
                  value={expiresAt}
                />
              </Field>
            </div>
          </DialogPanel>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("inventory.dialog.cancel")}
            </DialogClose>
            <Button disabled={!name.trim()} type="submit">
              {t("inventory.dialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
