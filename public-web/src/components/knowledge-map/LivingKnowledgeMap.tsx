import { useRef, useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useKnowledgeMapState } from "./useKnowledgeMapState";
import { useCanvasAnimation } from "./useCanvasAnimation";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { BackgroundDot } from "./mapConfig";

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
  
  const updateDots = useCallback(
    (dots: BackgroundDot[]) => {
      mapState.setDots(dots);
    },
    [mapState]
  );

  useCanvasAnimation(canvasRef, mapState, updateDots);
  
  return (
    <Card className="overflow-hidden border-primary/10 tmb-hero">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Living Knowledge Map</CardTitle>
        <p className="text-sm text-muted-foreground">
          A read-only knowledge map that tracks published knowledge.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={containerRef} className="relative w-full" style={{ height: 280 }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full pointer-events-none"
            style={{ display: 'block' }}
          />
          
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full bg-background/80 backdrop-blur-sm border text-xs">
            <span className="text-muted-foreground">Read-only map • v1 → v2 updates</span>
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
