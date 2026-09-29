"use client";

import React, { useState, useEffect, useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  AlignLeft,
  AlignCenter,
  StretchHorizontal,
  Trash2,
  GripVertical,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Image as ImageIcon,
  X,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "../../../lib/utils";

export interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt: string;
  caption?: string;
}

export function ImageLightboxModal({
  isOpen,
  onClose,
  src,
  alt,
  caption,
}: ImageLightboxModalProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPan({ x: 0, y: 0 });
      setIsPanning(false);
    }
  }, [isOpen]);

  const handleZoomIn = () =>
    setScale((s) => Math.min(Number((s + 0.25).toFixed(2)), 4));
  const handleZoomOut = () =>
    setScale((s) => Math.max(Number((s - 0.25).toFixed(2)), 0.25));
  const handleResetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setScale((s) =>
      Math.max(0.25, Math.min(4, Number((s + delta).toFixed(2)))),
    );
  };

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

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150" />
        <Dialog.Content className="fixed inset-4 sm:inset-10 z-50 m-auto flex flex-col rounded-2xl border border-cu-border bg-cu-panel shadow-2xl overflow-hidden outline-none animate-in fade-in zoom-in-95 duration-150">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-cu-border bg-cu-subtle/30 px-4 select-none">
            <div className="flex items-center gap-2 min-w-0 mr-4">
              <ImageIcon className="h-4 w-4 text-cu-purple shrink-0" />
              <Dialog.Title className="text-xs font-semibold text-cu-text truncate">
                {caption || alt || "Image Preview"}
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Image preview lightbox with zoom and pan controls
              </Dialog.Description>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center rounded border border-cu-border bg-cu-bg">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1 text-cu-text-tertiary hover:text-cu-text hover:bg-cu-hover rounded-l transition cursor-pointer"
                  title="Zoom out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-1.5 text-[10px] font-mono text-cu-text-tertiary min-w-[36px] text-center">
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
                title="Reset view (1:1)"
              >
                <RotateCcw className="h-3.5 w-3.5" />
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

          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onDoubleClick={handleResetZoom}
            className={cn(
              "relative flex flex-1 items-center justify-center overflow-hidden p-6 select-none bg-cu-bg",
              isPanning ? "cursor-grabbing" : "cursor-grab",
            )}
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, var(--color-cu-border, #27272a) 1px, transparent 0)",
              backgroundSize: "20px 20px",
            }}
          >
            <img
              src={src}
              alt={alt || caption || "Image preview"}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: "center center",
                transition: isPanning ? "none" : "transform 0.1s ease-out",
                maxHeight: "80vh",
                maxWidth: "85vw",
                objectFit: "contain",
              }}
              className="select-none pointer-events-none rounded shadow-md"
              draggable={false}
            />

            <div className="absolute bottom-3 left-4 rounded-md bg-cu-panel/80 backdrop-blur-xs border border-cu-border px-2.5 py-1 text-[11px] text-cu-text-tertiary pointer-events-none">
              Drag to pan • Scroll or +/- to zoom • Double-click to reset • Esc to close
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ImageBlock(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected, editor } = props;
  const isEditable = editor.isEditable;

  const src = (node.attrs.src as string) || "";
  const alt = (node.attrs.alt as string) || "";
  const caption = (node.attrs.caption as string) || "";
  const width = (node.attrs.width as string) || "100%";
  const alignment = (node.attrs.alignment as string) || "center";

  // Local caption state for input
  const [captionValue, setCaptionValue] = useState(caption);
  useEffect(() => {
    setCaptionValue(caption);
  }, [caption]);

  // Live resize state
  const [liveWidth, setLiveWidth] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lightbox Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const handleOpenModal = () => setIsModalOpen(true);

  // Resize drag handle handler
  const handleResizeStart = (e: React.MouseEvent, direction: "left" | "right") => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const initialWidthPx =
      containerRef.current?.getBoundingClientRect().width || 400;
    const parentWidthPx =
      containerRef.current?.parentElement?.getBoundingClientRect().width || 800;

    const onMouseMove = (ev: MouseEvent) => {
      const deltaX =
        direction === "right" ? ev.clientX - startX : startX - ev.clientX;
      const newWidthPx = initialWidthPx + deltaX * 2;
      const pct = Math.max(
        15,
        Math.min(100, Math.round((newWidthPx / parentWidthPx) * 100)),
      );
      setLiveWidth(`${pct}%`);
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setIsResizing(false);
      const deltaX =
        direction === "right" ? ev.clientX - startX : startX - ev.clientX;
      const newWidthPx = initialWidthPx + deltaX * 2;
      const pct = Math.max(
        15,
        Math.min(100, Math.round((newWidthPx / parentWidthPx) * 100)),
      );
      const finalWidth = `${pct}%`;
      setLiveWidth(null);
      updateAttributes({
        width: finalWidth,
        alignment: alignment === "full" ? "center" : alignment,
      });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const currentWidth =
    alignment === "full" ? "100%" : liveWidth || width || "100%";

  // Read-only / Preview mode
  if (!isEditable) {
    return (
      <NodeViewWrapper className="my-6" draggable={false}>
        <div
          className={cn(
            "w-full flex",
            alignment === "left" && "justify-start",
            alignment === "center" && "justify-center",
            alignment === "full" && "justify-center w-full",
            alignment === "right" && "justify-end",
          )}
        >
          <div
            style={{ width: currentWidth, maxWidth: "100%" }}
            className="group relative select-none flex flex-col items-center"
          >
            <div
              onClick={handleOpenModal}
              className="group/img relative overflow-hidden rounded-xl border border-transparent hover:border-cu-border/80 transition-all hover:shadow-md cursor-pointer block w-full"
              title="Click to open full preview"
            >
              <img
                src={src}
                alt={alt || caption || ""}
                className="w-full h-auto rounded-xl object-contain block select-none"
                draggable={false}
              />

              {/* Subtle [⛶ Full preview] badge on hover */}
              <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-cu-panel/90 backdrop-blur-xs border border-cu-border px-2 py-1 text-[11px] font-medium text-cu-text-secondary opacity-0 group-hover/img:opacity-100 transition-opacity shadow-xs pointer-events-none">
                <Maximize2 className="h-3 w-3 text-cu-purple" />
                <span>Full preview</span>
              </div>
            </div>

            {caption && (
              <p className="mt-2 text-center text-xs text-cu-text-tertiary select-none">
                {caption}
              </p>
            )}
          </div>
        </div>

        <ImageLightboxModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          src={src}
          alt={alt}
          caption={caption}
        />
      </NodeViewWrapper>
    );
  }

  // Edit Mode
  return (
    <NodeViewWrapper
      className={cn(
        "my-8 relative group transition-all",
        selected && "ring-2 ring-cu-purple/60 rounded-xl",
      )}
    >
      <div
        className={cn(
          "w-full flex relative",
          alignment === "left" && "justify-start",
          alignment === "center" && "justify-center",
          alignment === "full" && "justify-center w-full",
          alignment === "right" && "justify-end",
        )}
      >
        <div
          ref={containerRef}
          style={{ width: currentWidth, maxWidth: "100%" }}
          className="relative flex flex-col items-center group/imgContainer transition-[width] duration-75"
        >
          {/* Top Hover Toolbar */}
          <div
            className={cn(
              "absolute -top-11 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-lg border border-cu-border bg-cu-panel/95 backdrop-blur-md px-2 py-1 shadow-lg transition-opacity duration-150 select-none",
              selected || isResizing
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 group-hover/imgContainer:opacity-100 pointer-events-auto",
            )}
          >
            {/* Drag Handle */}
            <div
              data-drag-handle
              className="cursor-grab active:cursor-grabbing p-1 text-cu-text-tertiary hover:text-cu-text transition"
              title="Drag to reposition image"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>

            <div className="h-4 w-px bg-cu-border mx-0.5" />

            {/* Alignment buttons */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => updateAttributes({ alignment: "left" })}
                className={cn(
                  "p-1 rounded transition cursor-pointer",
                  alignment === "left"
                    ? "bg-cu-purple text-white"
                    : "text-cu-text-secondary hover:text-cu-text hover:bg-cu-hover",
                )}
                title="Align Left"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => updateAttributes({ alignment: "center" })}
                className={cn(
                  "p-1 rounded transition cursor-pointer",
                  alignment === "center"
                    ? "bg-cu-purple text-white"
                    : "text-cu-text-secondary hover:text-cu-text hover:bg-cu-hover",
                )}
                title="Align Center"
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateAttributes({ alignment: "full", width: "100%" })
                }
                className={cn(
                  "p-1 rounded transition cursor-pointer",
                  alignment === "full"
                    ? "bg-cu-purple text-white"
                    : "text-cu-text-secondary hover:text-cu-text hover:bg-cu-hover",
                )}
                title="Full Width"
              >
                <StretchHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="h-4 w-px bg-cu-border mx-0.5" />

            {/* Quick Width Preset buttons */}
            <div className="flex items-center gap-0.5">
              {(["25%", "50%", "75%", "100%"] as const).map((w) => {
                const isActive =
                  alignment !== "full" &&
                  (width === w || (w === "100%" && !width));
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      updateAttributes({
                        width: w,
                        alignment:
                          alignment === "full" && w !== "100%"
                            ? "center"
                            : alignment,
                      });
                    }}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-medium transition cursor-pointer",
                      isActive
                        ? "bg-cu-purple text-white shadow-xs"
                        : "text-cu-text-secondary hover:text-cu-text hover:bg-cu-hover",
                    )}
                    title={`Set width to ${w}`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>

            <div className="h-4 w-px bg-cu-border mx-0.5" />

            {/* Preview Lightbox Button in Edit Mode */}
            <button
              type="button"
              onClick={handleOpenModal}
              className="p-1 rounded text-cu-text-secondary hover:text-cu-text hover:bg-cu-hover transition cursor-pointer"
              title="Open full preview"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>

            {/* Delete button */}
            <button
              type="button"
              onClick={deleteNode}
              className="p-1 rounded text-cu-text-secondary hover:text-cu-urgent hover:bg-cu-hover transition cursor-pointer"
              title="Delete image"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Image Container with Left and Right Drag Resize Handles */}
          <div className="relative w-full rounded-xl overflow-hidden border border-cu-border/40 bg-cu-panel shadow-xs group/img">
            {/* Left Drag Resize Handle */}
            <div
              onMouseDown={(e) => handleResizeStart(e, "left")}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-20 flex h-9 w-2 items-center justify-center rounded-full bg-cu-purple/90 text-white shadow-md cursor-ew-resize opacity-0 group-hover/imgContainer:opacity-100 transition-opacity hover:scale-125"
              title="Drag to resize width"
            >
              <div className="h-4 w-0.5 rounded-full bg-white" />
            </div>

            {/* Right Drag Resize Handle */}
            <div
              onMouseDown={(e) => handleResizeStart(e, "right")}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex h-9 w-2 items-center justify-center rounded-full bg-cu-purple/90 text-white shadow-md cursor-ew-resize opacity-0 group-hover/imgContainer:opacity-100 transition-opacity hover:scale-125"
              title="Drag to resize width"
            >
              <div className="h-4 w-0.5 rounded-full bg-white" />
            </div>

            {/* Current width pill during resize or hover */}
            {(isResizing || liveWidth) && (
              <div className="absolute bottom-2 right-2 z-20 rounded bg-cu-panel/90 border border-cu-border px-1.5 py-0.5 text-[10px] font-mono font-medium text-cu-purple shadow-sm">
                {liveWidth || width}
              </div>
            )}

            <img
              src={src}
              alt={alt || caption || ""}
              className="w-full h-auto object-contain block select-none"
              draggable={false}
            />
          </div>

          {/* Editable Caption Input with Auto-Save */}
          <div className="mt-2 flex items-center justify-center w-full">
            <input
              type="text"
              value={captionValue}
              onChange={(e) => {
                const val = e.target.value;
                setCaptionValue(val);
                updateAttributes({ caption: val, alt: val });
              }}
              placeholder="Add a caption..."
              className="w-full max-w-lg bg-transparent text-center text-xs text-cu-text placeholder:text-cu-text-tertiary/60 border-b border-transparent hover:border-cu-border/50 focus:border-cu-purple focus:outline-none py-1 transition-colors"
            />
          </div>
        </div>
      </div>

      <ImageLightboxModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        src={src}
        alt={alt}
        caption={caption}
      />
    </NodeViewWrapper>
  );
}
