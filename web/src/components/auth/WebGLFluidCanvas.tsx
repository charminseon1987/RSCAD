import { useEffect, useRef, useState } from 'react';
import { initFluid, FluidInstance } from '../../lib/webgl-fluid';
import { THEME_EVENT, fluidEnabled, getTheme } from '../../lib/theme';

interface WebGLFluidCanvasProps {
  className?: string;
}

export default function WebGLFluidCanvas({ className = '' }: WebGLFluidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fluidRef = useRef<FluidInstance | null>(null);
  const [webglSupported, setWebglSupported] = useState(true);
  const [live, setLive] = useState(() => fluidEnabled());

  /* 라이트 테마에서는 유체를 띄우지 않는다 (사용자 요청).
     CSS 로 숨기기만 하면 시뮬레이션이 뒤에서 계속 돌며 GPU 를 쓴다. */
  useEffect(() => {
    const onTheme = () => setLive(fluidEnabled(getTheme()));
    window.addEventListener(THEME_EVENT, onTheme);
    return () => window.removeEventListener(THEME_EVENT, onTheme);
  }, []);

  useEffect(() => {
    if (!live) return;
    if (!canvasRef.current) return;

    // Initialize fluid simulation with custom config for login page
    // 시작 배경색은 현재 테마를 따른다 — 예전에는 다크로 고정돼 있었다
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const fluid = initFluid(canvasRef.current, {
      BACK_COLOR: isLight ? { r: 242, g: 244, b: 250 } : { r: 7, g: 9, b: 18 },
      BLOOM: !isLight,      // 밝은 배경에서 빛번짐은 화면을 하얗게 만든다 (§7)
      SUNRAYS: !isLight,
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
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      fluidRef.current.splat(
        0.1 + Math.random() * 0.8,
        0.02,
        (Math.random() - 0.5) * 200,
        700 + Math.random() * 500
      );
    }, 3600);

    /* 상호작용 — docs/DESIGN_PROMPT.md §7
       Space = 무작위 폭발, 버튼·카드 hover 시 그 자리에서 작은 splat.
       reduced-motion 이면 둘 다 끈다. */
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const t = e.target as HTMLElement | null;
      // 입력 중이거나 버튼에 포커스가 있으면 Space 는 그쪽 몫이다
      if (t && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName)) return;
      if (t?.isContentEditable) return;
      e.preventDefault();
      fluidRef.current?.burst(6);
    };

    const onHover = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest('button, a, .card, .link-card, .glass-card');
      if (!el || !fluidRef.current) return;
      const r = el.getBoundingClientRect();
      const x = (r.left + r.width / 2) / window.innerWidth;
      const y = 1 - (r.top + r.height / 2) / window.innerHeight;   // y 는 아래→위
      fluidRef.current.splat(x, y, (Math.random() - 0.5) * 120, 180 + Math.random() * 140);
    };

    if (!reduced) {
      window.addEventListener('keydown', onKey);
      document.addEventListener('mouseover', onHover, { passive: true });
    }

    return () => {
      clearInterval(ambientInterval);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mouseover', onHover);
      if (fluidRef.current) {
        fluidRef.current.destroy();
        fluidRef.current = null;
      }
    };
  }, [live]);

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

  if (!live || !webglSupported) {
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
