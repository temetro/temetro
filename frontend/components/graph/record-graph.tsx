"use client";

// An Obsidian-style knowledge graph of one patient's record: the patient sits
// at the centre, their problems (illnesses) and encounters (visits) orbit it,
// and a visit links to a problem when the visit references it. Layout is a
// d3-force simulation computed once; rendering + pan/zoom is React Flow. Nodes
// are round "dots" with the label underneath, and hovering a node highlights it
// and its neighbours while dimming the rest (the Obsidian focus effect).
//
// Hover is driven through React context — NOT through the `nodes`/`edges` props
// — so the arrays React Flow receives stay referentially stable. That avoids the
// re-measure/flicker loop you get when hover state recreates the node objects
// (and the hovered node's transform shifts it out from under the cursor).

import {
  Background,
  BaseEdge,
  Controls,
  type Edge,
  type EdgeProps,
  getStraightPath,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useTheme } from "next-themes";
import { createContext, memo, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Patient } from "@/lib/patients";
import { cn } from "@/lib/utils";

type Kind = "patient" | "problem" | "visit";

type SimNode = SimulationNodeDatum & {
  id: string;
  kind: Kind;
  label: string;
  sub?: string;
};
type SimLink = SimulationLinkDatum<SimNode>;

type RecordNodeData = {
  label: string;
  sub?: string;
  kind: Kind;
  // Ids of this node plus its direct neighbours — used to derive hover focus
  // from the hovered id without recreating the node objects.
  family: string[];
};

// The id of the node currently hovered (or null). Read by nodes + edges so the
// hover highlight never touches the React Flow `nodes`/`edges` props.
const HoverContext = createContext<string | null>(null);

// Dot size + colour per kind. The patient is the biggest, brightest hub.
const dotClass: Record<Kind, string> = {
  patient: "size-5 bg-primary shadow-[0_0_16px_2px] shadow-primary/40",
  problem: "size-3.5 bg-destructive shadow-[0_0_12px_1px] shadow-destructive/30",
  visit: "size-3 bg-foreground/55",
};

// A round node with the label below it and hidden connection handles so edges
// meet the dot's centre cleanly. Memoized; it re-renders only when the hovered
// id changes (via context), never via React Flow re-measuring.
const RecordNode = memo(function RecordNode({ id, data }: NodeProps) {
  const { label, sub, kind, family } = data as RecordNodeData;
  const hovered = useContext(HoverContext);
  const focus: "active" | "dim" | null =
    hovered == null ? null : family.includes(hovered) ? "active" : "dim";

  return (
    <div
      className={cn(
        "relative flex flex-col items-center transition-opacity duration-200",
        focus === "dim" ? "opacity-25" : "opacity-100",
      )}
    >
      <div
        className={cn(
          "rounded-full ring-1 ring-background/60 transition-shadow duration-200",
          dotClass[kind],
          focus === "active" && "ring-2 ring-foreground/40",
        )}
      >
        <Handle className="!opacity-0" position={Position.Top} type="target" />
        <Handle
          className="!opacity-0"
          position={Position.Bottom}
          type="source"
        />
      </div>
      <div className="absolute top-full mt-1.5 flex max-w-28 flex-col items-center text-center">
        <span
          className={cn(
            "max-w-28 truncate text-[11px] leading-tight",
            kind === "patient"
              ? "font-semibold text-foreground"
              : "font-medium text-foreground/90",
          )}
        >
          {label}
        </span>
        {sub ? (
          <span className="max-w-28 truncate text-[10px] text-muted-foreground">
            {sub}
          </span>
        ) : null}
      </div>
    </div>
  );
});

// A straight edge that brightens when it touches the hovered node and dims when
// it doesn't. Reads the hovered id from context so the `edges` prop stays stable.
const RecordEdge = memo(function RecordEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  source,
  target,
}: EdgeProps) {
  const hovered = useContext(HoverContext);
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const touches = !hovered || source === hovered || target === hovered;
  return (
    <BaseEdge
      path={path}
      style={{
        stroke: hovered && touches ? "var(--primary)" : "var(--border)",
        strokeWidth: hovered && touches ? 1.75 : 1.25,
        opacity: hovered && !touches ? 0.12 : 0.7,
        transition: "stroke 0.2s, opacity 0.2s",
      }}
    />
  );
});

const nodeTypes = { record: RecordNode };
const edgeTypes = { record: RecordEdge };

// Build nodes + edges from the record. A visit links to a problem when its
// type/summary mentions the problem label (case-insensitive) — that produces
// the clustered "hub" look.
function buildGraph(patient: Patient): {
  nodes: SimNode[];
  edges: { id: string; source: string; target: string }[];
} {
  const nodes: SimNode[] = [
    { id: "patient", kind: "patient", label: patient.name },
  ];
  const edges: { id: string; source: string; target: string }[] = [];
  let edgeSeq = 0;
  const link = (source: string, target: string) =>
    edges.push({ id: `e-${edgeSeq++}`, source, target });

  patient.problems.forEach((p, i) => {
    const id = `prob-${i}`;
    nodes.push({ id, kind: "problem", label: p.label, sub: p.since });
    link("patient", id);
  });

  patient.encounters.forEach((e, i) => {
    const id = `enc-${i}`;
    nodes.push({ id, kind: "visit", label: e.type, sub: e.date });
    link("patient", id);
    const hay = `${e.type} ${e.summary}`.toLowerCase();
    patient.problems.forEach((p, pi) => {
      if (p.label && hay.includes(p.label.toLowerCase())) {
        link(id, `prob-${pi}`);
      }
    });
  });

  return { nodes, edges };
}

// Run the force simulation to completion so positions are stable on first paint.
function layout(
  nodes: SimNode[],
  edges: { source: string; target: string }[],
) {
  const links: SimLink[] = edges.map((e) => ({ ...e }));
  forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-340))
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance(110)
        .strength(0.5),
    )
    .force("center", forceCenter(240, 170))
    .force("collide", forceCollide(56))
    .stop()
    .tick(320);
}

export function RecordGraph({
  patient,
  className,
}: {
  patient: Patient;
  className?: string;
}) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  // The hovered node id — drives the focus highlight via context only.
  const [hovered, setHovered] = useState<string | null>(null);

  // Nodes + edges are computed once per patient and stay referentially stable
  // across hover, so React Flow never re-measures (the source of the flicker).
  const { nodes, edges } = useMemo(() => {
    const g = buildGraph(patient);
    layout(g.nodes, g.edges);
    // For each node, the set of ids that should stay lit when it is hovered:
    // itself plus its direct neighbours.
    const family = new Map<string, Set<string>>();
    for (const n of g.nodes) family.set(n.id, new Set([n.id]));
    for (const e of g.edges) {
      family.get(e.source)?.add(e.target);
      family.get(e.target)?.add(e.source);
    }
    const rfNodes: Node[] = g.nodes.map((n) => ({
      id: n.id,
      type: "record",
      position: { x: n.x ?? 0, y: n.y ?? 0 },
      data: {
        label: n.label,
        sub: n.sub,
        kind: n.kind,
        family: Array.from(family.get(n.id) ?? [n.id]),
      } satisfies RecordNodeData,
    }));
    const rfEdges: Edge[] = g.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "record",
    }));
    return { nodes: rfNodes, edges: rfEdges };
  }, [patient]);

  if (patient.problems.length === 0 && patient.encounters.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("patientCard.graph.empty")}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "h-80 w-full overflow-hidden rounded-2xl border bg-card/40",
        className,
      )}
    >
      <HoverContext.Provider value={hovered}>
        <ReactFlow
          colorMode={resolvedTheme === "light" ? "light" : "dark"}
          edgeTypes={edgeTypes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodeTypes={nodeTypes}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          onNodeMouseEnter={(_, node) => setHovered(node.id)}
          onNodeMouseLeave={() => setHovered(null)}
          panOnScroll
          proOptions={{ hideAttribution: true }}
          zoomOnScroll={false}
        >
          <Background color="var(--border)" gap={22} size={1.5} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </HoverContext.Provider>
    </div>
  );
}
