"use client";

import {
  ArrowLeft,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Loader2,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  bookPortalAppointment,
  getPortalClinic,
  lookupPortalResults,
  type PortalBookingResult,
  type PortalResults,
} from "@/lib/portal";

type Step = "choose" | "book" | "results";

const todayKey = () => new Date().toISOString().slice(0, 10);

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="font-medium text-foreground text-sm">{label}</span>
      {children}
    </label>
  );
}

export function PortalKiosk({ clinic }: { clinic: string }) {
  const { t } = useTranslation();
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState<Step>("choose");

  useEffect(() => {
    getPortalClinic(clinic)
      .then((c) => setClinicName(c.name))
      .catch(() => setNotFound(true));
  }, [clinic]);

  if (notFound) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarCheck />
            </EmptyMedia>
            <EmptyTitle>{t("portal.notFoundTitle")}</EmptyTitle>
            <EmptyDescription>{t("portal.notFoundBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
          {t("portal.kicker")}
        </span>
        <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">
          {clinicName ?? "…"}
        </h1>
      </header>

      {step === "choose" ? (
        <ChooseStep onPick={setStep} />
      ) : step === "book" ? (
        <BookStep clinic={clinic} onBack={() => setStep("choose")} />
      ) : (
        <ResultsStep clinic={clinic} onBack={() => setStep("choose")} />
      )}
    </div>
  );
}

// Card-style radio: two large, touch-friendly choices.
function ChooseStep({ onPick }: { onPick: (step: Step) => void }) {
  const { t } = useTranslation();
  const cards: { step: Step; icon: React.ReactNode; title: string; desc: string }[] =
    [
      {
        step: "book",
        icon: <CalendarPlus className="size-7" />,
        title: t("portal.choose.bookTitle"),
        desc: t("portal.choose.bookDesc"),
      },
      {
        step: "results",
        icon: <FlaskConical className="size-7" />,
        title: t("portal.choose.resultsTitle"),
        desc: t("portal.choose.resultsDesc"),
      },
    ];
  return (
    <div className="grid w-full gap-4 sm:grid-cols-2">
      {cards.map((c) => (
        <button
          className="group flex flex-col items-start gap-4 rounded-3xl border bg-card/40 p-6 text-left transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          key={c.step}
          onClick={() => onPick(c.step)}
          type="button"
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {c.icon}
          </span>
          <span className="flex flex-col gap-1">
            <span className="flex items-center gap-1 font-semibold text-lg text-foreground">
              {c.title}
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="text-muted-foreground text-sm">{c.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      className="flex items-center gap-1.5 self-start text-muted-foreground text-sm transition-colors hover:text-foreground"
      onClick={onBack}
      type="button"
    >
      <ArrowLeft className="size-4" />
      {t("portal.back")}
    </button>
  );
}

function BookStep({ clinic, onBack }: { clinic: string; onBack: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [fileNumber, setFileNumber] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PortalBookingResult | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await bookPortalAppointment(clinic, {
        name: name.trim(),
        fileNumber: fileNumber.trim(),
        date,
        time,
        type: type.trim() || undefined,
      });
      setDone(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("portal.book.errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCircle2 />
            </EmptyMedia>
            <EmptyTitle>{t("portal.book.successTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("portal.book.successBody", {
                date: done.date,
                time: done.time,
              })}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
        <Button onClick={onBack} variant="outline">
          {t("portal.done")}
        </Button>
      </div>
    );
  }

  return (
    <form className="flex w-full flex-col gap-4" onSubmit={submit}>
      <BackButton onBack={onBack} />
      <h2 className="font-semibold text-xl">{t("portal.book.title")}</h2>
      <Field label={t("portal.field.name")}>
        <Input onChange={(e) => setName(e.target.value)} required value={name} />
      </Field>
      <Field label={t("portal.field.fileNumber")}>
        <Input
          onChange={(e) => setFileNumber(e.target.value)}
          required
          value={fileNumber}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("portal.field.date")}>
          <Input
            min={todayKey()}
            onChange={(e) => setDate(e.target.value)}
            required
            type="date"
            value={date}
          />
        </Field>
        <Field label={t("portal.field.time")}>
          <Input
            onChange={(e) => setTime(e.target.value)}
            required
            type="time"
            value={time}
          />
        </Field>
      </div>
      <Field label={t("portal.field.reason")}>
        <Input
          onChange={(e) => setType(e.target.value)}
          placeholder={t("portal.field.reasonPlaceholder")}
          value={type}
        />
      </Field>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button disabled={busy} size="lg" type="submit">
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {t("portal.book.submit")}
      </Button>
    </form>
  );
}

function ResultsStep({ clinic, onBack }: { clinic: string; onBack: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [fileNumber, setFileNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalResults | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setData(
        await lookupPortalResults(clinic, fileNumber.trim(), name.trim()),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("portal.results.errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  };

  if (data) {
    return (
      <div className="flex w-full flex-col gap-4">
        <BackButton onBack={onBack} />
        <h2 className="font-semibold text-xl">
          {t("portal.results.greeting", { name: data.name })}
        </h2>

        <div className="rounded-2xl border bg-card/40 p-4">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {t("portal.results.upcoming")}
          </p>
          {data.upcoming.length === 0 ? (
            <p className="mt-2 text-muted-foreground text-sm">
              {t("portal.results.noUpcoming")}
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {data.upcoming.map((a) => (
                <li
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2"
                  key={`${a.date}-${a.time}`}
                >
                  <span className="font-medium text-foreground text-sm tabular-nums">
                    {a.date} · {a.time}
                  </span>
                  <span className="truncate text-muted-foreground text-sm">
                    {a.type} · {a.provider}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border bg-card/40 p-4">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {t("portal.results.resultsLabel")}
          </p>
          <p className="mt-2 text-foreground text-sm">
            {data.hasResults
              ? t("portal.results.ready", { count: data.resultCount })
              : t("portal.results.none")}
          </p>
          {data.hasResults ? (
            <p className="mt-1 text-muted-foreground text-xs">
              {t("portal.results.askStaff")}
            </p>
          ) : null}
        </div>

        <Button onClick={() => setData(null)} variant="outline">
          {t("portal.results.lookupAnother")}
        </Button>
      </div>
    );
  }

  return (
    <form className="flex w-full flex-col gap-4" onSubmit={submit}>
      <BackButton onBack={onBack} />
      <h2 className="font-semibold text-xl">{t("portal.results.title")}</h2>
      <p className="text-muted-foreground text-sm">{t("portal.results.subtitle")}</p>
      <Field label={t("portal.field.name")}>
        <Input onChange={(e) => setName(e.target.value)} required value={name} />
      </Field>
      <Field label={t("portal.field.fileNumber")}>
        <Input
          onChange={(e) => setFileNumber(e.target.value)}
          required
          value={fileNumber}
        />
      </Field>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button disabled={busy} size="lg" type="submit">
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {t("portal.results.submit")}
      </Button>
    </form>
  );
}
