// Knowledge Map Configuration
// Colors, positions, timing constants for the Living Knowledge Map

export const MAP_COLORS = {
  tickets: {
    fill: 'hsl(38, 92%, 50%)',      // Amber/warning
    stroke: 'hsl(38, 92%, 40%)',
    glow: 'hsla(38, 92%, 50%, 0.3)',
  },
  drafts: {
    fill: 'hsl(221, 83%, 53%)',     // Primary blue
    stroke: 'hsl(221, 83%, 43%)',
    glow: 'hsla(221, 83%, 53%, 0.3)',
  },
  published: {
    fill: 'hsl(142, 76%, 36%)',     // Success green
    stroke: 'hsl(142, 76%, 26%)',
    glow: 'hsla(142, 76%, 36%, 0.4)',
    halo: 'hsla(142, 76%, 36%, 0.2)',
  },
  gate: {
    stroke: 'hsl(215, 16%, 47%)',   // Muted
    activeStroke: 'hsl(142, 76%, 36%)', // Green on approval
  },
  spark: {
    fill: 'hsla(221, 83%, 53%, 0.6)',
    trail: 'hsla(221, 83%, 53%, 0.2)',
  },
  background: 'transparent',
  labelText: 'hsl(215, 16%, 47%)',
};

export const MAP_TIMING = {
  idleDriftSpeed: 0.3,              // Pixels per frame
  idleDriftChangeInterval: 2000,    // ms before velocity change
  generateDuration: 800,            // ms for ticket→draft
  gatePauseDuration: 300,           // ms pause at gate
  publishV1Duration: 600,           // ms for draft→published
  publishV2Duration: 400,           // ms for v2 ring pulse
  haloExpandDuration: 500,          // ms for halo animation
  sparkDuration: 400,               // ms for evidence sparks
  sparkInterval: 100,               // ms between sparks
};

export const MAP_SIZES = {
  particleRadius: 6,
  activeParticleRadius: 8,
  publishedRadius: 10,
  haloRingWidth: 3,
  versionRingGap: 5,
  gateWidth: 3,
  gateHeight: 0.6,                  // Fraction of canvas height
  clusterRadius: 70,
  sparkSize: 3,
};

export const CLUSTER_LABELS = {
  tickets: 'TICKETS',
  drafts: 'DRAFTS',
  published: 'PUBLISHED KB',
};

export type KnowledgeMapPhase = 
  | 'idle'
  | 'generating'
  | 'at_gate'
  | 'approved'
  | 'publishing_v1'
  | 'publishing_v2';

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  cluster: 'tickets' | 'drafts' | 'published';
  isActive: boolean;
  version: number;
  hasHalo: boolean;
  targetX?: number;
  targetY?: number;
}

export interface Cluster {
  cx: number;
  cy: number;
  radius: number;
  label: string;
}

export interface Spark {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  opacity: number;
}
