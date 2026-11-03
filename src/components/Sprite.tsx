import { useEffect, useState } from "react";
import { HAM, RUN_A, RUN_B } from "../core/sprites";

interface Props {
  rows: string[];
  palette: Record<string, string>;
  px: number;
  label?: string;
  className?: string;
}

export function Sprite({ rows, palette, px, label, className }: Props) {
  const w = rows[0].length;
  const h = rows.length;
  const rects: JSX.Element[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (c === ".") {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run] === c) run++;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} fill={palette[c] ?? "#f0f"} />);
      x += run;
    }
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * px}
      height={h * px}
      className={className}
      style={{ maxWidth: "100%", height: "auto" }}
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {rects}
    </svg>
  );
}

export function RunSprite({ running, px, label }: { running: boolean; px: number; label?: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setFrame((f) => 1 - f), 150);
    return () => clearInterval(id);
  }, [running]);
  return <Sprite rows={frame ? RUN_B : RUN_A} palette={HAM} px={px} label={label} />;
}
