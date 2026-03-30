/** Max file size from the gallery/camera before we reject (generous for phone photos). */
export const AVATAR_MAX_INPUT_BYTES = 20 * 1024 * 1024;

/** Longest edge after resize (enough for a crisp profile circle). */
const MAX_EDGE_PX = 1600;

/** DynamoDB items are max 400KB; leave headroom for other user attributes. */
const TARGET_OUTPUT_BYTES = 260_000;

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(blob);
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
}

/**
 * Decode image, limit dimensions, re-encode as JPEG so large portraits are safe for DynamoDB.
 */
export async function prepareAvatarUpload(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    let w = bitmap.width;
    let h = bitmap.height;
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");

    const encodeUnderBudget = async (outW: number, outH: number, startQ: number) => {
      canvas.width = outW;
      canvas.height = outH;
      ctx.drawImage(bitmap, 0, 0, outW, outH);
      let quality = startQ;
      let blob = await toBlob(canvas, quality);
      if (!blob) throw new Error("encode");
      while (blob.size > TARGET_OUTPUT_BYTES && quality > 0.42) {
        quality -= 0.07;
        blob = await toBlob(canvas, quality);
        if (!blob) throw new Error("encode");
      }
      return blob;
    };

    let blob = await encodeUnderBudget(w, h, 0.88);

    if (blob.size > TARGET_OUTPUT_BYTES && Math.max(w, h) > 640) {
      const factor = 0.65;
      const w2 = Math.max(320, Math.round(w * factor));
      const h2 = Math.max(320, Math.round(h * factor));
      blob = await encodeUnderBudget(w2, h2, 0.82);
    }

    return blobToDataUrl(blob);
  } finally {
    bitmap.close();
  }
}
