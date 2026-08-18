/**
 * Downscale a photo in the browser so uploads stay under the server limit.
 * Modern phone cameras easily produce 10–20 MB JPEGs; for OCR/design analysis
 * ~2200px on the long edge is more than enough.
 * Returns the original file for non-images or when compression fails/doesn't help.
 */
export async function compressImageIfNeeded(file: File, maxBytes: number): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= maxBytes) return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    URL.revokeObjectURL(url);

    const MAX_EDGE = 2200;
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.85, 0.7, 0.55, 0.4, 0.3]) {
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", quality));
      if (blob && blob.size <= maxBytes) {
        const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg" });
      }
    }
    return file;
  } catch {
    return file;
  }
}
