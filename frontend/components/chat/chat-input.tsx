"use client";

import type { ChatStatus } from "ai";
import {
  ArrowUp,
  Building2,
  CalendarRange,
  ChevronDown,
  Hand,
  Mic,
  Plus,
  Square,
  Stethoscope,
  UserPlus,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { PatientFormDialog } from "@/components/chat/patient-form-dialog";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/utils";

type ChatInputProps = {
  onSubmit: (text: string) => void;
  status: ChatStatus;
  onStop?: () => void;
};

type Option = { value: string; label: string };
type OptionKey = { value: string; labelKey: string };

const ACCESS_OPTIONS: OptionKey[] = [
  { value: "standard", labelKey: "chat.input.access.standard" },
  { value: "break-glass", labelKey: "chat.input.access.breakGlass" },
  { value: "read-only", labelKey: "chat.input.access.readOnly" },
];
const RESPONSE_OPTIONS: OptionKey[] = [
  { value: "concise", labelKey: "chat.input.response.concise" },
  { value: "detailed", labelKey: "chat.input.response.detailed" },
  { value: "comprehensive", labelKey: "chat.input.response.comprehensive" },
];
const SPECIALTY_OPTIONS: OptionKey[] = [
  { value: "internal-medicine", labelKey: "chat.input.specialtyOptions.internalMedicine" },
  { value: "cardiology", labelKey: "chat.input.specialtyOptions.cardiology" },
  { value: "pediatrics", labelKey: "chat.input.specialtyOptions.pediatrics" },
  { value: "emergency", labelKey: "chat.input.specialtyOptions.emergency" },
  { value: "all", labelKey: "chat.input.specialtyOptions.all" },
];
const FACILITY_OPTIONS: OptionKey[] = [
  { value: "main-hospital", labelKey: "chat.input.facilityOptions.mainHospital" },
  { value: "north-clinic", labelKey: "chat.input.facilityOptions.northClinic" },
  { value: "telehealth", labelKey: "chat.input.facilityOptions.telehealth" },
];
const TIME_OPTIONS: OptionKey[] = [
  { value: "30d", labelKey: "chat.input.timeOptions.30d" },
  { value: "12m", labelKey: "chat.input.timeOptions.12m" },
  { value: "5y", labelKey: "chat.input.timeOptions.5y" },
  { value: "all", labelKey: "chat.input.timeOptions.all" },
];

const iconButton =
  "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const pillButton =
  "flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const contextPill =
  "flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground";

function SelectPill({
  ariaLabel,
  triggerClassName,
  chevronClassName,
  icon,
  prefix,
  value,
  onValueChange,
  options,
  align = "start",
}: {
  ariaLabel: string;
  triggerClassName: string;
  chevronClassName: string;
  icon: ReactNode;
  prefix?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  align?: "start" | "center" | "end";
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <Menu>
      <MenuTrigger
        render={
          <button aria-label={ariaLabel} className={triggerClassName} type="button" />
        }
      >
        {icon}
        {prefix ? (
          <span className="font-medium text-foreground">{prefix}</span>
        ) : null}
        <span className="truncate">{selected?.label}</span>
        <ChevronDown className={chevronClassName} />
      </MenuTrigger>
      <MenuPopup align={align}>
        <MenuRadioGroup onValueChange={onValueChange} value={value}>
          {options.map((option) => (
            <MenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}

export function ChatInput({ onSubmit, status, onStop }: ChatInputProps) {
  const { t } = useTranslation();
  const toOptions = useCallback(
    (opts: OptionKey[]): Option[] =>
      opts.map((o) => ({ value: o.value, label: t(o.labelKey) })),
    [t],
  );
  const accessOptions = useMemo(() => toOptions(ACCESS_OPTIONS), [toOptions]);
  const responseOptions = useMemo(() => toOptions(RESPONSE_OPTIONS), [toOptions]);
  const specialtyOptions = useMemo(
    () => toOptions(SPECIALTY_OPTIONS),
    [toOptions],
  );
  const facilityOptions = useMemo(() => toOptions(FACILITY_OPTIONS), [toOptions]);
  const timeOptions = useMemo(() => toOptions(TIME_OPTIONS), [toOptions]);

  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [access, setAccess] = useState("standard");
  const [responseMode, setResponseMode] = useState("detailed");
  const [specialty, setSpecialty] = useState("internal-medicine");
  const [facility, setFacility] = useState("main-hospital");
  const [timeRange, setTimeRange] = useState("12m");
  const [addOpen, setAddOpen] = useState(false);
  // Bumped on each open so the dialog remounts with a fresh file number + form.
  const [addKey, setAddKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGenerating = status === "submitted" || status === "streaming";
  const canSend =
    (value.trim().length > 0 || files.length > 0) && !isGenerating;

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && files.length === 0) || isGenerating) {
      return;
    }
    const parts: string[] = [];
    if (trimmed) {
      parts.push(trimmed);
    }
    if (files.length > 0) {
      parts.push(`[Attached: ${files.map((file) => file.name).join(", ")}]`);
    }
    onSubmit(parts.join("\n\n"));
    setValue("");
    setFiles([]);
  }, [value, files, isGenerating, onSubmit]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault();
        submit();
      }
    },
    [submit]
  );

  const handleFilesSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files;
      if (selected && selected.length > 0) {
        setFiles((prev) => [...prev, ...Array.from(selected)]);
      }
      // Reset so picking the same file again still fires onChange.
      event.target.value = "";
    },
    []
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <>
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="w-full overflow-hidden rounded-[28px] border border-border/60 bg-muted shadow-sm"
    >
      {/* Top (lighter) card: textarea + toolbar, with a slightly smaller bottom radius */}
      <div className="rounded-b-[22px] bg-input">
        <textarea
          aria-label={t("chat.input.message")}
          className="field-sizing-content block max-h-48 min-h-16 w-full resize-none bg-transparent px-5 pt-5 pb-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.input.placeholder")}
          rows={1}
          value={value}
        />

        {files.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
            {files.map((file, index) => (
              <span
                className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs text-foreground"
                key={`${file.name}-${file.size}-${index}`}
              >
                <span className="max-w-40 truncate">{file.name}</span>
                <button
                  aria-label={t("chat.input.removeFile", { name: file.name })}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => removeFile(index)}
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          aria-label={t("chat.input.attachFiles")}
          className="hidden"
          multiple
          onChange={handleFilesSelected}
          ref={fileInputRef}
          type="file"
        />

        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <div className="flex min-w-0 items-center gap-1">
            <button
              aria-label={t("chat.input.attachFile")}
              className={iconButton}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Plus className="size-[18px]" />
            </button>
            <SelectPill
              ariaLabel={t("chat.input.accessLevel")}
              chevronClassName="size-4 opacity-70"
              icon={<Hand className="size-4" />}
              onValueChange={setAccess}
              options={accessOptions}
              triggerClassName={pillButton}
              value={access}
            />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <SelectPill
              align="end"
              ariaLabel={t("chat.input.responseMode")}
              chevronClassName="size-4 opacity-70"
              icon={null}
              onValueChange={setResponseMode}
              options={responseOptions}
              prefix={t("chat.input.clinical")}
              triggerClassName={cn(pillButton, "mr-1")}
              value={responseMode}
            />
            <button
              aria-label={t("chat.input.dictate")}
              className={iconButton}
              type="button"
            >
              <Mic className="size-[18px]" />
            </button>
            <button
              aria-label={isGenerating ? t("chat.input.stop") : t("chat.input.send")}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
                canSend || isGenerating
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-muted-foreground/30 text-foreground/70"
              )}
              disabled={!(canSend || isGenerating)}
              onClick={isGenerating && onStop ? onStop : undefined}
              type={isGenerating && onStop ? "button" : "submit"}
            >
              {isGenerating ? (
                <Square className="size-3.5" />
              ) : (
                <ArrowUp className="size-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom (darker) card peeking out below, more rounded: context selectors */}
      <div className="flex flex-wrap items-center gap-1 px-3 pt-2.5 pb-3">
        <SelectPill
          ariaLabel={t("chat.input.specialty")}
          chevronClassName="size-3.5 opacity-70"
          icon={<Stethoscope className="size-4" />}
          onValueChange={setSpecialty}
          options={specialtyOptions}
          triggerClassName={contextPill}
          value={specialty}
        />
        <SelectPill
          ariaLabel={t("chat.input.facility")}
          chevronClassName="size-3.5 opacity-70"
          icon={<Building2 className="size-4" />}
          onValueChange={setFacility}
          options={facilityOptions}
          triggerClassName={contextPill}
          value={facility}
        />
        <SelectPill
          ariaLabel={t("chat.input.timeRange")}
          chevronClassName="size-3.5 opacity-70"
          icon={<CalendarRange className="size-4" />}
          onValueChange={setTimeRange}
          options={timeOptions}
          triggerClassName={contextPill}
          value={timeRange}
        />
        <button
          className={cn(contextPill, "ml-auto")}
          onClick={() => {
            setAddKey((k) => k + 1);
            setAddOpen(true);
          }}
          type="button"
        >
          <UserPlus className="size-4" />
          <span>{t("chat.input.addPatient")}</span>
        </button>
      </div>
    </form>

    <PatientFormDialog
      key={addKey}
      mode="create"
      onCreated={(fileNumber) => onSubmit(`/patient ${fileNumber}`)}
      onOpenChange={setAddOpen}
      open={addOpen}
    />
    </>
  );
}
