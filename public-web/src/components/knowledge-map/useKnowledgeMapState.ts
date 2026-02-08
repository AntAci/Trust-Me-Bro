import { useState, useCallback, useRef, useEffect } from 'react';
import { KnowledgeMapPhase, Particle, Spark, MAP_TIMING } from './mapConfig';

interface KnowledgeMapState {
  phase: KnowledgeMapPhase;
  particles: Particle[];
  sparks: Spark[];
  activeParticleId: string | null;
  publishedVersion: number;
  gateFlashing: boolean;
}

const createInitialParticles = (width: number, height: number): Particle[] => {
  const particles: Particle[] = [];
  
  // Tickets cluster (left side)
  const ticketsCx = width * 0.2;
  const ticketsCy = height * 0.5;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
    const radius = 30 + Math.random() * 40;
    particles.push({
      id: `ticket-${i}`,
      x: ticketsCx + Math.cos(angle) * radius,
      y: ticketsCy + Math.sin(angle) * radius,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      cluster: 'tickets',
      isActive: false,
      version: 0,
      hasHalo: false,
    });
  }
  
  // Drafts cluster (center)
  const draftsCx = width * 0.5;
  const draftsCy = height * 0.5;
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.3;
    const radius = 20 + Math.random() * 30;
    particles.push({
      id: `draft-${i}`,
      x: draftsCx + Math.cos(angle) * radius,
      y: draftsCy + Math.sin(angle) * radius,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      cluster: 'drafts',
      isActive: false,
      version: 0,
      hasHalo: false,
    });
  }
  
  // Published cluster (right side)
  const publishedCx = width * 0.8;
  const publishedCy = height * 0.5;
  for (let i = 0; i < 2; i++) {
    const angle = (i / 2) * Math.PI * 2 + Math.random() * 0.3;
    const radius = 15 + Math.random() * 25;
    particles.push({
      id: `published-${i}`,
      x: publishedCx + Math.cos(angle) * radius,
      y: publishedCy + Math.sin(angle) * radius,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      cluster: 'published',
      isActive: false,
      version: 1,
      hasHalo: true,
    });
  }
  
  return particles;
};

export function useKnowledgeMapState(width: number, height: number) {
  const [state, setState] = useState<KnowledgeMapState>({
    phase: 'idle',
    particles: [],
    sparks: [],
    activeParticleId: null,
    publishedVersion: 0,
    gateFlashing: false,
  });
  
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize particles when dimensions are available
  useEffect(() => {
    if (width > 0 && height > 0 && state.particles.length === 0) {
      setState(prev => ({
        ...prev,
        particles: createInitialParticles(width, height),
      }));
    }
  }, [width, height, state.particles.length]);
  
  const setPhase = useCallback((phase: KnowledgeMapPhase) => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    
    setState(prev => {
      const newState = { ...prev, phase };
      
      switch (phase) {
        case 'generating': {
          // Select a random ticket to become active
          const ticketParticles = prev.particles.filter(p => p.cluster === 'tickets' && !p.isActive);
          if (ticketParticles.length > 0) {
            const selected = ticketParticles[Math.floor(Math.random() * ticketParticles.length)];
            newState.activeParticleId = selected.id;
            newState.particles = prev.particles.map(p => 
              p.id === selected.id 
                ? { ...p, isActive: true, targetX: width * 0.5, targetY: height * 0.5 }
                : p
            );
            // Generate evidence sparks
            newState.sparks = Array.from({ length: 5 }, (_, i) => ({
              x: selected.x + (Math.random() - 0.5) * 100,
              y: selected.y + (Math.random() - 0.5) * 100,
              targetX: width * 0.5,
              targetY: height * 0.5,
              progress: 0,
              opacity: 0.8,
            }));
          }
          break;
        }
        case 'at_gate': {
          // Move active particle to gate position
          const gateX = width * 0.65;
          newState.particles = prev.particles.map(p =>
            p.id === prev.activeParticleId
              ? { ...p, targetX: gateX, targetY: height * 0.5, cluster: 'drafts' as const }
              : p
          );
          break;
        }
        case 'approved': {
          newState.gateFlashing = true;
          transitionTimeoutRef.current = setTimeout(() => {
            setState(s => ({ ...s, gateFlashing: false }));
          }, 500);
          break;
        }
        case 'publishing_v1': {
          newState.publishedVersion = 1;
          newState.particles = prev.particles.map(p =>
            p.id === prev.activeParticleId
              ? { 
                  ...p, 
                  targetX: width * 0.8, 
                  targetY: height * 0.5, 
                  cluster: 'published' as const,
                  hasHalo: true,
                  version: 1,
                }
              : p
          );
          // Add more sparks for publish
          newState.sparks = Array.from({ length: 8 }, (_, i) => ({
            x: width * 0.5 + (Math.random() - 0.5) * 150,
            y: height * 0.3 + Math.random() * height * 0.4,
            targetX: width * 0.8,
            targetY: height * 0.5,
            progress: 0,
            opacity: 0.8,
          }));
          break;
        }
        case 'publishing_v2': {
          newState.publishedVersion = 2;
          newState.particles = prev.particles.map(p =>
            p.id === prev.activeParticleId
              ? { ...p, version: 2 }
              : p
          );
          break;
        }
        case 'idle': {
          // Reset active state but keep particles in place
          newState.activeParticleId = null;
          newState.sparks = [];
          newState.particles = prev.particles.map(p => ({ ...p, isActive: false }));
          break;
        }
      }
      
      return newState;
    });
  }, [width, height]);
  
  const resetMap = useCallback(() => {
    setState({
      phase: 'idle',
      particles: createInitialParticles(width, height),
      sparks: [],
      activeParticleId: null,
      publishedVersion: 0,
      gateFlashing: false,
    });
  }, [width, height]);

  const setParticles = useCallback((particles: Particle[]) => {
    setState(prev => ({ ...prev, particles }));
  }, []);

  const setSparks = useCallback((sparks: Spark[]) => {
    setState(prev => ({ ...prev, sparks }));
  }, []);
  
  return {
    ...state,
    setPhase,
    resetMap,
    setParticles,
    setSparks,
  };
}
