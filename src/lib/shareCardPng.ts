import type { Analysis } from "../types";

export async function renderShareCardPng(analysis: Analysis): Promise<Blob> {
  const contradiction = analysis.timeline.find((e) =>
    e.tags.includes("rozpor")
  );
  const accused = analysis.persons.find((p) => p.role === "obvinený");

  const title = `${accused?.name || "Obvinený"} — Alibi Impossible`;
  const subtitle = "AI našla rozpor v spise.";
  const rozporTitle = contradiction?.title || "Rozpor vo výpovedi";
  const rozporDesc = (contradiction?.description || "").slice(0, 120);
  const footer = "ForenzDetectiv";

  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nie je dostupný.");

  ctx.fillStyle = "#fafaf9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#dc2626";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.fillText("ALIBI IMPOSSIBLE", 24, 36);

  ctx.fillStyle = "#1c1917";
  ctx.font = "bold 20px system-ui, sans-serif";
  wrapText(ctx, title, 24, 72, 352, 24);

  ctx.fillStyle = "#78716c";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(subtitle, 24, 120);

  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 24, 140, 352, 120, 12);
  ctx.fill();

  ctx.fillStyle = "#dc2626";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillText("ROZPOR", 36, 162);

  ctx.fillStyle = "#1c1917";
  ctx.font = "bold 14px system-ui, sans-serif";
  wrapText(ctx, rozporTitle, 36, 182, 328, 18);

  ctx.fillStyle = "#57534e";
  ctx.font = "12px system-ui, sans-serif";
  wrapText(ctx, rozporDesc, 36, 210, 328, 16);

  ctx.fillStyle = "#a8a29e";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText(footer, 24, 450);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG export zlyhal."));
    }, "image/png");
  });
}

export function downloadShareCardPng(blob: Blob, filename = "alibi-impossible.png"): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(/\s+/);
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
