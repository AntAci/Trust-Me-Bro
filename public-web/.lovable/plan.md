

# Living Knowledge Map & Dashboard Upgrade

Transform the Dashboard into a "living" visualization that instantly communicates the self-updating, governed, and traceable nature of the knowledge engine.

---

## Overview

| Feature | Impact | Priority |
|---------|--------|----------|
| Living Knowledge Map Hero | Critical - First impression for judges | 1 |
| Dashboard Layout Reorder | High - Logical flow | 2 |
| Flow-to-Map Integration | High - Visible state changes | 3 |
| Provenance Non-Interactive | Medium - Cleaner UX | 4 |
| Motion Polish | Medium - Premium feel | 5 |

---

## Feature 1: Living Knowledge Map Hero

### Component Structure

Create a new canvas-based visualization component that shows three clusters of dots representing the knowledge lifecycle.

### New Files

```text
src/components/knowledge-map/LivingKnowledgeMap.tsx    - Main canvas component
src/components/knowledge-map/useKnowledgeMapState.ts   - State machine for animations
src/components/knowledge-map/mapConfig.ts              - Colors, positions, timing
```

### Visual Design

```text
+------------------------------------------------------------------+
|  Living Knowledge Map                                             |
|  "Watch tickets become governed, versioned knowledge — with       |
|   traceability."                                                  |
|                                                                   |
|   [TICKETS]          [DRAFTS]          [PUBLISHED KB]             |
|      🟠 🟠              🔵                  🟢 (halo)             |
|    🟠 🟠 🟠 🟠         🔵 🔵               🟢🟢 (rings)           |
|      🟠 🟠              🔵                  🟢                    |
|                                                                   |
|   ┌──────────────────────────────────────────────────────────┐   |
|   │  🟠 Amber = Tickets  🔵 Blue = Drafts  🟢 Green = Published  │
|   │  ○○ Halo rings = Versions                                   │
|   └──────────────────────────────────────────────────────────┘   |
|                                                                   |
|   "We don't just generate articles — we govern them, version     |
|    them, and prove every claim with traceability."               |
+------------------------------------------------------------------+
```

### Animation States & Behaviors

**Idle State (Always Running)**
- Dots gently drift within their cluster boundaries (Perlin-like smooth motion)
- Slow, subtle movement - enterprise feel, not chaotic
- Uses `requestAnimationFrame` for smooth 60fps rendering

**Generate Draft Transition**
- Selected ticket dot animates from Tickets cluster → Drafts cluster
- Path: Smooth bezier curve over 800ms
- Evidence sparks: Small particle streaks flow toward the moving dot
- On arrival: Dot settles into Drafts cluster

**Approve Transition**
- Draft dot pauses at a "Governance Gate" (vertical shield/line marker)
- Brief pause (300ms) then passes through
- Shield marker flashes green on approval

**Publish v1 Transition**
- Draft dot moves from Drafts → Published KB cluster
- On arrival: Green halo ring animates outward (radial expansion)
- Dot gains permanent glow

**Publish v2 Transition**
- Published dot gains additional outer ring
- "v2" version badge pulses in
- Ring expands with scale animation

**Traceability Hint**
- During Generate/Publish: faint particle streaks flow toward active dot
- Represents evidence flowing into the knowledge artifact
- Subtle, not distracting

### Implementation Approach

**Canvas-based rendering** (preferred for smoothness):
- Use HTML5 Canvas with React useRef
- requestAnimationFrame for animation loop
- No external dependencies required
- Full control over motion and effects

**State Machine**
```text
States:
  IDLE          - Default gentle drift
  GENERATING    - Ticket → Draft animation
  AT_GATE       - Draft paused at governance gate
  APPROVED      - Gate passes, moving to publish zone
  PUBLISHING_V1 - Draft → Published with halo
  PUBLISHING_V2 - Add version ring

Triggers (from context):
  - onTicketSelected(ticketId)
  - onDraftGenerated(draftId)
  - onDraftApproved()
  - onV1Published()
  - onV2Published()
```

### Non-Interactive Constraints

- No pan/zoom/click handlers on canvas
- Purely decorative + status-driven
- Read-only visualization
- Pointer events disabled on canvas element

---

## Feature 2: Dashboard Layout Reorder

### Current Layout
```text
1. Hero title + buttons
2. API status banner (if error)
3. Metric cards row
4. Feature cards
5. Demo Mode indicator
```

### New Layout
```text
1. Living Knowledge Map hero (full width, ~300px height)
2. Metric cards row (with count-up animation)
3. Start Demo / Auto Demo buttons (in a centered button group)
4. Feature cards
5. Demo Mode indicator (enhanced with "Runs without backend" text)
```

---

## Feature 3: Flow-to-Map Integration

### Shared State via Context

Extend `DemoModeContext` to include knowledge map state:

```typescript
interface KnowledgeMapState {
  phase: 'idle' | 'generating' | 'at_gate' | 'approved' | 'publishing_v1' | 'publishing_v2';
  activeTicketId: string | null;
  publishedVersion: number;
}

// Add to context:
knowledgeMapState: KnowledgeMapState;
setKnowledgeMapPhase: (phase: KnowledgeMapState['phase']) => void;
```

### Hook Flow Steps into Map Animations

In `/flow` step components, dispatch phase changes:

| Step Action | Map Phase Trigger |
|-------------|-------------------|
| Select ticket | (no change - ticket already in pool) |
| Generate draft | `setKnowledgeMapPhase('generating')` |
| Approve draft | `setKnowledgeMapPhase('approved')` |
| Publish v1 | `setKnowledgeMapPhase('publishing_v1')` |
| Publish v2 | `setKnowledgeMapPhase('publishing_v2')` |

### Dashboard Visibility

- Map updates even when user is on `/flow`
- If user returns to `/` during demo, they see current state
- Map state persists in context

---

## Feature 4: Provenance Graph Non-Interactive

### Current State
- React Flow with `nodesDraggable={false}`, `nodesConnectable={false}`
- Zoom/pan enabled
- Node clicks open drawer

### Updated Behavior

**Option A (Recommended): Keep zoom/pan, disable node clicks**
```typescript
// In Provenance.tsx ReactFlow props:
elementsSelectable={false}
nodesDraggable={false}
nodesConnectable={false}
edgesUpdatable={false}
panOnScroll={true}
zoomOnScroll={true}
// Node onClick removed - use dropdown instead
```

**Add Node Group Dropdown**
- Dropdown in header: "Select node group to inspect"
- Options: Ticket, Draft, Published KB, [each section]
- Selection opens drawer with details
- Cleaner than clicking tiny nodes

---

## Feature 5: Premium Motion Polish

### Metric Cards Count-Up on Load

Already have `AnimatedCounter` component - ensure it's used on Dashboard:

```typescript
<MetricCard
  value={<AnimatedCounter value={displayMetrics.tickets_count} />}
  ...
/>
```

### Status Badges Pulse on Change

Use existing `AnimatedBadge` component for version badges:
- Pulse triggers on value change
- Duration: 200ms scale 1 → 1.1 → 1

### Version Badge "v2" Pop-In

New animation for version change:
```css
.version-pop {
  animation: version-pop 300ms ease-out forwards;
}

@keyframes version-pop {
  0% { 
    opacity: 0; 
    transform: scale(0.5); 
  }
  70% { 
    transform: scale(1.15); 
  }
  100% { 
    opacity: 1; 
    transform: scale(1); 
  }
}
```

### Map Node Movement

- Slow, deliberate motion (not jittery)
- Bezier easing for transitions
- Drift speed: ~0.5-1px per frame at 60fps
- Transition speed: 800-1200ms for cluster changes

---

## Technical Implementation Details

### Canvas Rendering Loop

```typescript
// Pseudo-code for animation loop
const animate = (timestamp: number) => {
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Update particle positions (idle drift)
  particles.forEach(p => {
    p.x += p.vx * 0.5; // Slow drift
    p.y += p.vy * 0.5;
    // Boundary check - keep in cluster
    constrainToCluster(p);
  });
  
  // Handle active transitions
  if (state.phase === 'generating') {
    animateTicketToDraft(activeParticle);
  }
  
  // Draw particles
  drawClusters(ctx, particles);
  drawGovernanceGate(ctx);
  drawLegend(ctx);
  
  // Continue loop
  rafId = requestAnimationFrame(animate);
};
```

### Particle Data Structure

```typescript
interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number; // velocity for drift
  vy: number;
  cluster: 'tickets' | 'drafts' | 'published';
  isActive: boolean;
  version?: number;
  hasHalo?: boolean;
}
```

### Cluster Layout

```typescript
const clusters = {
  tickets: { cx: width * 0.2, cy: height * 0.5, radius: 80 },
  drafts: { cx: width * 0.5, cy: height * 0.5, radius: 60 },
  published: { cx: width * 0.8, cy: height * 0.5, radius: 70 },
};

const governanceGate = {
  x: width * 0.65, // Between drafts and published
  y1: height * 0.2,
  y2: height * 0.8,
};
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/knowledge-map/LivingKnowledgeMap.tsx` | Main canvas component |
| `src/components/knowledge-map/useKnowledgeMapState.ts` | Animation state machine |
| `src/components/knowledge-map/mapConfig.ts` | Colors, positions, timing constants |
| `src/components/knowledge-map/useCanvasAnimation.ts` | requestAnimationFrame hook |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Add map hero, reorder layout, use AnimatedCounter |
| `src/contexts/DemoModeContext.tsx` | Add knowledge map state |
| `src/components/flow/StepGenerateDraft.tsx` | Dispatch map phase change |
| `src/components/flow/StepReview.tsx` | Dispatch map phase change |
| `src/components/flow/StepPublish.tsx` | Dispatch map phase change |
| `src/components/flow/StepUpdate.tsx` | Dispatch map phase change |
| `src/pages/Provenance.tsx` | Add node group dropdown, disable node clicks |
| `src/index.css` | Add version-pop animation |

---

## Demo Script Copy

Add this text below the Living Knowledge Map:

> "We don't just generate articles — we govern them, version them, and prove every claim with traceability."

---

## Acceptance Criteria

- [ ] Living Knowledge Map renders with 3 visible clusters
- [ ] Idle drift animation runs continuously (smooth, not jittery)
- [ ] Generate Draft triggers ticket → draft dot movement
- [ ] Approve shows governance gate pass animation
- [ ] Publish v1 adds green halo to dot
- [ ] Publish v2 adds version ring with pulse
- [ ] Evidence sparks appear during transitions
- [ ] Dashboard layout follows new order
- [ ] Legend visible: Amber=Tickets, Blue=Drafts, Green=Published, Rings=Versions
- [ ] Metric cards use AnimatedCounter
- [ ] Provenance graph is fully non-interactive (except optional dropdown)
- [ ] Works in Demo Mode without backend

---

## Implementation Order

1. **Create canvas infrastructure** - LivingKnowledgeMap shell with idle animation
2. **Add to Dashboard** - Place hero, reorder layout
3. **Implement state machine** - Phase transitions and context
4. **Add transition animations** - Generate, Approve, Publish v1, Publish v2
5. **Hook flow steps** - Dispatch phase changes from step components
6. **Add polish** - Evidence sparks, governance gate, version rings
7. **Update Provenance** - Dropdown selector, disable clicks
8. **Motion polish** - AnimatedCounter on metrics, version-pop CSS

