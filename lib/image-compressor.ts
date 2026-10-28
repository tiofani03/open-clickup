/**
 * Utility functions for client-side image compression and filename sanitization.
 */

export function shouldCompress(mimeType: string, sizeBytes: number): boolean {
  if (mimeType === "image/svg+xml" || mimeType === "image/gif") return false;
  return sizeBytes > 500 * 1024;
}

export function sanitizeImageName(filename: string): string {
  const base =
    filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || "image";
  return `${base}.webp`;
}

export async function compressImage(
  file: File,
  maxSizeBytes: number = 500 * 1024,
  maxWidth: number = 1920,
  maxHeight: number = 1920
): Promise<Blob> {
  // Pass-through SVGs or GIFs to preserve animation/vectors
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  // If already under max size and is WebP or JPEG, don't re-compress
  if (file.size <= maxSizeBytes && (file.type === "image/webp" || file.type === "image/jpeg")) {
    return file;
  }

  // In non-browser / SSR environments where Image or document is undefined, return file directly
  if (typeof window === "undefined" || typeof document === "undefined" || typeof Image === "undefined") {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Iteratively step down quality to satisfy maxSizeBytes
      const qualities = [0.85, 0.70, 0.55, 0.40];
      let qualityIndex = 0;

      function tryCompress() {
        const quality = qualities[qualityIndex] ?? 0.4;
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            if (blob.size <= maxSizeBytes || qualityIndex >= qualities.length - 1) {
              resolve(blob);
            } else {
              qualityIndex++;
              tryCompress();
            }
          },
          "image/webp",
          quality
        );
      }

      tryCompress();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback to original file if decode fails
    };

    img.src = url;
  });
}
