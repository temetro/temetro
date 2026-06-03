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
  useRef,
  useState,
} from "react";

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

const ACCESS_OPTIONS: Option[] = [
  { value: "standard", label: "Standard access" },
  { value: "break-glass", label: "Break-glass (emergency)" },
  { value: "read-only", label: "Read-only" },
];
const RESPONSE_OPTIONS: Option[] = [
  { value: "concise", label: "Concise" },
  { value: "detailed", label: "Detailed" },
  { value: "comprehensive", label: "Comprehensive" },
];
const SPECIALTY_OPTIONS: Option[] = [
  { value: "internal-medicine", label: "Internal Medicine" },
  { value: "cardiology", label: "Cardiology" },
  { value: "pediatrics", label: "Pediatrics" },
  { value: "emergency", label: "Emergency" },
  { value: "all", label: "All specialties" },
];
const FACILITY_OPTIONS: Option[] = [
  { value: "main-hospital", label: "Main Hospital" },
  { value: "north-clinic", label: "North Clinic" },
  { value: "telehealth", label: "Telehealth" },
];
const TIME_OPTIONS: Option[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "5y", label: "Last 5 years" },
  { value: "all", label: "All time" },
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
      className="w-full overflow-hidden rounded-[28px] border border-border/60 bg-[oklch(0.195_0.006_277)] shadow-sm"
    >
      {/* Top (lighter) card: textarea + toolbar, with a slightly smaller bottom radius */}
      <div className="rounded-b-[22px] bg-[oklch(0.218_0.006_277)]">
        <textarea
          aria-label="Message"
          className="field-sizing-content block max-h-48 min-h-16 w-full resize-none bg-transparent px-5 pt-5 pb-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Look up a patient — try /patient 10293"
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
                  aria-label={`Remove ${file.name}`}
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
          aria-label="Attach files"
          className="hidden"
          multiple
          onChange={handleFilesSelected}
          ref={fileInputRef}
          type="file"
        />

        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <div className="flex min-w-0 items-center gap-1">
            <button
              aria-label="Attach file"
              className={iconButton}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Plus className="size-[18px]" />
            </button>
            <SelectPill
              ariaLabel="Access level"
              chevronClassName="size-4 opacity-70"
              icon={<Hand className="size-4" />}
              onValueChange={setAccess}
              options={ACCESS_OPTIONS}
              triggerClassName={pillButton}
              value={access}
            />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <SelectPill
              align="end"
              ariaLabel="Response mode"
              chevronClassName="size-4 opacity-70"
              icon={null}
              onValueChange={setResponseMode}
              options={RESPONSE_OPTIONS}
              prefix="Clinical"
              triggerClassName={cn(pillButton, "mr-1")}
              value={responseMode}
            />
            <button aria-label="Dictate" className={iconButton} type="button">
              <Mic className="size-[18px]" />
            </button>
            <button
              aria-label={isGenerating ? "Stop" : "Send"}
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
          ariaLabel="Specialty"
          chevronClassName="size-3.5 opacity-70"
          icon={<Stethoscope className="size-4" />}
          onValueChange={setSpecialty}
          options={SPECIALTY_OPTIONS}
          triggerClassName={contextPill}
          value={specialty}
        />
        <SelectPill
          ariaLabel="Facility"
          chevronClassName="size-3.5 opacity-70"
          icon={<Building2 className="size-4" />}
          onValueChange={setFacility}
          options={FACILITY_OPTIONS}
          triggerClassName={contextPill}
          value={facility}
        />
        <SelectPill
          ariaLabel="Time range"
          chevronClassName="size-3.5 opacity-70"
          icon={<CalendarRange className="size-4" />}
          onValueChange={setTimeRange}
          options={TIME_OPTIONS}
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
          <span>Add patient</span>
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
