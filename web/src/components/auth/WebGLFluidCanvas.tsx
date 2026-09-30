import { useEffect, useRef, useState } from 'react';
import { initFluid, FluidInstance } from '../../lib/webgl-fluid';

interface WebGLFluidCanvasProps {
  className?: string;
}

export default function WebGLFluidCanvas({ className = '' }: WebGLFluidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fluidRef = useRef<FluidInstance | null>(null);
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize fluid simulation with custom config for login page
    const fluid = initFluid(canvasRef.current, {
      BACK_COLOR: { r: 7, g: 9, b: 18 }, // #070912
      DENSITY_DISSIPATION: 2.2,
      BLOOM_INTENSITY: 0.25,
      BLOOM_THRESHOLD: 0.75,
      SUNRAYS_WEIGHT: 0.45,
    });

    if (!fluid) {
      setWebglSupported(false);
      return;
    }

    fluidRef.current = fluid;

    // Create ambient flow from bottom
    const ambientInterval = setInterval(() => {
      if (document.hidden || !fluidRef.current) return;
      fluidRef.current.splat(
        0.1 + Math.random() * 0.8,
        0.02,
        (Math.random() - 0.5) * 200,
        700 + Math.random() * 500
      );
    }, 3600);

    return () => {
      clearInterval(ambientInterval);
      if (fluidRef.current) {
        fluidRef.current.destroy();
        fluidRef.current = null;
      }
    };
  }, []);

  // Expose fluid instance for external puff effects
  useEffect(() => {
    if (typeof window !== 'undefined' && fluidRef.current) {
      (window as unknown as { fluid?: FluidInstance }).fluid = fluidRef.current;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as unknown as { fluid?: FluidInstance }).fluid;
      }
    };
  }, []);

  if (!webglSupported) {
    return (
      <div
        className={`login-fallback ${className}`}
        style={{ display: 'block' }}
        aria-hidden="true"
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`login-fluid-canvas ${className}`}
      aria-hidden="true"
    />
  );
}
