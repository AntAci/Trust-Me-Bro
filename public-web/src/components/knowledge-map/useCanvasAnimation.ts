import { useRef, useEffect, useCallback } from 'react';
import { Particle, Spark, MAP_TIMING, MAP_SIZES, KnowledgeMapPhase } from './mapConfig';

interface AnimationState {
  particles: Particle[];
  sparks: Spark[];
  phase: KnowledgeMapPhase;
  activeParticleId: string | null;
  gateFlashing: boolean;
  publishedVersion: number;
}

interface ClusterBounds {
  tickets: { cx: number; cy: number; radius: number };
  drafts: { cx: number; cy: number; radius: number };
  published: { cx: number; cy: number; radius: number };
}

export function useCanvasAnimation(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  state: AnimationState,
  updateParticles: (particles: Particle[]) => void,
  updateSparks: (sparks: Spark[]) => void
) {
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  
  const getClusterBounds = useCallback((width: number, height: number): ClusterBounds => ({
    tickets: { cx: width * 0.2, cy: height * 0.5, radius: MAP_SIZES.clusterRadius },
    drafts: { cx: width * 0.5, cy: height * 0.5, radius: MAP_SIZES.clusterRadius - 10 },
    published: { cx: width * 0.8, cy: height * 0.5, radius: MAP_SIZES.clusterRadius },
  }), []);
  
  const constrainToCluster = useCallback((
    particle: Particle,
    bounds: ClusterBounds
  ): Particle => {
    const cluster = bounds[particle.cluster];
    const dx = particle.x - cluster.cx;
    const dy = particle.y - cluster.cy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > cluster.radius) {
      const angle = Math.atan2(dy, dx);
      return {
        ...particle,
        x: cluster.cx + Math.cos(angle) * cluster.radius * 0.9,
        y: cluster.cy + Math.sin(angle) * cluster.radius * 0.9,
        vx: -particle.vx * 0.5,
        vy: -particle.vy * 0.5,
      };
    }
    return particle;
  }, []);
  
  const animate = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    const bounds = getClusterBounds(width, height);
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Update and draw particles
    const updatedParticles = state.particles.map(particle => {
      let p = { ...particle };
      
      // Handle transition animations
      if (p.targetX !== undefined && p.targetY !== undefined) {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 2) {
          const speed = 0.08; // Smooth easing
          p.x += dx * speed;
          p.y += dy * speed;
        } else {
          p.x = p.targetX;
          p.y = p.targetY;
          p.targetX = undefined;
          p.targetY = undefined;
        }
      } else {
        // Idle drift
        p.x += p.vx * MAP_TIMING.idleDriftSpeed;
        p.y += p.vy * MAP_TIMING.idleDriftSpeed;
        
        // Random velocity changes
        if (Math.random() < 0.01) {
          p.vx = (Math.random() - 0.5) * 0.5;
          p.vy = (Math.random() - 0.5) * 0.5;
        }
        
        // Constrain to cluster
        p = constrainToCluster(p, bounds);
      }
      
      return p;
    });
    
    // Update sparks
    const updatedSparks = state.sparks
      .map(spark => ({
        ...spark,
        progress: Math.min(1, spark.progress + 0.03),
        opacity: spark.progress > 0.7 ? (1 - spark.progress) * 3 : spark.opacity,
      }))
      .filter(spark => spark.progress < 1);
    
    // Draw cluster backgrounds
    Object.entries(bounds).forEach(([key, cluster]) => {
      ctx.beginPath();
      ctx.arc(cluster.cx, cluster.cy, cluster.radius + 10, 0, Math.PI * 2);
      ctx.fillStyle = 'hsla(221, 83%, 53%, 0.03)';
      ctx.fill();
    });
    
    // Draw cluster labels
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(215, 16%, 47%)';
    ctx.textAlign = 'center';
    ctx.fillText('TICKETS', bounds.tickets.cx, bounds.tickets.cy - bounds.tickets.radius - 15);
    ctx.fillText('DRAFTS', bounds.drafts.cx, bounds.drafts.cy - bounds.drafts.radius - 15);
    ctx.fillText('PUBLISHED KB', bounds.published.cx, bounds.published.cy - bounds.published.radius - 15);
    
    // Draw governance gate
    const gateX = width * 0.65;
    const gateTop = height * 0.25;
    const gateBottom = height * 0.75;
    
    ctx.beginPath();
    ctx.moveTo(gateX, gateTop);
    ctx.lineTo(gateX, gateBottom);
    ctx.strokeStyle = state.gateFlashing ? 'hsl(142, 76%, 36%)' : 'hsl(215, 16%, 70%)';
    ctx.lineWidth = state.gateFlashing ? 4 : 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw gate icon (shield)
    const shieldY = height * 0.5;
    ctx.beginPath();
    ctx.moveTo(gateX, shieldY - 12);
    ctx.lineTo(gateX + 8, shieldY - 6);
    ctx.lineTo(gateX + 8, shieldY + 4);
    ctx.quadraticCurveTo(gateX, shieldY + 12, gateX - 8, shieldY + 4);
    ctx.lineTo(gateX - 8, shieldY - 6);
    ctx.closePath();
    ctx.fillStyle = state.gateFlashing ? 'hsl(142, 76%, 36%)' : 'hsl(215, 16%, 80%)';
    ctx.fill();
    ctx.strokeStyle = state.gateFlashing ? 'hsl(142, 76%, 26%)' : 'hsl(215, 16%, 60%)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw sparks (evidence flowing)
    updatedSparks.forEach(spark => {
      const x = spark.x + (spark.targetX - spark.x) * spark.progress;
      const y = spark.y + (spark.targetY - spark.y) * spark.progress;
      
      ctx.beginPath();
      ctx.arc(x, y, MAP_SIZES.sparkSize, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(221, 83%, 53%, ${spark.opacity * 0.6})`;
      ctx.fill();
      
      // Trail
      ctx.beginPath();
      ctx.moveTo(x, y);
      const trailX = spark.x + (spark.targetX - spark.x) * (spark.progress - 0.1);
      const trailY = spark.y + (spark.targetY - spark.y) * (spark.progress - 0.1);
      ctx.lineTo(trailX, trailY);
      ctx.strokeStyle = `hsla(221, 83%, 53%, ${spark.opacity * 0.3})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    
    // Draw particles
    updatedParticles.forEach(particle => {
      const radius = particle.isActive 
        ? MAP_SIZES.activeParticleRadius 
        : particle.cluster === 'published' 
          ? MAP_SIZES.publishedRadius 
          : MAP_SIZES.particleRadius;
      
      // Halo rings for published particles
      if (particle.hasHalo && particle.cluster === 'published') {
        // Outer halo
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, radius + 8 + (particle.version > 1 ? 6 : 0), 0, Math.PI * 2);
        ctx.strokeStyle = 'hsla(142, 76%, 36%, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Version ring (v2+)
        if (particle.version > 1) {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, radius + 15, 0, Math.PI * 2);
          ctx.strokeStyle = 'hsla(142, 76%, 36%, 0.2)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        
        // Inner glow
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, radius,
          particle.x, particle.y, radius + 12
        );
        gradient.addColorStop(0, 'hsla(142, 76%, 36%, 0.4)');
        gradient.addColorStop(1, 'hsla(142, 76%, 36%, 0)');
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, radius + 12, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
      
      // Main particle
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
      
      let fillColor: string;
      switch (particle.cluster) {
        case 'tickets':
          fillColor = 'hsl(38, 92%, 50%)';
          break;
        case 'drafts':
          fillColor = 'hsl(221, 83%, 53%)';
          break;
        case 'published':
          fillColor = 'hsl(142, 76%, 36%)';
          break;
        default:
          fillColor = 'hsl(215, 16%, 50%)';
      }
      
      ctx.fillStyle = fillColor;
      ctx.fill();
      
      // Active particle highlight
      if (particle.isActive) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Version badge for published particles
      if (particle.cluster === 'published' && particle.version > 0) {
        ctx.font = 'bold 8px system-ui, sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`v${particle.version}`, particle.x, particle.y);
      }
    });
    
    // Update state if particles changed
    if (JSON.stringify(updatedParticles) !== JSON.stringify(state.particles)) {
      updateParticles(updatedParticles);
    }
    if (updatedSparks.length !== state.sparks.length) {
      updateSparks(updatedSparks);
    }
    
    // Continue animation loop
    animationRef.current = requestAnimationFrame(animate);
  }, [canvasRef, state, getClusterBounds, constrainToCluster, updateParticles, updateSparks]);
  
  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);
}
