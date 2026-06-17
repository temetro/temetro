"use client";

// An Obsidian-style knowledge graph of one patient's record: the patient sits
// at the centre, their problems (illnesses) and encounters (visits) orbit it,
// and a visit links to a problem when the visit references it. Layout is a
// d3-force simulation computed once; rendering + pan/zoom/drag is React Flow.

import {
  Background,
  Controls,
  type Edge,
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
import { useMemo } from "react";
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

type RecordNodeData = { label: string; sub?: string; kind: Kind };

const kindClass: Record<Kind, string> = {
  patient: "bg-primary text-primary-foreground border-primary px-4 py-3 text-sm",
  problem: "bg-destructive/12 text-foreground border-destructive/50",
  visit: "bg-muted text-foreground border-border",
};

// A pill node with hidden connection handles so edges meet it cleanly.
function RecordNode({ data }: NodeProps) {
  const { label, sub, kind } = data as RecordNodeData;
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2 text-center text-xs shadow-sm",
        kindClass[kind],
        kind === "patient" && "font-semibold",
      )}
    >
      <Handle className="!opacity-0" position={Position.Top} type="target" />
      <div className="max-w-36 truncate font-medium">{label}</div>
      {sub ? <div className="max-w-36 truncate opacity-70">{sub}</div> : null}
      <Handle className="!opacity-0" position={Position.Bottom} type="source" />
    </div>
  );
}

const nodeTypes = { record: RecordNode };

// Build nodes + edges from the record. A visit links to a problem when its
// type/summary mentions the problem label (case-insensitive) — that produces
// the clustered "hub" look.
function buildGraph(patient: Patient): {
  nodes: SimNode[];
  edges: { source: string; target: string }[];
} {
  const nodes: SimNode[] = [
    { id: "patient", kind: "patient", label: patient.name },
  ];
  const edges: { source: string; target: string }[] = [];

  patient.problems.forEach((p, i) => {
    const id = `prob-${i}`;
    nodes.push({ id, kind: "problem", label: p.label, sub: p.since });
    edges.push({ source: "patient", target: id });
  });

  patient.encounters.forEach((e, i) => {
    const id = `enc-${i}`;
    nodes.push({ id, kind: "visit", label: e.type, sub: e.date });
    edges.push({ source: "patient", target: id });
    const hay = `${e.type} ${e.summary}`.toLowerCase();
    patient.problems.forEach((p, pi) => {
      if (p.label && hay.includes(p.label.toLowerCase())) {
        edges.push({ source: id, target: `prob-${pi}` });
      }
    });
  });

  return { nodes, edges };
}

// Run the force simulation to completion so positions are stable on first paint.
function layout(nodes: SimNode[], edges: { source: string; target: string }[]) {
  const links: SimLink[] = edges.map((e) => ({ ...e }));
  forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-340))
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance(96)
        .strength(0.45),
    )
    .force("center", forceCenter(240, 170))
    .force("collide", forceCollide(50))
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

  const { nodes, edges } = useMemo(() => {
    const g = buildGraph(patient);
    layout(g.nodes, g.edges);
    const rfNodes: Node[] = g.nodes.map((n) => ({
      id: n.id,
      type: "record",
      position: { x: n.x ?? 0, y: n.y ?? 0 },
      data: { label: n.label, sub: n.sub, kind: n.kind },
    }));
    const rfEdges: Edge[] = g.edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      style: { stroke: "var(--border)", strokeWidth: 1.5 },
    }));
    return { nodes: rfNodes, edges: rfEdges };
  }, [patient]);

  if (patient.problems.length === 0 && patient.encounters.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("patientCard.graph.empty")}</p>
    );
  }

  return (
    <div
      className={cn(
        "h-80 w-full overflow-hidden rounded-2xl border bg-card/30",
        className,
      )}
    >
      <ReactFlow
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodeTypes={nodeTypes}
        nodes={nodes}
        nodesConnectable={false}
        panOnScroll
        proOptions={{ hideAttribution: true }}
        zoomOnScroll={false}
      >
        <Background color="var(--border)" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
