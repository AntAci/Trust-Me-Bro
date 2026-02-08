import { useState, useCallback, useRef, useEffect } from "react";
import {
  KnowledgeMapPhase,
  BackgroundDot,
  ArticlePoint,
  TrailDot,
  MAP_TIMING,
  MAP_SIZES,
} from "./mapConfig";

interface KnowledgeMapState {
  phase: KnowledgeMapPhase;
  dots: BackgroundDot[];
  articlePoint: ArticlePoint | null;
  trailDots: TrailDot[];
  publishedVersion: number;
  highlightUntil: number | null;
}

const createBackgroundDots = (width: number, height: number): BackgroundDot[] => {
  const count = Math.max(150, Math.floor((width * height) / 2500));
  return Array.from({ length: count }).map((_, index) => ({
    id: `dot-${index}`,
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * MAP_TIMING.driftSpeed,
    vy: (Math.random() - 0.5) * MAP_TIMING.driftSpeed,
    radius:
      MAP_SIZES.backgroundDotMin +
      Math.random() * (MAP_SIZES.backgroundDotMax - MAP_SIZES.backgroundDotMin),
    opacity: 0.35 + Math.random() * 0.4,
  }));
};

export function useKnowledgeMapState(width: number, height: number) {
  const [state, setState] = useState<KnowledgeMapState>({
    phase: "idle",
    dots: [],
    articlePoint: null,
    trailDots: [],
    publishedVersion: 0,
    highlightUntil: null,
  });

  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (width > 0 && height > 0 && state.dots.length === 0) {
      setState((prev) => ({
        ...prev,
        dots: createBackgroundDots(width, height),
      }));
    }
  }, [width, height, state.dots.length]);

  const setPhase = useCallback(
    (phase: KnowledgeMapPhase) => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      setState((prev) => {
        const newState: KnowledgeMapState = { ...prev, phase };
        const baseX = width * 0.65;
        const baseY = height * 0.45;

        if (phase === "publishing_v1") {
          newState.publishedVersion = 1;
          newState.articlePoint = {
            x: baseX,
            y: baseY,
            version: 1,
            pulseUntil: null,
          };
          newState.trailDots = [];
        }

        if (phase === "publishing_v2") {
          const nextVersion = Math.max(prev.publishedVersion + 1, 2);
          newState.publishedVersion = nextVersion;
          const prevPoint = prev.articlePoint || {
            x: baseX,
            y: baseY,
            version: 1,
            pulseUntil: null,
          };
          newState.trailDots = [];
          newState.articlePoint = {
            x: prevPoint.x,
            y: prevPoint.y,
            version: nextVersion,
            pulseUntil: null,
          };
        }

        if (phase === "provenance_highlight") {
          newState.highlightUntil = Date.now() + MAP_TIMING.highlightDuration;
        }

        if (phase === "idle") {
          newState.articlePoint = null;
          newState.trailDots = [];
          newState.publishedVersion = 0;
        }

        if (phase === "approved" && newState.articlePoint) {
          newState.articlePoint = {
            ...newState.articlePoint,
            pulseUntil: null,
          };
        }

        return newState;
      });
    },
    [width, height]
  );

  const resetMap = useCallback(() => {
    setState({
      phase: "idle",
      dots: createBackgroundDots(width, height),
      articlePoint: null,
      trailDots: [],
      publishedVersion: 0,
      highlightUntil: null,
    });
  }, [width, height]);

  const setDots = useCallback((dots: BackgroundDot[]) => {
    setState((prev) => ({ ...prev, dots }));
  }, []);

  const setArticlePoint = useCallback((articlePoint: ArticlePoint | null) => {
    setState((prev) => ({ ...prev, articlePoint }));
  }, []);

  const setTrailDots = useCallback((trailDots: TrailDot[]) => {
    setState((prev) => ({ ...prev, trailDots }));
  }, []);

  return {
    ...state,
    setPhase,
    resetMap,
    setDots,
    setArticlePoint,
    setTrailDots,
  };
}
