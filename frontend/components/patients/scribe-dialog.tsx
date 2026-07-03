"use client";

import { Mic, Square, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { uploadAttachment } from "@/lib/attachments";
import type { Encounter, Patient } from "@/lib/patients";
import { draftNote, saveNote, transcribeRecording } from "@/lib/scribe";
import { notify } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";

type Phase = "input" | "processing" | "review";
type InputTab = "record" | "paste";
type RecState = "idle" | "recording" | "recorded";

// Pick a supported audio mime for MediaRecorder (Opus in WebM/OGG is tiny for
// speech; Safari falls back to mp4). Returns "" to let the browser choose.
function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// The ambient AI scribe: record or paste a visit conversation, draft a SOAP
// encounter note, review it, and append it to the patient record.
export function ScribeDialog({
  patient,
  open,
  onOpenChange,
  onSaved,
}: {
  patient: Patient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Patient) => void;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("input");
  const [tab, setTab] = useState<InputTab>("record");
  const [recState, setRecState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [visitType, setVisitType] = useState("");
  const [draft, setDraft] = useState<Encounter | null>(null);
  const [veilNote, setVeilNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tear down any live recording + object state when the dialog closes.
  const stopTracks = () => {
    mediaRef.current?.stream.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // Stop tracks on unmount.
  useEffect(() => () => stopTracks(), []);

  // Reset all state for the next open. Called on every close (the parent only
  // ever closes this dialog through our onOpenChange), so no reset-in-effect.
  const reset = () => {
    setPhase("input");
    setTab("record");
    setRecState("idle");
    setElapsed(0);
    setTranscript("");
    setVisitType("");
    setDraft(null);
    setVeilNote(null);
    setError(null);
    chunksRef.current = [];
    blobRef.current = null;
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      stopTracks();
      reset();
    }
    onOpenChange(next);
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickAudioMime();
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setRecState("recorded");
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError(t("scribe.errors.mic"));
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach((track) => track.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const discardRecording = () => {
    blobRef.current = null;
    chunksRef.current = [];
    setRecState("idle");
    setElapsed(0);
  };

  const filenameFor = (blob: Blob): string => {
    const ext = blob.type.includes("mp4")
      ? "m4a"
      : blob.type.includes("ogg")
        ? "ogg"
        : "webm";
    return `visit-${patient.fileNumber}-${Date.now()}.${ext}`;
  };

  const generate = async () => {
    setError(null);
    setPhase("processing");
    try {
      let text = transcript.trim();
      if (tab === "record") {
        const blob = blobRef.current;
        if (!blob) {
          setError(t("scribe.errors.noRecording"));
          setPhase("input");
          return;
        }
        // Store the recording as a patient attachment (auditable), then
        // transcribe it server-side.
        const file = new File([blob], filenameFor(blob), { type: blob.type });
        const attachment = await uploadAttachment({
          file,
          fileNumber: patient.fileNumber,
          labKey: "scribe",
        });
        const res = await transcribeRecording(attachment.id);
        text = res.transcript.trim();
        setTranscript(text);
      }
      if (!text) {
        setError(t("scribe.errors.empty"));
        setPhase("input");
        return;
      }
      const { draft: note, veil } = await draftNote({
        fileNumber: patient.fileNumber,
        transcript: text,
        visitType: visitType.trim() || undefined,
      });
      setDraft(note);
      setVeilNote(
        veil.active ? t("scribe.review.veil", { provider: veil.provider }) : null,
      );
      setPhase("review");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("scribe.errors.generic"),
      );
      setPhase("input");
    }
  };

  const save = async () => {
    if (!draft) return;
    setPhase("processing");
    try {
      const updated = await saveNote(patient.fileNumber, draft);
      notify.success(t("scribe.saved.title"), patient.name);
      onSaved(updated);
      handleOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("scribe.errors.generic"),
      );
      setPhase("review");
    }
  };

  const busy = phase === "processing";

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogPopup className="flex max-h-[85dvh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {t("scribe.title")}
          </DialogTitle>
          <DialogDescription>
            {t("scribe.subtitle", { name: patient.name })}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="min-h-0 flex-1 overflow-y-auto">
          {phase === "review" && draft ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="scribe-type">{t("scribe.review.type")}</Label>
                  <Input
                    id="scribe-type"
                    onChange={(e) =>
                      setDraft({ ...draft, type: e.target.value })
                    }
                    value={draft.type}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="scribe-date">{t("scribe.review.date")}</Label>
                  <Input
                    id="scribe-date"
                    onChange={(e) =>
                      setDraft({ ...draft, date: e.target.value })
                    }
                    type="date"
                    value={draft.date}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scribe-summary">
                  {t("scribe.review.summary")}
                </Label>
                <Textarea
                  className="min-h-56"
                  id="scribe-summary"
                  onChange={(e) =>
                    setDraft({ ...draft, summary: e.target.value })
                  }
                  value={draft.summary}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {t("scribe.review.provider", { provider: draft.provider })}
              </p>
              {veilNote && (
                <p className="rounded-lg bg-muted px-3 py-2 text-muted-foreground text-xs">
                  {veilNote}
                </p>
              )}
            </div>
          ) : (
            <Tabs
              onValueChange={(v) => setTab(v as InputTab)}
              value={tab}
            >
              <TabsList className="w-full">
                <TabsTab value="record">
                  <Mic className="size-4" />
                  {t("scribe.tabs.record")}
                </TabsTab>
                <TabsTab value="paste">{t("scribe.tabs.paste")}</TabsTab>
              </TabsList>

              <TabsPanel className="pt-3" value="record">
                <div className="flex flex-col items-center gap-4 py-4">
                  {recState === "recording" ? (
                    <>
                      <div className="flex items-center gap-2 text-destructive">
                        <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
                        <span className="font-mono text-lg tabular-nums">
                          {fmtElapsed(elapsed)}
                        </span>
                      </div>
                      <Button
                        onClick={stopRecording}
                        type="button"
                        variant="destructive"
                      >
                        <Square className="size-4" />
                        {t("scribe.record.stop")}
                      </Button>
                    </>
                  ) : recState === "recorded" ? (
                    <>
                      <p className="text-foreground text-sm">
                        {t("scribe.record.ready", {
                          duration: fmtElapsed(elapsed),
                        })}
                      </p>
                      <Button
                        onClick={discardRecording}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Trash2 className="size-4" />
                        {t("scribe.record.discard")}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={startRecording} type="button">
                      <Mic className="size-4" />
                      {t("scribe.record.start")}
                    </Button>
                  )}
                </div>
              </TabsPanel>

              <TabsPanel className="pt-3" value="paste">
                <Textarea
                  className="min-h-40"
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder={t("scribe.paste.placeholder")}
                  value={transcript}
                />
              </TabsPanel>

              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="scribe-visit-type">
                    {t("scribe.visitType.label")}
                  </Label>
                  <Input
                    id="scribe-visit-type"
                    onChange={(e) => setVisitType(e.target.value)}
                    placeholder={t("scribe.visitType.placeholder")}
                    value={visitType}
                  />
                </div>
                <p className="rounded-lg bg-muted px-3 py-2 text-muted-foreground text-xs">
                  {t("scribe.consent")}
                </p>
              </div>
            </Tabs>
          )}

          {error && (
            <p className="mt-3 text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
        </DialogPanel>

        <DialogFooter>
          {phase === "review" ? (
            <>
              <Button
                disabled={busy}
                onClick={() => setPhase("input")}
                type="button"
                variant="outline"
              >
                {t("scribe.review.back")}
              </Button>
              <Button disabled={busy} onClick={save} type="button">
                {busy && <Spinner className="size-4" />}
                {t("scribe.review.save")}
              </Button>
            </>
          ) : (
            <>
              <Button
                disabled={busy}
                onClick={() => handleOpenChange(false)}
                type="button"
                variant="outline"
              >
                {t("scribe.cancel")}
              </Button>
              <Button
                disabled={
                  busy ||
                  (tab === "record"
                    ? recState !== "recorded"
                    : transcript.trim().length === 0)
                }
                onClick={generate}
                type="button"
              >
                {busy && <Spinner className="size-4" />}
                {busy ? t("scribe.processing") : t("scribe.generate")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
