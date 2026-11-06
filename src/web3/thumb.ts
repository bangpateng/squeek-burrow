// NFT art is an SVG with thousands of dots: costly for the browser to repaint.
// Rasterise each one once to a small PNG and reuse that everywhere it is shown small.
import { useEffect, useState } from "react";

const cache = new Map<string, Promise<string>>();

export function thumbUrl(image: string, size: number): Promise<string> {
  const key = `${size}:${image.length}:${image.slice(-64)}`;
  let p = cache.get(key);
  if (!p) {
    p = new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const cv = document.createElement("canvas");
          cv.width = cv.height = size;
          const ctx = cv.getContext("2d")!;
          ctx.drawImage(img, 0, 0, size, size);
          cv.toBlob((b) => resolve(b ? URL.createObjectURL(b) : image), "image/png");
        } catch {
          resolve(image);
        }
      };
      img.onerror = () => resolve(image);
      img.src = image;
    });
    cache.set(key, p);
  }
  return p;
}

export function useThumb(image: string | undefined, size: number): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setUrl(undefined);
    if (image) thumbUrl(image, size).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [image, size]);
  return url;
}
