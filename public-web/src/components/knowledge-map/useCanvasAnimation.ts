import { useRef, useEffect, useCallback } from "react";
import {
  BackgroundDot,
  ArticlePoint,
  TrailDot,
  MAP_COLORS,
  MAP_SIZES,
} from "./mapConfig";

interface AnimationState {
  dots: BackgroundDot[];
  articlePoint: ArticlePoint | null;
  trailDots: TrailDot[];
  highlightUntil: number | null;
}

export function useCanvasAnimation(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  state: AnimationState,
  updateDots: (dots: BackgroundDot[]) => void
) {
  const animationRef = useRef<number | null>(null);

  const animate = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { width, height } = canvas;

      ctx.clearRect(0, 0, width, height);

      const updatedDots = state.dots.map((dot) => {
        let x = dot.x + dot.vx;
        let y = dot.y + dot.vy;

        if (x < 0) x = width;
        if (x > width) x = 0;
        if (y < 0) y = height;
        if (y > height) y = 0;

        return { ...dot, x, y };
      });

      updatedDots.forEach((dot) => {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = dot.opacity > 0.5 ? MAP_COLORS.backgroundDotBright : MAP_COLORS.backgroundDot;
        ctx.fill();
      });

      if (state.articlePoint) {
        const radius = MAP_SIZES.articleRadius;

        const gradient = ctx.createRadialGradient(
          state.articlePoint.x,
          state.articlePoint.y,
          radius,
          state.articlePoint.x,
          state.articlePoint.y,
          radius * 3
        );
        gradient.addColorStop(0, MAP_COLORS.articleGlow);
        gradient.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.arc(state.articlePoint.x, state.articlePoint.y, radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(state.articlePoint.x, state.articlePoint.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = MAP_COLORS.articlePoint;
        ctx.fill();

        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.fillStyle = MAP_COLORS.labelText;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(`v${state.articlePoint.version}`, state.articlePoint.x, state.articlePoint.y + 10);
      }

      if (state.highlightUntil && state.articlePoint && Date.now() < state.highlightUntil) {
        const highlightTargets = updatedDots.slice(0, 20);
        highlightTargets.forEach((dot) => {
          ctx.beginPath();
          ctx.moveTo(state.articlePoint!.x, state.articlePoint!.y);
          ctx.lineTo(dot.x, dot.y);
          ctx.strokeStyle = MAP_COLORS.provenanceGlow;
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      if (JSON.stringify(updatedDots) !== JSON.stringify(state.dots)) {
        updateDots(updatedDots);
      }

      animationRef.current = requestAnimationFrame(animate);
    },
    [canvasRef, state, updateDots]
  );

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);
}
