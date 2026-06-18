"use client";

// Lets a clinician edit an AI-proposed record before it is committed. Driven by
// a small per-kind schema (EDIT_SCHEMAS) so every action kind — appointment,
// task, prescription, invoice, inventory — gets the right fields, including
// array fields (invoice line items, inventory items) edited as add/remove rows.

import { Plus, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ActionPreviewKind } from "@/lib/ai-chat";
import { cn } from "@/lib/utils";

type FieldType = "text" | "number" | "select";

type FieldDef = {
  key: string;
  labelKey: string;
  type?: FieldType;
  // For select fields: option values + an i18n key prefix resolved as `${prefix}.${value}`.
  options?: { value: string; labelPrefix: string }[];
};

type ListDef = {
  key: string;
  labelKey: string;
  itemFields: FieldDef[];
  blank: Record<string, unknown>;
};

type KindSchema = { fields: FieldDef[]; list?: ListDef };

const controlClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const PRIORITY_OPTIONS = [
  { value: "high", labelPrefix: "tasks.priority" },
  { value: "medium", labelPrefix: "tasks.priority" },
  { value: "low", labelPrefix: "tasks.priority" },
];

export const EDIT_SCHEMAS: Record<ActionPreviewKind, KindSchema> = {
  appointment: {
    fields: [
      { key: "name", labelKey: "chat.actionCard.fields.name" },
      { key: "date", labelKey: "chat.actionCard.fields.date" },
      { key: "time", labelKey: "chat.actionCard.fields.time" },
      { key: "type", labelKey: "chat.actionCard.fields.type" },
      { key: "provider", labelKey: "chat.actionCard.fields.provider" },
    ],
  },
  task: {
    fields: [
      { key: "title", labelKey: "chat.actionCard.fields.title" },
      { key: "assignee", labelKey: "chat.actionCard.fields.assignee" },
      { key: "due", labelKey: "chat.actionCard.fields.due" },
      {
        key: "priority",
        labelKey: "chat.actionCard.fields.priority",
        type: "select",
        options: PRIORITY_OPTIONS,
      },
      { key: "patient", labelKey: "chat.actionCard.fields.patient" },
    ],
  },
  prescription: {
    fields: [
      { key: "medication", labelKey: "chat.actionCard.fields.medication" },
      { key: "dose", labelKey: "chat.actionCard.fields.dose" },
      { key: "frequency", labelKey: "chat.actionCard.fields.frequency" },
      { key: "duration", labelKey: "chat.actionCard.fields.duration" },
      { key: "name", labelKey: "chat.actionCard.fields.name" },
    ],
  },
  invoice: {
    fields: [{ key: "name", labelKey: "chat.actionCard.fields.name" }],
    list: {
      key: "lineItems",
      labelKey: "chat.actionCard.fields.lineItems",
      itemFields: [
        { key: "description", labelKey: "chat.actionCard.fields.description" },
        {
          key: "quantity",
          labelKey: "chat.actionCard.fields.quantity",
          type: "number",
        },
        {
          key: "unitPrice",
          labelKey: "chat.actionCard.fields.unitPrice",
          type: "number",
        },
      ],
      blank: { description: "", quantity: 1, unitPrice: 0 },
    },
  },
  inventory: {
    fields: [],
    list: {
      key: "items",
      labelKey: "chat.actionCard.fields.items",
      itemFields: [
        { key: "name", labelKey: "chat.actionCard.fields.itemName" },
        { key: "strength", labelKey: "chat.actionCard.fields.strength" },
        {
          key: "stockQuantity",
          labelKey: "chat.actionCard.fields.stockQuantity",
          type: "number",
        },
      ],
      blank: { name: "", strength: "", stockQuantity: 0 },
    },
  },
};

type Rec = Record<string, unknown>;

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { t } = useTranslation();
  if (field.type === "select" && field.options) {
    return (
      <select
        aria-label={t(field.labelKey)}
        className={controlClass}
        onChange={(e) => onChange(e.target.value)}
        value={String(value ?? "")}
      >
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {t(`${o.labelPrefix}.${o.value}`)}
          </option>
        ))}
      </select>
    );
  }
  return (
    <Input
      aria-label={t(field.labelKey)}
      inputMode={field.type === "number" ? "numeric" : undefined}
      onChange={(e) =>
        onChange(
          field.type === "number"
            ? e.target.value === ""
              ? ""
              : Number(e.target.value)
            : e.target.value,
        )
      }
      value={value === null || value === undefined ? "" : String(value)}
    />
  );
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  );
}

export function RecordEditDialog({
  kind,
  record,
  open,
  onOpenChange,
  onSave,
}: {
  kind: ActionPreviewKind;
  record: Rec;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (record: Rec) => void;
}) {
  const { t } = useTranslation();
  const schema = EDIT_SCHEMAS[kind];
  const [draft, setDraft] = useState<Rec>(record);

  // Re-seed the draft whenever a fresh record is opened for editing.
  useEffect(() => {
    if (open) setDraft(record);
  }, [open, record]);

  const setField = (key: string, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const list = schema.list;
  const listRows = (list ? (draft[list.key] as Rec[] | undefined) : undefined) ?? [];
  const setRows = (rows: Rec[]) => list && setField(list.key, rows);

  const save = () => {
    onSave(draft);
    onOpenChange(false);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="max-h-[85dvh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("chat.actionCard.edit.title")}</DialogTitle>
        </DialogHeader>

        <DialogPanel className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {schema.fields.map((field) => (
            <Labelled key={field.key} label={t(field.labelKey)}>
              <FieldInput
                field={field}
                onChange={(v) => setField(field.key, v)}
                value={draft[field.key]}
              />
            </Labelled>
          ))}

          {list && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(list.labelKey)}
                </span>
                <Button
                  onClick={() => setRows([...listRows, { ...list.blank }])}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Plus className="size-4" />
                  {t("chat.actionCard.edit.addRow")}
                </Button>
              </div>
              {listRows.map((row, index) => (
                <div className="flex items-center gap-2" key={index}>
                  {list.itemFields.map((field) => (
                    <FieldInput
                      field={field}
                      key={field.key}
                      onChange={(v) =>
                        setRows(
                          listRows.map((r, i) =>
                            i === index ? { ...r, [field.key]: v } : r,
                          ),
                        )
                      }
                      value={row[field.key]}
                    />
                  ))}
                  <button
                    aria-label={t("chat.actionCard.edit.removeRow")}
                    className={cn(
                      "shrink-0 text-muted-foreground transition-colors hover:text-foreground",
                    )}
                    onClick={() =>
                      setRows(listRows.filter((_, i) => i !== index))
                    }
                    type="button"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("chat.actionCard.edit.cancel")}
          </DialogClose>
          <Button onClick={save} type="button">
            {t("chat.actionCard.edit.save")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
