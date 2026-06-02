'use client';
import { useRef, useEffect } from 'react';

interface KoreaMapProps {
  svgContent: string;
  mapControlActive: boolean;
  onToggleControl: () => void;
  visitedPathCount: number;
  totalPathCount: number;
  ddayVal: string;
  isRegionVisited: (rname: string) => boolean;
  onRegionVisitedClick: (rkey: string, rname: string) => void;
  onBucketToggle: (rkey: string, rname: string) => void;
  onDice: () => void;
}

export default function KoreaMap({
  svgContent, mapControlActive, onToggleControl,
  visitedPathCount, totalPathCount, ddayVal,
  isRegionVisited, onRegionVisitedClick, onBucketToggle, onDice,
}: KoreaMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ isRegionVisited, onRegionVisitedClick, onBucketToggle });
  const zoomRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const didMoveRef = useRef(false);

  useEffect(() => {
    callbacksRef.current = { isRegionVisited, onRegionVisitedClick, onBucketToggle };
  });

  // SVG 교체 + 클릭 핸들러
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.innerHTML = svgContent;
    const el = mapRef.current;

    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (didMoveRef.current) return; // 드래그 후 클릭 무시
      const target = (e instanceof MouseEvent ? e.target : (e as TouchEvent).changedTouches[0]?.target) as Element;
      const region = target?.closest('.map-region');
      if (!region) return;
      const rk = region.getAttribute('data-rkey') || '';
      const rname = region.getAttribute('data-name') || '';
      const { isRegionVisited, onRegionVisitedClick, onBucketToggle } = callbacksRef.current;
      if (isRegionVisited(rname)) {
        onRegionVisitedClick(rk, rname);
      } else {
        onBucketToggle(rk, rname);
      }
    };

    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [svgContent]);

  // 줌/팬 핸들러 (mapControlActive 전용)
  useEffect(() => {
    const container = wrapRef.current;
    const inner = mapRef.current;
    if (!container || !inner) return;

    const getSvg = () => inner.querySelector<SVGSVGElement>('svg');

    // 트랜스폼 초기화
    const z = zoomRef.current;
    z.scale = 1; z.tx = 0; z.ty = 0;
    const svgEl = getSvg();
    if (svgEl) svgEl.style.transform = '';

    if (!mapControlActive) {
      container.style.cursor = '';
      return;
    }

    container.style.cursor = 'grab';

    const applyTransform = () => {
      const svg = getSvg();
      if (!svg) return;
      svg.style.transformOrigin = 'center center';
      svg.style.transform = `translate(${z.tx}px, ${z.ty}px) scale(${z.scale})`;
    };

    // ── 터치: 핀치줌 + 1손가락 팬 ──
    let lastDist = 0;
    let isPinching = false;
    let panStartX = 0, panStartY = 0;

    const onTouchStart = (e: TouchEvent) => {
      didMoveRef.current = false;
      if (e.touches.length === 2) {
        isPinching = true;
        lastDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      } else if (e.touches.length === 1) {
        panStartX = e.touches[0].clientX - z.tx;
        panStartY = e.touches[0].clientY - z.ty;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      didMoveRef.current = true;
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        z.scale = Math.min(5, Math.max(1, z.scale * (dist / lastDist)));
        lastDist = dist;
      } else if (e.touches.length === 1 && !isPinching) {
        z.tx = e.touches[0].clientX - panStartX;
        z.ty = e.touches[0].clientY - panStartY;
      }
      applyTransform();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) isPinching = false;
      if (e.touches.length === 1) {
        panStartX = e.touches[0].clientX - z.tx;
        panStartY = e.touches[0].clientY - z.ty;
      }
    };

    // ── 마우스: 휠 줌 + 드래그 팬 ──
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      z.scale = Math.min(5, Math.max(1, z.scale - e.deltaY * 0.004));
      applyTransform();
    };

    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      didMoveRef.current = false;
      dragStartX = e.clientX - z.tx;
      dragStartY = e.clientY - z.ty;
      container.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      didMoveRef.current = true;
      z.tx = e.clientX - dragStartX;
      z.ty = e.clientY - dragStartY;
      applyTransform();
    };

    const onMouseUp = () => {
      isDragging = false;
      container.style.cursor = 'grab';
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      container.style.cursor = '';
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [mapControlActive]);

  return (
    <div ref={wrapRef} className="map-wrap">
      <div ref={mapRef} id="korea-map" />
      <div id="map-float-dash">
        <div className="map-float-label">전국 정복</div>
        <div><span>{visitedPathCount}</span>/<span>{totalPathCount}</span> 지역</div>
        {ddayVal && <div style={{ color: 'var(--text2)', fontSize: '11px', marginTop: '2px' }}>D+{ddayVal}</div>}
      </div>
      <button id="map-dice-btn" title="랜덤 추천" onClick={onDice}>🎲</button>
      <button
        id="map-control-toggle"
        className={mapControlActive ? 'active' : ''}
        onClick={onToggleControl}
      >{mapControlActive ? '조작 중 🔓' : '지도 조작'}</button>
    </div>
  );
}
