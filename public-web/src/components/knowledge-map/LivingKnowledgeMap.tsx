import { useRef, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useKnowledgeMapState } from './useKnowledgeMapState';
import { useCanvasAnimation } from './useCanvasAnimation';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { Particle, Spark } from './mapConfig';

export function LivingKnowledgeMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { knowledgeMapState } = useDemoMode();
  
  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: 280 });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  // Set canvas dimensions
  useEffect(() => {
    if (canvasRef.current && dimensions.width > 0) {
      const dpr = window.devicePixelRatio || 1;
      canvasRef.current.width = dimensions.width * dpr;
      canvasRef.current.height = dimensions.height * dpr;
      canvasRef.current.style.width = `${dimensions.width}px`;
      canvasRef.current.style.height = `${dimensions.height}px`;
      
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    }
  }, [dimensions]);
  
  const mapState = useKnowledgeMapState(dimensions.width, dimensions.height);
  
  // Sync with context phase
  useEffect(() => {
    if (knowledgeMapState.phase !== mapState.phase) {
      mapState.setPhase(knowledgeMapState.phase);
    }
  }, [knowledgeMapState.phase, mapState]);
  
  const updateParticles = useCallback(
    (particles: Particle[]) => {
      mapState.setParticles(particles);
    },
    [mapState]
  );
  
  const updateSparks = useCallback(
    (sparks: Spark[]) => {
      mapState.setSparks(sparks);
    },
    [mapState]
  );
  
  useCanvasAnimation(canvasRef, mapState, updateParticles, updateSparks);
  
  return (
    <Card className="overflow-hidden border-primary/10 tmb-hero">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Living Knowledge Map</CardTitle>
        <p className="text-sm text-muted-foreground">
          Watch tickets become governed, versioned knowledge — with traceability.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={containerRef} className="relative w-full" style={{ height: 280 }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full pointer-events-none"
            style={{ display: 'block' }}
          />
          
          {/* Legend */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 rounded-full bg-background/80 backdrop-blur-sm border text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-warning" />
              <span className="text-muted-foreground">Tickets</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              <span className="text-muted-foreground">Drafts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success" />
              <span className="text-muted-foreground">Published</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-success/40" />
              <span className="text-muted-foreground">Versions</span>
            </div>
          </div>
        </div>
        
        {/* Tagline */}
        <div className="px-6 py-3 border-t bg-muted/30">
          <p className="text-xs text-center text-muted-foreground italic">
            "We don't just generate articles — we govern them, version them, and prove every claim with traceability."
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
