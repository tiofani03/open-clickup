"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  Workflow,
  Code,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Trash2,
  GripVertical,
  Plus,
  ArrowRight,
  Database,
  Diamond,
  Square,
  Circle,
  PlayCircle,
  X,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { renderMermaidDiagram, generateSvgFromMermaid } from "./mermaid-renderer";
import { cn } from "../../../lib/utils";

const DIAGRAM_TEMPLATES = [
  {
    name: "Flowchart (Decision)",
    code: `flowchart TD
    A([Start]) --> B[User Request]
    B --> C{Authenticated?}
    C -- Yes --> D[(Database Query)]
    C -- No --> E[Login Form]
    D --> F([Render View])
    E --> F`,
  },
  {
    name: "System Architecture",
    code: `flowchart LR
    Client[Web Client] --> Gateway[API Gateway]
    Gateway --> Auth[Auth Service]
    Gateway --> TaskSvc[Task Service]
    TaskSvc --> DB[(PostgreSQL)]
    TaskSvc --> Cache[(Redis Cache)]`,
  },
  {
    name: "Sequence Diagram",
    code: `sequenceDiagram
    participant User
    participant Frontend
    participant Server
    participant DB
    User->>Frontend: Click Publish
    Frontend->>Server: POST /publish
    Server->>DB: Save draft to live
    DB-->>Server: OK
    Server-->>Frontend: 200 Success`,
  },
  {
    name: "State Lifecycle",
    code: `flowchart TD
    Draft([Draft]) --> InReview[In Review]
    InReview --> Approved{Approved?}
    Approved -- Yes --> Published([Published])
    Approved -- No --> Draft`,
  },
];

interface PaletteShape {
  type: "rect" | "diamond" | "cylinder" | "stadium" | "round";
  label: string;
  templateSyntax: (id: string, name: string) => string;
  icon: React.ReactNode;
}

const PALETTE_SHAPES: PaletteShape[] = [
  {
    type: "rect",
    label: "Process Step",
    templateSyntax: (id, name) => `${id}[${name}]`,
    icon: <Square className="h-3.5 w-3.5 text-cu-purple" />,
  },
  {
    type: "diamond",
    label: "Decision",
    templateSyntax: (id, name) => `${id}{${name}?}`,
    icon: <Diamond className="h-3.5 w-3.5 text-amber-500" />,
  },
  {
    type: "cylinder",
    label: "Database",
    templateSyntax: (id, name) => `${id}[(${name})]`,
    icon: <Database className="h-3.5 w-3.5 text-blue-500" />,
  },
  {
    type: "stadium",
    label: "Terminal / Start-End",
    templateSyntax: (id, name) => `${id}([${name}])`,
    icon: <PlayCircle className="h-3.5 w-3.5 text-emerald-500" />,
  },
  {
    type: "round",
    label: "Rounded Node",
    templateSyntax: (id, name) => `${id}(${name})`,
    icon: <Circle className="h-3.5 w-3.5 text-pink-500" />,
  },
];

export function MermaidBlock(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected, editor } = props;
  const isEditable = editor.isEditable;
  const rawCode = (node.attrs.code as string) || DIAGRAM_TEMPLATES[0].code;

  const [activeTab, setActiveTab] = useState<"visual" | "code" | "preview">("preview");
  const [codeValue, setCodeValue] = useState(rawCode);

  const containerId = useId().replace(/[:]/g, "_");
  const safeContainerId = "m_" + containerId.replace(/[^a-zA-Z0-9]/g, "");

  const [svgHtml, setSvgHtml] = useState<string>(() =>
    generateSvgFromMermaid(safeContainerId, rawCode),
  );
  const [error, setError] = useState<string | null>(null);

  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Drag over dropzone indicator
  const [isDragOverDropzone, setIsDragOverDropzone] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Sync external code
  useEffect(() => {
    setCodeValue(rawCode);
  }, [rawCode]);

  // Render diagram whenever codeValue changes
  useEffect(() => {
    let isCancelled = false;
    const immediate = generateSvgFromMermaid(safeContainerId, codeValue);
    setSvgHtml(immediate);
    setError(null);

    renderMermaidDiagram(safeContainerId, codeValue)
      .then((svg) => {
        if (!isCancelled && svg && svg !== immediate) {
          setSvgHtml(svg);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn("External mermaid render failed, using fallback:", err);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [codeValue, safeContainerId]);

  const handleCodeChange = (newCode: string) => {
    setCodeValue(newCode);
    updateAttributes({ code: newCode });
  };

  // Zoom handlers
  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 2.5));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.4));
  const handleResetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  // Copy code to clipboard
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(codeValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Visual Drag & Drop: Drop a shape onto the canvas to add to diagram
  const handleDropShape = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDropzone(false);
    const shapeType = e.dataTransfer.getData("shape-type") as PaletteShape["type"];
    const shapeLabel = e.dataTransfer.getData("shape-label") || "New Step";
    if (!shapeType) return;

    // Generate random node id (e.g. Node4)
    const existingIds = Array.from(codeValue.matchAll(/([A-Za-z0-9_]+)[\[\(\{]/g)).map((m) => m[1]);
    const nextNum = existingIds.length + 1;
    const newId = `Node${nextNum}`;

    const shapeObj = PALETTE_SHAPES.find((s) => s.type === shapeType) || PALETTE_SHAPES[0];
    const nodeSyntax = shapeObj.templateSyntax(newId, shapeLabel);

    // Append to flowchart code
    let nextCode = codeValue.trim();
    if (!nextCode.includes("flowchart") && !nextCode.includes("graph")) {
      nextCode = `flowchart TD\n    ${nodeSyntax}`;
    } else {
      // Connect to the last identified node if available
      const lastId = existingIds[existingIds.length - 1];
      if (lastId) {
        nextCode += `\n    ${lastId} --> ${nodeSyntax}`;
      } else {
        nextCode += `\n    ${nodeSyntax}`;
      }
    }
    handleCodeChange(nextCode);
  };

  // Modal state for full preview lightbox
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalScale, setModalScale] = useState(1);
  const [modalPan, setModalPan] = useState({ x: 0, y: 0 });
  const [isModalPanning, setIsModalPanning] = useState(false);
  const [modalDragStart, setModalDragStart] = useState({ x: 0, y: 0 });

  const handleOpenModal = () => {
    setModalScale(1);
    setModalPan({ x: 0, y: 0 });
    setIsModalOpen(true);
  };

  // In read-only / preview mode (not editing), display clean diagram with click-to-full-preview
  if (!isEditable) {
    return (
      <NodeViewWrapper className="my-6">
        <div
          onClick={handleOpenModal}
          className="group relative flex items-center justify-center overflow-x-auto rounded-xl border border-cu-border/50 bg-cu-panel/40 p-4 transition-all hover:border-cu-purple/60 hover:bg-cu-panel/80 hover:shadow-md cursor-pointer select-none"
          title="Click to open full preview"
        >
          {/* Subtle expand badge on hover */}
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-cu-panel/90 backdrop-blur-xs border border-cu-border px-2 py-1 text-[11px] font-medium text-cu-text-secondary opacity-0 group-hover:opacity-100 transition-opacity shadow-xs pointer-events-none">
            <Maximize2 className="h-3 w-3 text-cu-purple" />
            <span>Full preview</span>
          </div>

          {error ? (
            <div className="rounded-lg border border-cu-urgent/30 bg-cu-urgent/10 p-4 text-center text-xs text-cu-urgent">
              <p className="font-semibold">Mermaid Syntax Error</p>
              <p className="mt-1 opacity-80">{error}</p>
            </div>
          ) : (
            <div
              className="flex items-center justify-center max-w-full"
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          )}
        </div>

        {/* Full Preview Modal Lightbox */}
        <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150" />
            <Dialog.Content className="fixed inset-4 sm:inset-10 z-50 m-auto flex flex-col rounded-2xl border border-cu-border bg-cu-panel shadow-2xl overflow-hidden outline-none animate-in fade-in zoom-in-95 duration-150">
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-cu-border bg-cu-subtle/30 px-4 select-none">
                <div className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-cu-purple" />
                  <Dialog.Title className="text-xs font-semibold text-cu-text">
                    Mermaid Diagram — Full Preview
                  </Dialog.Title>
                </div>

                <div className="flex items-center gap-2">
                  {/* Zoom Controls */}
                  <div className="flex items-center rounded border border-cu-border bg-cu-bg">
                    <button
                      type="button"
                      onClick={() => setModalScale((s) => Math.max(s - 0.2, 0.4))}
                      className="p-1 text-cu-text-tertiary hover:text-cu-text hover:bg-cu-hover rounded-l transition cursor-pointer"
                      title="Zoom out"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-1 text-[10px] font-mono text-cu-text-tertiary">
                      {Math.round(modalScale * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalScale((s) => Math.min(s + 0.2, 2.5))}
                      className="p-1 text-cu-text-tertiary hover:text-cu-text hover:bg-cu-hover rounded-r transition cursor-pointer"
                      title="Zoom in"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setModalScale(1);
                      setModalPan({ x: 0, y: 0 });
                    }}
                    className="p-1 text-cu-text-tertiary hover:text-cu-text hover:bg-cu-hover rounded transition cursor-pointer"
                    title="Reset view"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-1 text-cu-text-tertiary hover:text-cu-text hover:bg-cu-hover rounded transition cursor-pointer"
                    title="Copy Mermaid code"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>

                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="p-1 text-cu-text-tertiary hover:text-cu-text hover:bg-cu-hover rounded transition cursor-pointer ml-1"
                      title="Close preview (Esc)"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Dialog.Close>
                </div>
              </div>

              {/* Fullscreen Canvas with Pan & Zoom */}
              <div
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  setIsModalPanning(true);
                  setModalDragStart({ x: e.clientX - modalPan.x, y: e.clientY - modalPan.y });
                }}
                onMouseMove={(e) => {
                  if (!isModalPanning) return;
                  setModalPan({
                    x: e.clientX - modalDragStart.x,
                    y: e.clientY - modalDragStart.y,
                  });
                }}
                onMouseUp={() => setIsModalPanning(false)}
                onMouseLeave={() => setIsModalPanning(false)}
                className={cn(
                  "relative flex flex-1 items-center justify-center overflow-hidden p-8 select-none bg-cu-bg",
                  isModalPanning ? "cursor-grabbing" : "cursor-grab",
                )}
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, var(--color-cu-border, #27272a) 1px, transparent 0)",
                  backgroundSize: "20px 20px",
                }}
              >
                <div
                  style={{
                    transform: `translate(${modalPan.x}px, ${modalPan.y}px) scale(${modalScale})`,
                    transformOrigin: "center center",
                    transition: isModalPanning ? "none" : "transform 0.1s ease-out",
                  }}
                  className="max-w-none transition-transform pointer-events-none"
                  dangerouslySetInnerHTML={{ __html: svgHtml }}
                />

                <div className="absolute bottom-3 left-4 rounded-md bg-cu-panel/80 backdrop-blur-xs border border-cu-border px-2.5 py-1 text-[11px] text-cu-text-tertiary pointer-events-none">
                  Drag to pan • Use + / - to zoom • Esc to close
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className={cn(
        "my-6 overflow-hidden rounded-xl border border-cu-border bg-cu-panel shadow-sm transition-all",
        selected && "ring-2 ring-cu-primary",
        isFullscreen && "fixed inset-4 z-50 m-0 shadow-2xl",
      )}
    >
      {/* Block Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cu-border bg-cu-subtle/30 px-3 py-2 select-none">
        {/* Left: Drag Handle & Title */}
        <div className="flex items-center gap-2">
          {isEditable && (
            <div
              data-drag-handle
              className="cursor-grab active:cursor-grabbing p-0.5 text-cu-text-tertiary hover:text-cu-text transition"
              title="Drag to reposition diagram block"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-cu-text">
            <Workflow className="h-4 w-4 text-cu-purple" />
            <span>Mermaid Diagram</span>
          </div>

          {/* Mode Switch Tabs */}
          {isEditable && (
            <div className="ml-2 flex items-center rounded-md border border-cu-border bg-cu-bg p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 transition cursor-pointer",
                  activeTab === "preview"
                    ? "bg-cu-purple text-white font-medium"
                    : "text-cu-text-secondary hover:text-cu-text",
                )}
              >
                <Eye className="h-3 w-3" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("visual")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 transition cursor-pointer",
                  activeTab === "visual"
                    ? "bg-cu-purple text-white font-medium"
                    : "text-cu-text-secondary hover:text-cu-text",
                )}
                title="Visual Drag & Drop Diagram Builder"
              >
                <Sparkles className="h-3 w-3 text-amber-400" />
                <span>Drag & Drop</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("code")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 transition cursor-pointer",
                  activeTab === "code"
                    ? "bg-cu-purple text-white font-medium"
                    : "text-cu-text-secondary hover:text-cu-text",
                )}
              >
                <Code className="h-3 w-3" />
                <span>Code</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Templates, Zoom Controls, Copy, Fullscreen, Delete */}
        <div className="flex items-center gap-1.5">
          {/* Templates Selector in edit mode */}
          {isEditable && (
            <select
              aria-label="Select diagram template"
              onChange={(e) => {
                const idx = Number(e.target.value);
                if (!isNaN(idx) && DIAGRAM_TEMPLATES[idx]) {
                  handleCodeChange(DIAGRAM_TEMPLATES[idx].code);
                }
              }}
              defaultValue=""
              className="rounded border border-cu-border bg-cu-bg px-2 py-1 text-[11px] text-cu-text hover:bg-cu-hover transition cursor-pointer focus:outline-none"
            >
              <option value="" disabled>
                Templates...
              </option>
              {DIAGRAM_TEMPLATES.map((tmpl, idx) => (
                <option key={tmpl.name} value={idx}>
                  {tmpl.name}
                </option>
              ))}
            </select>
          )}

          {/* Zoom controls */}
          <div className="flex items-center rounded border border-cu-border bg-cu-bg">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 text-cu-text-tertiary hover:text-cu-text hover:bg-cu-hover rounded-l transition cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-1 text-[10px] font-mono text-cu-text-tertiary">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 text-cu-text-tertiary hover:text-cu-text hover:bg-cu-hover rounded-r transition cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1 text-cu-text-tertiary hover:text-cu-text hover:bg-cu-hover rounded transition cursor-pointer"
            title="Reset view"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={handleCopyCode}
            className="p-1 text-cu-text-tertiary hover:text-cu-text hover:bg-cu-hover rounded transition cursor-pointer"
            title="Copy Mermaid code"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 text-cu-text-tertiary hover:text-cu-text hover:bg-cu-hover rounded transition cursor-pointer"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen preview"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          {isEditable && (
            <button
              type="button"
              onClick={deleteNode}
              className="p-1 text-cu-text-tertiary hover:text-cu-urgent hover:bg-cu-hover rounded transition cursor-pointer"
              title="Delete diagram"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Visual Drag & Drop Palette Toolbar (When Visual tab active) */}
      {isEditable && activeTab === "visual" && (
        <div className="flex flex-wrap items-center gap-2 border-b border-cu-border bg-cu-panel px-3 py-2">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-cu-text-tertiary mr-1">
            <span>Drag Shapes:</span>
          </div>

          {PALETTE_SHAPES.map((shape) => (
            <div
              key={shape.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("shape-type", shape.type);
                e.dataTransfer.setData("shape-label", shape.label);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-cu-border bg-cu-bg px-2.5 py-1 text-xs text-cu-text font-medium shadow-xs hover:border-cu-purple hover:bg-cu-hover cursor-grab active:cursor-grabbing transition"
              title={`Drag "${shape.label}" onto diagram`}
            >
              {shape.icon}
              <span>{shape.label}</span>
            </div>
          ))}

          <span className="text-[11px] text-cu-text-tertiary italic ml-auto hidden sm:inline">
            Drag shape onto canvas to connect!
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <div className={cn("relative flex", isFullscreen ? "h-[calc(100%-45px)]" : "min-h-[320px]")}>
        {/* Code Editor Tab */}
        {isEditable && activeTab === "code" ? (
          <div className="flex h-full w-full flex-col md:flex-row">
            <div className="w-full md:w-1/2 border-r border-cu-border p-3 bg-cu-bg font-mono text-xs">
              <textarea
                value={codeValue}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="Enter Mermaid diagram code..."
                className="h-full min-h-[280px] w-full resize-none bg-transparent text-cu-text outline-none focus:ring-0 leading-relaxed"
                spellCheck={false}
              />
            </div>
            <div className="w-full md:w-1/2 p-4 flex items-center justify-center overflow-auto bg-cu-panel">
              {error ? (
                <div className="text-xs text-cu-urgent p-3 bg-cu-urgent/10 rounded-lg">
                  {error}
                </div>
              ) : (
                <div
                  className="max-h-[300px] max-w-full overflow-auto"
                  dangerouslySetInnerHTML={{ __html: svgHtml }}
                />
              )}
            </div>
          </div>
        ) : (
          /* Preview & Visual Drag-n-Drop Canvas */
          <div
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDragOver={(e) => {
              if (activeTab === "visual") {
                e.preventDefault();
                setIsDragOverDropzone(true);
              }
            }}
            onDragLeave={() => setIsDragOverDropzone(false)}
            onDrop={handleDropShape}
            className={cn(
              "relative flex flex-1 items-center justify-center overflow-hidden p-6 select-none",
              isPanning ? "cursor-grabbing" : "cursor-grab",
              isDragOverDropzone && "ring-2 ring-cu-purple ring-inset bg-cu-purple/5",
              isFullscreen ? "h-full" : "min-h-[340px]",
            )}
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, var(--color-cu-border, #27272a) 1px, transparent 0)",
              backgroundSize: "20px 20px",
            }}
          >
            {error ? (
              <div className="rounded-lg border border-cu-urgent/30 bg-cu-urgent/10 p-4 text-center text-xs text-cu-urgent">
                <p className="font-semibold">Mermaid Syntax Error</p>
                <p className="mt-1 opacity-80">{error}</p>
              </div>
            ) : (
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                  transformOrigin: "center center",
                  transition: isPanning ? "none" : "transform 0.1s ease-out",
                }}
                className="max-w-none transition-transform pointer-events-none"
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
            )}

            {/* Drag & Drop Canvas Overlay Hint */}
            {isEditable && activeTab === "visual" && (
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none">
                <div className="rounded-md bg-cu-panel/80 backdrop-blur-xs border border-cu-border px-2.5 py-1 text-[11px] text-cu-text-tertiary">
                  Tip: Drag shapes from the top bar and drop them anywhere here to extend the diagram.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
