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
  const mapRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ isRegionVisited, onRegionVisitedClick, onBucketToggle });

  useEffect(() => {
    callbacksRef.current = { isRegionVisited, onRegionVisitedClick, onBucketToggle };
  });

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.innerHTML = svgContent;
    const el = mapRef.current;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const target = (e instanceof MouseEvent ? e.target : (e as TouchEvent).touches[0]?.target) as Element;
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

  return (
    <div className="map-wrap">
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
      >지도 조작</button>
    </div>
  );
}
