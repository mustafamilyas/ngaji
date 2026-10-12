const WIDTH = 380;
const ROW_Y = [34, 104, 174, 244];
const LEAF_X = Array.from({ length: 8 }, (_, i) => 22 + i * 34);
const LABEL_X = 292;

type Point = { x: number; y: number };

/** Each row's nodes sit at the midpoint of the two children below them. */
function buildRows(): Point[][] {
  const rows: Point[][] = [LEAF_X.map((x) => ({ x, y: ROW_Y[3] }))];
  for (let level = 2; level >= 0; level--) {
    const below = rows[0];
    rows.unshift(
      Array.from({ length: below.length / 2 }, (_, i) => ({
        x: (below[i * 2].x + below[i * 2 + 1].x) / 2,
        y: ROW_Y[level],
      })),
    );
  }
  return rows;
}

function edge(from: Point, to: Point) {
  const mid = (from.y + to.y) / 2;
  return `M${from.x} ${from.y}C${from.x} ${mid} ${to.x} ${mid} ${to.x} ${to.y}`;
}

/**
 * The product in one picture: a kegiatan (amber) created at the top lands on every
 * group below it. Decorative for assistive tech; the same message is in `label`.
 */
export function HierarchyDiagram({ levels, label }: { levels: readonly string[]; label: string }) {
  const rows = buildRows();
  return (
    <svg
      viewBox={`0 0 ${WIDTH} 280`}
      role="img"
      aria-label={label}
      className="h-auto w-full max-w-md"
    >
      <g fill="none" stroke="var(--l-leaf)" strokeWidth="2" strokeLinecap="round" opacity="0.55">
        {rows.slice(0, -1).flatMap((row, level) =>
          row.flatMap((parent, i) => [
            <path key={`${level}-${i}-a`} d={edge(parent, rows[level + 1][i * 2])} />,
            <path key={`${level}-${i}-b`} d={edge(parent, rows[level + 1][i * 2 + 1])} />,
          ]),
        )}
      </g>
      {rows.map((row, level) =>
        row.map((p, i) => (
          <g key={`${level}-${i}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={level === 0 ? 13 : 9}
              fill={level === 0 ? "var(--l-sap)" : "var(--l-paper)"}
              stroke={level === 0 ? "var(--l-sap)" : "var(--l-leaf)"}
              strokeWidth="2"
            />
            {level > 0 && <circle cx={p.x} cy={p.y} r="3.5" fill="var(--l-sap)" />}
          </g>
        )),
      )}
      {levels.map((name, level) => (
        <text
          key={name}
          x={LABEL_X}
          y={ROW_Y[level] + 4}
          fontSize="13"
          fill="var(--l-muted)"
          aria-hidden="true"
        >
          {name}
        </text>
      ))}
    </svg>
  );
}
