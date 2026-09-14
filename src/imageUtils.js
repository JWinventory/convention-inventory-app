// Resizes and compresses an uploaded image File into a JPEG data URL,
// so item photos stay well under Firestore's 1MB-per-document cap.
//
// Starts at a much higher quality/size than before, then automatically
// steps the quality down (and if needed, the dimensions too) only if a
// particular photo would still come out too large — so most photos end
// up noticeably sharper than before, and only very detailed/busy ones
// get scaled back further.
//
// maxDataUrlLength is overridable per-call: when several photos are
// being added to the same item at once, the caller can pass a smaller
// per-photo budget so the whole batch fits under Firestore's 1MB
// per-document limit rather than each photo being compressed as if it
// were the only one on that item.
const DEFAULT_MAX_DATA_URL_LENGTH = 700000; // ~700KB, leaves headroom under the 1MB doc cap

export function fileToCompressedDataUrl(file, maxDim = 900, quality = 0.85, maxDataUrlLength = DEFAULT_MAX_DATA_URL_LENGTH) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        try {
          resolve(compressWithFallback(img, maxDim, quality, maxDataUrlLength));
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
function compressWithFallback(img, maxDim, quality, maxDataUrlLength) {
  const dimSteps = [maxDim, Math.round(maxDim * 0.75), Math.round(maxDim * 0.5), Math.round(maxDim * 0.3)];
  const qualitySteps = [quality, 0.7, 0.55, 0.4, 0.25];

  for (const dim of dimSteps) {
    const canvas = drawToCanvas(img, dim);
    for (const q of qualitySteps) {
      const dataUrl = canvas.toDataURL("image/jpeg", q);
      if (dataUrl.length <= maxDataUrlLength) {
        return dataUrl;
      }
    }
  }

  const canvas = drawToCanvas(img, dimSteps[dimSteps.length - 1]);
  return canvas.toDataURL("image/jpeg", qualitySteps[qualitySteps.length - 1]);
}

// Given how many images already exist on an item and how many new ones
// are about to be added, works out a safe per-image size budget so the
// whole set fits comfortably under Firestore's 1MB document cap —
// instead of compressing every photo as if it were the only one.
const TOTAL_IMAGE_BUDGET = 900000; // leaves room for the item's other fields
const MIN_PER_IMAGE_BUDGET = 60000; // don't compress any single photo below this

export function budgetPerNewImage(existingImages, newFileCount) {
  const existingBytes = (existingImages || []).reduce((sum, img) => sum + (img ? img.length : 0), 0);
  const remaining = TOTAL_IMAGE_BUDGET - existingBytes;
  const perImage = remaining / Math.max(newFileCount, 1);
  return Math.max(perImage, MIN_PER_IMAGE_BUDGET);
}

// Returns an item's photos as an array, regardless of whether it was
// saved with the old single-photo "img" field or the newer "images"
// array — so older catalog items keep working without needing to be
// re-edited.
export function getItemImages(item) {
  if (!item) return [];
  if (Array.isArray(item.images) && item.images.length) return item.images;
  if (item.img) return [item.img];
  return [];
}
