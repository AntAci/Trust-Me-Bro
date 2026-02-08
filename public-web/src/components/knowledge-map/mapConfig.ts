// Knowledge Map Configuration
// Learning pulse animation with static knowledge space + article point

export const MAP_COLORS = {
  backgroundDot: "hsla(221, 83%, 53%, 0.12)",
  backgroundDotBright: "hsla(221, 83%, 53%, 0.2)",
  articlePoint: "hsl(142, 76%, 36%)",
  articleGlow: "hsla(142, 76%, 36%, 0.35)",
  trailDot: "hsla(142, 76%, 36%, 0.2)",
  labelText: "hsl(215, 16%, 47%)",
  provenanceGlow: "hsla(199, 89%, 48%, 0.45)",
};

export const MAP_TIMING = {
  driftSpeed: 0.08,
  pulseDuration: 900,
  highlightDuration: 1200,
};

export const MAP_SIZES = {
  backgroundDotMin: 1.2,
  backgroundDotMax: 2.4,
  articleRadius: 6,
  trailRadius: 3,
};

export type KnowledgeMapPhase =
  | "idle"
  | "generating"
  | "at_gate"
  | "approved"
  | "publishing_v1"
  | "publishing_v2"
  | "provenance_highlight";

export interface BackgroundDot {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

export interface ArticlePoint {
  x: number;
  y: number;
  version: number;
  pulseUntil: number | null;
}

export interface TrailDot {
  x: number;
  y: number;
  opacity: number;
}
