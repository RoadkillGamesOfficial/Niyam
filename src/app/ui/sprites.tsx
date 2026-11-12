import type { SVGProps } from "react";

// Original pixel sprites for the farm-sim shell. Everything is drawn here from
// rectangles and paths: no third-party game art, no image requests.
type SpriteProps = SVGProps<SVGSVGElement>;

const base = {
  "aria-hidden": true,
  focusable: "false",
  shapeRendering: "crispEdges",
} as const;

export function StarIcon(props: SpriteProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path
        fill="currentColor"
        d="M11 1h2v6h6v2h3v2h-3v2h-6v6h-2v-6H5v-2H2V9h3V7h6V1Z"
      />
      <rect x="11" y="9" width="2" height="4" fill="var(--gold, #f4b41a)" />
    </svg>
  );
}

export function HeartIcon(props: SpriteProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path
        fill="currentColor"
        d="M5 3h5v2h4V3h5v2h2v2h1v6h-2v3h-2v2h-2v2h-2v2h-4v-2H8v-2H6v-2H4v-3H2V7h1V5h2V3Zm2 2H5v2H4v6h2v3h2v2h2v2h4v-2h2v-2h2v-3h2V7h-1V5h-3v2H9V5H7Z"
      />
      <rect x="7" y="8" width="3" height="2" fill="var(--parchment, #fdf0cf)" />
    </svg>
  );
}

export function ClockIcon(props: SpriteProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path
        fill="currentColor"
        d="M8 2h8v2h3v3h2v10h-2v3h-3v2H8v-2H5v-3H3V7h2V4h3V2Zm0 4H6v2H5v8h2v2h10v-2h2V8h-2V6H8Z"
      />
      <path fill="currentColor" d="M11 7h2v5h4v2h-6V7Z" />
    </svg>
  );
}

export function QuestIcon(props: SpriteProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path
        fill="var(--gold, #f4b41a)"
        stroke="currentColor"
        strokeWidth="2"
        d="M10 2h4v2h2v2h2v2h2v8h-2v2h-2v2h-2v2h-4v-2H8v-2H6v-2H4V8h2V6h2V4h2V2Z"
      />
      <rect x="11" y="7" width="2" height="6" fill="currentColor" />
      <rect x="11" y="15" width="2" height="2" fill="currentColor" />
    </svg>
  );
}

export function SunIcon(props: SpriteProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <rect x="10" y="1" width="4" height="3" fill="currentColor" />
      <rect x="10" y="20" width="4" height="3" fill="currentColor" />
      <rect x="1" y="10" width="3" height="4" fill="currentColor" />
      <rect x="20" y="10" width="3" height="4" fill="currentColor" />
      <path
        fill="var(--gold, #f4b41a)"
        stroke="currentColor"
        strokeWidth="2"
        d="M8 5h8v2h2v2h2v8h-2v2h-2v2H8v-2H6v-2H4V9h2V7h2V5Z"
      />
      <rect x="8" y="9" width="8" height="6" fill="var(--gold, #f4b41a)" />
    </svg>
  );
}

export function CompassIcon(props: SpriteProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M9 2h6v2h3v3h2v10h-2v3h-3v2H9v-2H6v-3H4V7h2V4h3V2Z"
      />
      <path fill="currentColor" d="m13 7 2 2-2 2-2-2 2-2Zm-2 6 2 2-2 2-2-2 2-2Z" />
      <rect x="11" y="10" width="2" height="4" fill="var(--gold, #f4b41a)" />
    </svg>
  );
}

export function LedgerIcon(props: SpriteProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M4 3h14v3h3v15H4V3Z"
      />
      <rect x="7" y="6" width="2" height="12" fill="currentColor" opacity=".35" />
      <rect x="11" y="12" width="6" height="2" fill="currentColor" />
      <rect x="11" y="16" width="4" height="2" fill="currentColor" />
      <rect x="11" y="8" width="5" height="2" fill="var(--gold, #f4b41a)" />
    </svg>
  );
}

export function GearIcon(props: SpriteProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M9 2h6v3h2v2h3v3h2v4h-2v3h-3v2h-2v3H9v-3H7v-2H4v-3H2v-4h2V7h3V5h2V2Z"
      />
      <rect x="9" y="9" width="6" height="6" fill="currentColor" />
    </svg>
  );
}

export function SproutIcon(props: SpriteProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <rect x="11" y="8" width="2" height="14" fill="var(--grass-2, #558b2f)" />
      <path fill="var(--grass-2, #558b2f)" d="M5 5h6v2H9v2H5V7H3V5h2Zm14 4h-6V7h2V5h4v2h2v2h-2Z" />
      <rect x="8" y="20" width="8" height="2" fill="var(--wood-mid, #8b5a2b)" />
    </svg>
  );
}

export function FlowerIcon(props: SpriteProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <rect x="11" y="10" width="2" height="12" fill="var(--leaf, #4caf50)" />
      <path fill="var(--leaf, #4caf50)" d="M5 15h6v2H5v-2Zm8 2h6v2h-6v-2Z" />
      <rect x="9" y="3" width="6" height="2" fill="var(--gold, #f4b41a)" />
      <rect x="7" y="5" width="10" height="6" fill="var(--parchment, #fdf0cf)" stroke="currentColor" strokeWidth="2" />
      <rect x="11" y="7" width="2" height="2" fill="var(--gold-dark, #b97a0a)" />
    </svg>
  );
}

/** Five original growth stages, driven by each habit's current streak. */
export function CropIcon({
  stage,
  className,
}: {
  stage: 0 | 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      {...base}
      className={className}
    >
      <rect x="8" y="48" width="48" height="10" fill="var(--wood-dark, #5d3a1a)" />
      <rect x="12" y="44" width="40" height="4" fill="var(--wood-mid, #8b5a2b)" />
      <rect x="16" y="52" width="4" height="2" fill="var(--wood-light, #c68b4e)" />
      <rect x="44" y="52" width="3" height="2" fill="var(--wood-light, #c68b4e)" />
      {stage === 0 ? (
        <>
          <rect x="29" y="41" width="6" height="3" fill="var(--wood-dark, #5d3a1a)" />
          <rect x="31" y="36" width="2" height="5" fill="var(--leaf, #4caf50)" />
          <rect x="36" y="39" width="3" height="2" fill="var(--grass-2, #558b2f)" />
        </>
      ) : null}
      {stage >= 1 ? (
        <>
          <rect x="31" y={stage === 1 ? 34 : 28} width="3" height={stage === 1 ? 10 : 16} fill="var(--grass-2, #558b2f)" />
          <rect x="22" y={stage === 1 ? 32 : 27} width="9" height="5" fill="var(--grass-1, #7cb342)" />
          <rect x="34" y={stage === 1 ? 36 : 31} width="10" height="5" fill="var(--grass-1, #7cb342)" />
        </>
      ) : null}
      {stage >= 2 ? (
        <>
          <rect x="18" y="23" width="8" height="4" fill="var(--leaf, #4caf50)" />
          <rect x="38" y="20" width="9" height="4" fill="var(--leaf, #4caf50)" />
        </>
      ) : null}
      {stage === 3 ? (
        <>
          <rect x="26" y="14" width="12" height="12" fill="var(--gold, #f4b41a)" />
          <rect x="29" y="17" width="6" height="6" fill="var(--parchment, #fdf0cf)" />
          <rect x="31" y="19" width="2" height="2" fill="var(--wood-dark, #5d3a1a)" />
          <rect x="22" y="18" width="4" height="4" fill="var(--parchment, #fdf0cf)" />
          <rect x="38" y="18" width="4" height="4" fill="var(--parchment, #fdf0cf)" />
        </>
      ) : null}
      {stage === 4 ? (
        <>
          <rect x="23" y="13" width="6" height="6" fill="var(--gold, #f4b41a)" />
          <rect x="35" y="10" width="7" height="7" fill="var(--gold, #f4b41a)" />
          <rect x="38" y="28" width="6" height="6" fill="var(--water, #4aa3df)" />
          <rect x="20" y="22" width="4" height="3" fill="var(--parchment, #fdf0cf)" />
          <rect x="43" y="25" width="3" height="3" fill="var(--parchment, #fdf0cf)" />
        </>
      ) : null}
    </svg>
  );
}

/** A friendly original farm spirit: hat, sprout, patch overalls. */
export function Mascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      {...base}
      className={className}
      role="presentation"
    >
      <g className="mascot-sway">
        <rect x="29" y="2" width="4" height="7" fill="var(--grass-2, #558b2f)" />
        <rect x="24" y="1" width="5" height="4" fill="var(--grass-1, #7cb342)" />
        <rect x="34" y="3" width="6" height="4" fill="var(--grass-1, #7cb342)" />
        <rect x="13" y="17" width="38" height="5" fill="var(--wood-dark, #5d3a1a)" />
        <rect x="18" y="9" width="28" height="9" fill="var(--gold, #f4b41a)" />
        <rect x="18" y="9" width="28" height="3" fill="var(--wood-light, #c68b4e)" />
        <rect x="22" y="12" width="20" height="2" fill="var(--gold-dark, #b97a0a)" />
        <rect x="18" y="22" width="28" height="22" fill="var(--parchment, #fdf0cf)" stroke="var(--wood-dark, #5d3a1a)" strokeWidth="2" />
        <rect x="18" y="38" width="28" height="7" fill="var(--leaf, #4caf50)" />
        <rect x="23" y="38" width="3" height="12" fill="var(--grass-2, #558b2f)" />
        <rect x="38" y="38" width="3" height="12" fill="var(--grass-2, #558b2f)" />
        <rect x="21" y="41" width="22" height="9" fill="var(--water, #4aa3df)" />
        <rect x="24" y="44" width="4" height="4" fill="var(--parchment-dark, #ecd49a)" />
        <rect x="37" y="44" width="4" height="4" fill="var(--parchment-dark, #ecd49a)" />
        <g className="mascot-eyes">
          <rect x="24" y="28" width="4" height="5" fill="var(--ink, #3b2410)" />
          <rect x="37" y="28" width="4" height="5" fill="var(--ink, #3b2410)" />
        </g>
        <rect x="26" y="37" width="12" height="2" fill="var(--wood-dark, #5d3a1a)" />
        <rect x="21" y="34" width="5" height="2" fill="var(--heart, #e8605a)" />
        <rect x="39" y="34" width="5" height="2" fill="var(--heart, #e8605a)" />
        <rect x="18" y="22" width="2" height="15" fill="var(--gold, #f4b41a)" />
        <rect x="44" y="22" width="2" height="15" fill="var(--gold, #f4b41a)" />
        <rect x="14" y="50" width="4" height="8" fill="var(--wood-dark, #5d3a1a)" />
        <rect x="46" y="50" width="4" height="8" fill="var(--wood-dark, #5d3a1a)" />
      </g>
    </svg>
  );
}
