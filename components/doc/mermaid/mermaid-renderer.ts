/**
 * Dynamic Mermaid loader with built-in pure SVG fallback engine.
 * Ensures diagrams render reliably in both online and offline/air-gapped environments.
 */

// Global cache for CDN loaded mermaid instance
let mermaidPromise: Promise<any> | null = null;

async function getMermaidInstance() {
  if (typeof window === "undefined") return null;
  if ((window as any).mermaid) return (window as any).mermaid;

  if (!mermaidPromise) {
    mermaidPromise = (async () => {
      try {
        // Attempt dynamic import from CDN
        const cdnUrl = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
        const module = await import(/* @vite-ignore */ cdnUrl);
        const mermaid = module.default || module;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        });
        (window as any).mermaid = mermaid;
        return mermaid;
      } catch (err) {
        console.warn("Could not load external mermaid CDN, using native SVG renderer engine:", err);
        return null;
      }
    })();
  }
  return mermaidPromise;
}

interface ParsedNode {
  id: string;
  label: string;
  shape: "rect" | "round" | "diamond" | "cylinder" | "stadium" | "subroutine";
}

interface ParsedEdge {
  from: string;
  to: string;
  label?: string;
  style: "solid" | "dotted" | "thick";
}

interface ParsedSequenceMessage {
  from: string;
  to: string;
  text: string;
}

/**
 * Built-in pure SVG diagram engine for Flowcharts, Sequences, and State diagrams.
 */
function generateSvgFromMermaid(containerId: string, rawCode: string): string {
  const lines = rawCode
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%"));

  if (lines.length === 0) {
    return `<svg width="200" height="60" xmlns="http://www.w3.org/2000/svg"><text x="20" y="35" fill="#888" font-size="12">Empty diagram</text></svg>`;
  }

  const firstLine = lines[0].toLowerCase();

  // 1. Sequence Diagram
  if (firstLine.startsWith("sequencediagram")) {
    return renderSequenceDiagram(containerId, lines.slice(1));
  }

  // 2. Flowchart / Graph (default)
  return renderFlowchart(containerId, lines);
}

function renderSequenceDiagram(id: string, lines: string[]): string {
  const participantsSet = new Set<string>();
  const messages: ParsedSequenceMessage[] = [];

  for (const line of lines) {
    if (line.toLowerCase().startsWith("participant")) {
      const parts = line.split(/\s+/);
      if (parts[1]) participantsSet.add(parts[1]);
    } else {
      // e.g. Alice->>Bob: Hello or Alice->Bob: Hello
      const match = line.match(/^([A-Za-z0-9_]+)\s*-(?:-)?>>?\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/);
      if (match) {
        participantsSet.add(match[1]);
        participantsSet.add(match[2]);
        messages.push({
          from: match[1],
          to: match[2],
          text: match[3].trim(),
        });
      }
    }
  }

  const participants = Array.from(participantsSet);
  if (participants.length === 0) {
    return `<svg width="250" height="80" xmlns="http://www.w3.org/2000/svg"><text x="20" y="40" fill="#888" font-size="12">Sequence diagram (add participants)</text></svg>`;
  }

  const colWidth = 160;
  const headerHeight = 45;
  const msgSpacing = 48;
  const width = Math.max(participants.length * colWidth + 60, 400);
  const height = headerHeight * 2 + messages.length * msgSpacing + 60;

  const partPositions = new Map<string, number>();
  participants.forEach((p, idx) => {
    partPositions.set(p, 60 + idx * colWidth + colWidth / 2);
  });

  let svg = `<svg id="${id}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:transparent;font-family:Inter,sans-serif;">
  <defs>
    <marker id="seq-arrow-${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#7b68ee" />
    </marker>
  </defs>`;

  // Lifelines and header boxes
  participants.forEach((p) => {
    const x = partPositions.get(p)!;
    // Lifeline vertical dashed
    svg += `<line x1="${x}" y1="${headerHeight + 10}" x2="${x}" y2="${height - headerHeight - 10}" stroke="#3f3f46" stroke-width="1.5" stroke-dasharray="4 4" />`;
    // Top box
    svg += `<rect x="${x - 55}" y="12" width="110" height="34" rx="6" fill="#1e1e24" stroke="#7b68ee" stroke-width="1.5" />`;
    svg += `<text x="${x}" y="33" fill="#e4e4e7" font-size="12" font-weight="600" text-anchor="middle">${p}</text>`;
    // Bottom box
    svg += `<rect x="${x - 55}" y="${height - headerHeight}" width="110" height="34" rx="6" fill="#1e1e24" stroke="#3f3f46" stroke-width="1.5" />`;
    svg += `<text x="${x}" y="${height - headerHeight + 21}" fill="#e4e4e7" font-size="12" font-weight="600" text-anchor="middle">${p}</text>`;
  });

  // Message arrows
  messages.forEach((m, idx) => {
    const y = headerHeight + 40 + idx * msgSpacing;
    const x1 = partPositions.get(m.from) ?? 60;
    const x2 = partPositions.get(m.to) ?? 200;
    const isForward = x2 >= x1;
    const targetX = isForward ? x2 - 5 : x2 + 5;

    svg += `<line x1="${x1}" y1="${y}" x2="${targetX}" y2="${y}" stroke="#7b68ee" stroke-width="1.8" marker-end="url(#seq-arrow-${id})" />`;
    const labelX = (x1 + x2) / 2;
    svg += `<rect x="${labelX - 45}" y="${y - 18}" width="90" height="15" rx="3" fill="#121216" opacity="0.85" />`;
    svg += `<text x="${labelX}" y="${y - 7}" fill="#d4d4d8" font-size="11" font-weight="500" text-anchor="middle">${m.text}</text>`;
  });

  svg += `</svg>`;
  return svg;
}

function renderFlowchart(id: string, lines: string[]): string {
  const nodesMap = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];
  let isLR = false;

  const header = lines[0].toLowerCase();
  if (header.includes(" lr") || header.includes("right")) {
    isLR = true;
  }

  // Helper to parse node shape & label
  function parseNodeToken(token: string): string {
    const t = token.trim();
    // Cylinder: id[(Label)]
    const cylMatch = t.match(/^([A-Za-z0-9_]+)\[\((.*?)\)\]$/);
    if (cylMatch) {
      nodesMap.set(cylMatch[1], { id: cylMatch[1], label: cylMatch[2], shape: "cylinder" });
      return cylMatch[1];
    }
    // Stadium / Terminal: id([Label])
    const stadMatch = t.match(/^([A-Za-z0-9_]+)\(\[(.*?)\]\)$/);
    if (stadMatch) {
      nodesMap.set(stadMatch[1], { id: stadMatch[1], label: stadMatch[2], shape: "stadium" });
      return stadMatch[1];
    }
    // Subroutine: id[[Label]]
    const subMatch = t.match(/^([A-Za-z0-9_]+)\[\[(.*?)\]\]$/);
    if (subMatch) {
      nodesMap.set(subMatch[1], { id: subMatch[1], label: subMatch[2], shape: "subroutine" });
      return subMatch[1];
    }
    // Diamond: id{Label}
    const diaMatch = t.match(/^([A-Za-z0-9_]+)\{(.*?)\}$/);
    if (diaMatch) {
      nodesMap.set(diaMatch[1], { id: diaMatch[1], label: diaMatch[2], shape: "diamond" });
      return diaMatch[1];
    }
    // Round: id(Label)
    const rndMatch = t.match(/^([A-Za-z0-9_]+)\((.*?)\)$/);
    if (rndMatch) {
      nodesMap.set(rndMatch[1], { id: rndMatch[1], label: rndMatch[2], shape: "round" });
      return rndMatch[1];
    }
    // Rect: id[Label]
    const rctMatch = t.match(/^([A-Za-z0-9_]+)\[(.*?)\]$/);
    if (rctMatch) {
      nodesMap.set(rctMatch[1], { id: rctMatch[1], label: rctMatch[2], shape: "rect" });
      return rctMatch[1];
    }
    // Plain ID: A
    const idMatch = t.match(/^([A-Za-z0-9_]+)$/);
    if (idMatch) {
      if (!nodesMap.has(idMatch[1])) {
        nodesMap.set(idMatch[1], { id: idMatch[1], label: idMatch[1], shape: "rect" });
      }
      return idMatch[1];
    }
    return t;
  }

  // Parse edges and standalone nodes
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/^subgraph.*$/i, "").replace(/^end$/i, "").trim();
    if (!line) continue;

    // Edge patterns:
    // A --> B
    // A --> B --> C
    // A -- Yes --> B
    // A -->|Yes| B
    // A ==> B
    // A -.-> B
    const arrowDelim = /(-->|--\s*.*?\s*-->|-->\|.*?\||==>|-\.->)/g;
    const parts = line.split(arrowDelim);

    if (parts.length >= 3) {
      for (let j = 0; j < parts.length - 2; j += 2) {
        const fromToken = parts[j].trim();
        const op = parts[j + 1].trim();
        const toToken = parts[j + 2].trim();

        const fromId = parseNodeToken(fromToken);
        const toId = parseNodeToken(toToken);

        let edgeLabel: string | undefined;
        let style: "solid" | "dotted" | "thick" = "solid";

        if (op.startsWith("--|") || op.includes("|")) {
          const lbl = op.replace(/^[^-]*\|/, "").replace(/\|$/, "");
          edgeLabel = lbl.trim();
        } else if (op.startsWith("--") && op.endsWith("-->") && op.length > 5) {
          edgeLabel = op.slice(2, -3).trim();
        } else if (op.includes("==")) {
          style = "thick";
        } else if (op.includes("-.-")) {
          style = "dotted";
        }

        if (fromId && toId) {
          edges.push({ from: fromId, to: toId, label: edgeLabel, style });
        }
      }
    } else {
      parseNodeToken(line);
    }
  }

  const nodes = Array.from(nodesMap.values());
  if (nodes.length === 0) {
    return `<svg width="250" height="80" xmlns="http://www.w3.org/2000/svg"><text x="20" y="40" fill="#888" font-size="12">Flowchart (empty)</text></svg>`;
  }

  // Compute layered layout (rank based)
  const ranks = new Map<string, number>();
  nodes.forEach((n) => ranks.set(n.id, 0));

  // Determine ranks via iterative DAG progression
  for (let iter = 0; iter < 8; iter++) {
    for (const e of edges) {
      const fromRank = ranks.get(e.from) ?? 0;
      const toRank = ranks.get(e.to) ?? 0;
      if (toRank <= fromRank) {
        ranks.set(e.to, fromRank + 1);
      }
    }
  }

  // Group nodes by rank
  const rankGroups = new Map<number, ParsedNode[]>();
  nodes.forEach((n) => {
    const r = ranks.get(n.id) ?? 0;
    const arr = rankGroups.get(r) ?? [];
    arr.push(n);
    rankGroups.set(r, arr);
  });

  const maxRank = Math.max(...Array.from(rankGroups.keys()), 0);
  const nodeWidth = 140;
  const nodeHeight = 44;
  const nodePositions = new Map<string, { x: number; y: number }>();

  let totalWidth = 0;
  let totalHeight = 0;

  if (isLR) {
    const colSpacing = 190;
    const rowSpacing = 72;
    totalWidth = (maxRank + 1) * colSpacing + 80;

    let maxNodesInRank = 1;
    rankGroups.forEach((group) => {
      if (group.length > maxNodesInRank) maxNodesInRank = group.length;
    });
    totalHeight = maxNodesInRank * rowSpacing + 80;

    rankGroups.forEach((group, rank) => {
      const colX = 50 + rank * colSpacing;
      const groupHeight = group.length * rowSpacing;
      const startY = (totalHeight - groupHeight) / 2 + rowSpacing / 2;

      group.forEach((node, idx) => {
        nodePositions.set(node.id, {
          x: colX,
          y: startY + idx * rowSpacing,
        });
      });
    });
  } else {
    // Top-Down
    const rowSpacing = 100;
    const colSpacing = 170;
    totalHeight = (maxRank + 1) * rowSpacing + 70;

    let maxNodesInRank = 1;
    rankGroups.forEach((group) => {
      if (group.length > maxNodesInRank) maxNodesInRank = group.length;
    });
    totalWidth = Math.max(maxNodesInRank * colSpacing + 60, 360);

    rankGroups.forEach((group, rank) => {
      const rowY = 40 + rank * rowSpacing;
      const groupWidth = group.length * colSpacing;
      const startX = (totalWidth - groupWidth) / 2 + colSpacing / 2;

      group.forEach((node, idx) => {
        nodePositions.set(node.id, {
          x: startX + idx * colSpacing - nodeWidth / 2,
          y: rowY,
        });
      });
    });
  }

  let svg = `<svg id="${id}" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg" style="background:transparent;font-family:Inter,sans-serif;">
  <defs>
    <filter id="shadow-${id}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.25" flood-color="#000000" />
    </filter>
    <linearGradient id="grad-node-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22222a" />
      <stop offset="100%" stop-color="#18181f" />
    </linearGradient>
    <marker id="arrow-${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#8b5cf6" />
    </marker>
  </defs>`;

  // Draw Edges
  edges.forEach((e) => {
    const fromPos = nodePositions.get(e.from);
    const toPos = nodePositions.get(e.to);
    if (!fromPos || !toPos) return;

    let x1 = fromPos.x + nodeWidth / 2;
    let y1 = fromPos.y + nodeHeight;
    let x2 = toPos.x + nodeWidth / 2;
    let y2 = toPos.y;

    if (isLR) {
      x1 = fromPos.x + nodeWidth;
      y1 = fromPos.y + nodeHeight / 2;
      x2 = toPos.x;
      y2 = toPos.y + nodeHeight / 2;
    }

    const strokeDash = e.style === "dotted" ? 'stroke-dasharray="4 3"' : "";
    const strokeWidth = e.style === "thick" ? "2.5" : "1.8";

    // Smooth Bezier Curve connecting nodes
    let pathD = "";
    if (isLR) {
      const dx = (x2 - x1) / 2;
      pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2 - 5} ${y2}`;
    } else {
      const dy = (y2 - y1) / 2;
      pathD = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2 - 5}`;
    }

    svg += `<path d="${pathD}" fill="none" stroke="#8b5cf6" stroke-width="${strokeWidth}" ${strokeDash} marker-end="url(#arrow-${id})" />`;

    // Edge Label
    if (e.label) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const lblW = Math.max(e.label.length * 7 + 12, 32);
      svg += `<rect x="${midX - lblW / 2}" y="${midY - 9}" width="${lblW}" height="17" rx="3" fill="#141418" stroke="#3f3f46" stroke-width="0.8" />`;
      svg += `<text x="${midX}" y="${midY + 3}" fill="#a1a1aa" font-size="10" font-weight="500" text-anchor="middle">${e.label}</text>`;
    }
  });

  // Draw Nodes
  nodes.forEach((n) => {
    const pos = nodePositions.get(n.id);
    if (!pos) return;

    const { x, y } = pos;
    const label = n.label || n.id;
    const truncated = label.length > 20 ? label.slice(0, 18) + "..." : label;

    if (n.shape === "diamond") {
      // Diamond Decision
      const pts = `${x + nodeWidth / 2},${y - 4} ${x + nodeWidth + 10},${y + nodeHeight / 2} ${x + nodeWidth / 2},${y + nodeHeight + 4} ${x - 10},${y + nodeHeight / 2}`;
      svg += `<polygon points="${pts}" fill="url(#grad-node-${id})" stroke="#a855f7" stroke-width="1.8" filter="url(#shadow-${id})" />`;
      svg += `<text x="${x + nodeWidth / 2}" y="${y + nodeHeight / 2 + 4}" fill="#f4f4f5" font-size="11" font-weight="600" text-anchor="middle">${truncated}</text>`;
    } else if (n.shape === "cylinder") {
      // Database Cylinder
      svg += `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="4" fill="url(#grad-node-${id})" stroke="#3b82f6" stroke-width="1.6" filter="url(#shadow-${id})" />`;
      svg += `<ellipse cx="${x + nodeWidth / 2}" cy="${y + 7}" rx="${nodeWidth / 2 - 2}" ry="6" fill="#2d3748" stroke="#3b82f6" stroke-width="1.2" />`;
      svg += `<text x="${x + nodeWidth / 2}" y="${y + nodeHeight / 2 + 7}" fill="#f4f4f5" font-size="11" font-weight="600" text-anchor="middle">🗄️ ${truncated}</text>`;
    } else if (n.shape === "stadium" || n.shape === "round") {
      // Stadium / Round
      svg += `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="${n.shape === "stadium" ? 22 : 12}" fill="url(#grad-node-${id})" stroke="#10b981" stroke-width="1.6" filter="url(#shadow-${id})" />`;
      svg += `<text x="${x + nodeWidth / 2}" y="${y + nodeHeight / 2 + 4}" fill="#f4f4f5" font-size="11" font-weight="600" text-anchor="middle">${truncated}</text>`;
    } else {
      // Rect Standard Process
      svg += `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="7" fill="url(#grad-node-${id})" stroke="#8b5cf6" stroke-width="1.5" filter="url(#shadow-${id})" />`;
      svg += `<text x="${x + nodeWidth / 2}" y="${y + nodeHeight / 2 + 4}" fill="#f4f4f5" font-size="11" font-weight="600" text-anchor="middle">${truncated}</text>`;
    }
  });

  svg += `</svg>`;
  return svg;
}

export async function renderMermaidDiagram(containerId: string, code: string): Promise<string> {
  const mermaid = await getMermaidInstance();
  if (mermaid) {
    try {
      const sanitizedId = `mermaid_${containerId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      const res = await mermaid.render(sanitizedId, code);
      if (res && res.svg) {
        return res.svg;
      }
    } catch (e) {
      // Fallback seamlessly to native engine if syntax is non-standard or external failed
      console.warn("External mermaid render failed, using fallback engine", e);
    }
  }

  // Built-in resilient SVG renderer
  return generateSvgFromMermaid(containerId, code);
}
