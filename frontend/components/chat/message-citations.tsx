"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Components } from "streamdown";

import { MessageResponse } from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import type { SourceData } from "@/lib/ai-chat";

// The agent cites a retrieved record inline with a [[src:<id>]] marker. We turn
// each marker into a hash link ([n](#cite-<id>)) — hash links survive
// react-markdown's URL sanitization — then override the link renderer to show a
// numbered inline citation chip whose hover card names the source.
const CITATION_RE = /\[\[\s*src:\s*([a-zA-Z0-9_-]+)\s*\]\]/g;
const CITE_HREF_PREFIX = "#cite-";

export function hasCitationMarkers(text: string): boolean {
  CITATION_RE.lastIndex = 0;
  return CITATION_RE.test(text);
}

// Rewrites [[src:id]] → [n](#cite-id) for known sources; strips unknown markers.
function withCitationLinks(
  text: string,
  numberById: Map<string, number>,
): string {
  return text.replace(CITATION_RE, (_match, id: string) => {
    const num = numberById.get(id);
    return num ? `[${num}](${CITE_HREF_PREFIX}${id})` : "";
  });
}

function CitationChip({ num, source }: { num: number; source?: SourceData }) {
  const { t } = useTranslation();
  if (!source) return null;
  const kindKey = `chat.sources.kind.${source.kind}`;
  const kindLabel = t(kindKey);
  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={
          <Badge
            className="mx-0.5 cursor-default rounded-full px-1.5 align-super text-[10px] leading-none no-underline"
            variant="secondary"
          />
        }
      >
        {num}
      </PreviewCardTrigger>
      <PreviewCardPopup className="w-64 p-3">
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {kindLabel === kindKey ? t("chat.sources.title") : kindLabel}
        </p>
        <p className="mt-0.5 text-foreground text-sm">{source.title}</p>
      </PreviewCardPopup>
    </PreviewCard>
  );
}

// Renders assistant markdown with inline citation chips resolved from the
// message's streamed sources.
export function CitedResponse({
  text,
  sources,
}: {
  text: string;
  sources: SourceData[];
}) {
  const { numberById, sourceById, processed } = useMemo(() => {
    const numberById = new Map<string, number>();
    const sourceById = new Map<string, SourceData>();
    sources.forEach((s, i) => {
      numberById.set(s.id, i + 1);
      sourceById.set(s.id, s);
    });
    return {
      numberById,
      sourceById,
      processed: withCitationLinks(text, numberById),
    };
  }, [text, sources]);

  const components = useMemo<Components>(
    () => ({
      a({ href, children, ...props }) {
        if (typeof href === "string" && href.startsWith(CITE_HREF_PREFIX)) {
          const id = href.slice(CITE_HREF_PREFIX.length);
          const num = numberById.get(id) ?? 0;
          return <CitationChip num={num} source={sourceById.get(id)} />;
        }
        return (
          <a href={href} rel="noreferrer" target="_blank" {...props}>
            {children}
          </a>
        );
      },
    }),
    [numberById, sourceById],
  );

  return <MessageResponse components={components}>{processed}</MessageResponse>;
}

// Provenance footer shown beneath a message that has sources — primarily a
// fallback when the model didn't place inline markers, so retrieved records are
// always attributed.
export function SourcesFooter({ sources }: { sources: SourceData[] }) {
  const { t } = useTranslation();
  if (sources.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 border-border/60 border-t pt-2">
      <span className="text-muted-foreground text-xs">
        {t("chat.sources.title")}
      </span>
      {sources.map((s, i) => (
        <Badge className="gap-1 rounded-full font-normal" key={s.id} variant="outline">
          <span className="text-muted-foreground">{i + 1}</span>
          <span className="max-w-48 truncate">{s.title}</span>
        </Badge>
      ))}
    </div>
  );
}
