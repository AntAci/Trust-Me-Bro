import { useRef, useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useKnowledgeMapState } from "./useKnowledgeMapState";
import { useCanvasAnimation } from "./useCanvasAnimation";
import { BackgroundDot } from "./mapConfig";

export function MiniKnowledgeMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { knowledgeMapState } = useDemoMode();

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: 180 });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    if (canvasRef.current && dimensions.width > 0) {
      const dpr = window.devicePixelRatio || 1;
      canvasRef.current.width = dimensions.width * dpr;
      canvasRef.current.height = dimensions.height * dpr;
      canvasRef.current.style.width = `${dimensions.width}px`;
      canvasRef.current.style.height = `${dimensions.height}px`;
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    }
  }, [dimensions]);

  const mapState = useKnowledgeMapState(dimensions.width, dimensions.height);

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
    <Card className="overflow-hidden border-primary/10">
      <CardContent className="p-0">
        <div ref={containerRef} className="relative w-full" style={{ height: 180 }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full pointer-events-none"
            style={{ display: "block" }}
          />
          <div className="absolute top-3 left-3 rounded-full bg-background/80 px-3 py-1 text-[10px] text-muted-foreground border">
            Knowledge map
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
