// Resizes and compresses an uploaded image File into a JPEG data URL,
// so item photos stay well under Firestore's 1MB-per-document cap.
//
// Starts at a much higher quality/size than before, then automatically
// steps the quality down (and if needed, the dimensions too) only if a
// particular photo would still come out too large — so most photos end
// up noticeably sharper than before, and only very detailed/busy ones
// get scaled back further.
const MAX_DATA_URL_LENGTH = 700000; // ~700KB, leaves headroom under the 1MB doc cap

export function fileToCompressedDataUrl(file, maxDim = 900, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        try {
          resolve(compressWithFallback(img, maxDim, quality));
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function drawToCanvas(img, dim) {
  let { width, height } = img;
  const scale = Math.min(1, dim / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

// Tries the requested quality/size first. If the result is still too
// large, lowers quality in steps, and if it's still too large even at
// the lowest quality, shrinks the dimensions and tries again.
function compressWithFallback(img, maxDim, quality) {
  const dimSteps = [maxDim, Math.round(maxDim * 0.75), Math.round(maxDim * 0.5)];
  const qualitySteps = [quality, 0.7, 0.55, 0.4];

  for (const dim of dimSteps) {
    const canvas = drawToCanvas(img, dim);
    for (const q of qualitySteps) {
      const dataUrl = canvas.toDataURL("image/jpeg", q);
      if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
        return dataUrl;
      }
    }
  }

  const canvas = drawToCanvas(img, dimSteps[dimSteps.length - 1]);
  return canvas.toDataURL("image/jpeg", qualitySteps[qualitySteps.length - 1]);
}
