import { fmt, level, type Save } from "./economy";
import { HAM, SIT } from "./sprites";

function drawSprite(ctx: CanvasRenderingContext2D, rows: string[], pal: Record<string, string>, x: number, y: number, px: number) {
  rows.forEach((row, ry) => {
    [...row].forEach((c, rx) => {
      if (c === ".") return;
      ctx.fillStyle = pal[c] ?? "#f0f";
      ctx.fillRect(x + rx * px, y + ry * px, px, px);
    });
  });
}

export async function makeShareCard(save: Save, host: string): Promise<Blob> {
  try {
    await document.fonts.ready;
  } catch {
    // fonts are optional here
  }
  const W = 1200;
  const H = 630;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#8fdcec";
  ctx.fillRect(0, 0, W, 330);
  ctx.fillStyle = "#4fae5f";
  ctx.fillRect(0, 330, W, 20);
  ctx.fillStyle = "#4a3236";
  ctx.fillRect(0, 350, W, H - 350);
  ctx.fillStyle = "#392730";
  ctx.fillRect(0, 500, W, H - 500);

  drawSprite(ctx, SIT, HAM, 90, 330 - 15 * 14, 14);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#2a1a1e";
  ctx.font = "800 70px 'Bricolage Grotesque', sans-serif";
  ctx.fillText("Squeek Burrow", 420, 150);
  ctx.font = "600 30px Figtree, sans-serif";
  ctx.fillText("My burrow works when the real hamster works.", 420, 200);

  ctx.fillStyle = "#fff0d4";
  ctx.font = "800 84px 'Bricolage Grotesque', sans-serif";
  ctx.fillText(`${fmt(save.allTime)} seeds`, 90, 450);
  ctx.font = "600 32px Figtree, sans-serif";
  ctx.fillStyle = "#f6ecdf";
  const stats = [`${level(save)} chambers`, `${save.dream} dream seeds`, `${save.hibernations} hibernations`];
  let sx = 90;
  for (const t of stats) {
    ctx.fillText(t, sx, 560);
    sx += ctx.measureText(t).width + 56;
  }

  ctx.font = "600 24px Figtree, sans-serif";
  ctx.fillStyle = "#b9a5b0";
  ctx.fillText(host, 90, 600);
  ctx.textAlign = "right";
  ctx.fillText("Unofficial fan project. Not affiliated with Squeekchain.", W - 60, 600);

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("no blob"))), "image/png"));
}
