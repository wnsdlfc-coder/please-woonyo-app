'use client';
import { useMemo } from 'react';
import { heatColor, getRegionGroup, simplifyRegionName } from '@/lib/utils';
import { PREBUILT_MAP } from '@/lib/mapData';
import type { Place, Bucketlist, DateRequest } from './types';

const { W, H, paths, meshD, jejuPaths, jejuTX, jejuTY, ulData } = PREBUILT_MAP as unknown as {
  W: number; H: number;
  paths: { d: string; rk: string; n: string; cx: number; cy: number; ba: number }[];
  meshD?: string;
  jejuPaths?: { d: string; n: string; cx: number; cy: number; ba: number }[];
  jejuTX?: number; jejuTY?: number;
  ulData?: { d: string; rk: string; n: string };
};

const LABEL_MIN = 400;
const allSVGPaths = [...(paths || []), ...(jejuPaths || [])];

function normCity(s: string): string {
  s = (s || '').trim().split(' · ')[0].split('-')[0].trim();
  const m = s.match(/^(.+?시)[가-힣]+[구동]$/);
  if (m) return m[1].replace(/시$/, '');
  return s.replace(/특별자치도$|특별자치시$|광역시$|특별시$|시$|군$|구$/, '');
}

function cityMatchesPath(dateCity: string, pathName: string): boolean {
  if (!dateCity || !pathName) return false;
  const dc = normCity(dateCity), np = normCity(pathName);
  if (dc === np) return true;
  if (pathName.startsWith(dc) || np.startsWith(dc)) return true;
  return false;
}

function lbl(x: number, y: number, txt: string): string {
  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="6" font-weight="500" fill="rgba(0,0,0,0.45)" pointer-events="none" style="font-family:sans-serif;">${simplifyRegionName(txt)}</text>`;
}

export function useMapComputed(
  allPlaces: Place[],
  allBucketlist: Bucketlist[],
  allRequests: DateRequest[],
  allAnniversaries: { id: string; date: string }[],
  mapControlActive: boolean,
) {
  const { placeCounts, placeMatchedNames } = useMemo(() => {
    const placeCounts: Record<string, number> = {};
    const placeMatchedNames = new Set<string>();
    allPlaces.filter(p => p.category === 'visited').forEach(p => {
      const g = getRegionGroup(p.region || '기타');
      placeCounts[g] = (placeCounts[g] || 0) + 1;
      const sep = (p.region || '').includes(' · ') ? ' · ' : '-';
      const parts = (p.region || '').split(sep);
      if (parts.length >= 2) {
        const subCity = parts[1].trim();
        allSVGPaths.forEach(({ n }) => { if (cityMatchesPath(subCity, n)) placeMatchedNames.add(n); });
      }
    });
    return { placeCounts, placeMatchedNames };
  }, [allPlaces]);

  const dateMatchedNameCounts = useMemo(() => {
    const result: Record<string, number> = {};
    allRequests.filter(r => (r.status === '수락' || r.status === 'accepted') && r.region).forEach(r => {
      const sep = r.region.includes(' · ') ? ' · ' : '-';
      const parts = r.region.split(sep);
      const subTarget = parts.length >= 2 ? parts[1].trim() : '';
      const provTarget = parts[0].trim();
      const matched: string[] = [];
      allSVGPaths.forEach(({ n }) => {
        if (subTarget && cityMatchesPath(subTarget, n)) {
          result[n] = (result[n] || 0) + 1;
          matched.push(n);
        }
      });
      if (matched.length === 0) {
        allSVGPaths.forEach(({ n }) => {
          if (cityMatchesPath(provTarget, n)) result[n] = (result[n] || 0) + 1;
        });
      }
    });
    return result;
  }, [allRequests]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ...placeCounts };
    allRequests.filter(r => (r.status === '수락' || r.status === 'accepted') && r.region).forEach(r => {
      const g = getRegionGroup(r.region);
      c[g] = (c[g] || 0) + 1;
    });
    return c;
  }, [placeCounts, allRequests]);

  const visitedPathCount = useMemo(() =>
    allSVGPaths.filter(({ n }) => (dateMatchedNameCounts[n] || 0) > 0 || placeMatchedNames.has(n)).length,
    [dateMatchedNameCounts, placeMatchedNames]);

  const totalPathCount = allSVGPaths.length;
  const progressPct = totalPathCount > 0 ? Math.round(visitedPathCount / totalPathCount * 100) : 0;
  const visitedRegionCount = Object.keys(counts).filter(k => k !== '기타' && counts[k] > 0).length;

  const ddayVal = useMemo(() => {
    if (allAnniversaries.length === 0) return '';
    const sorted = [...allAnniversaries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const earliest = sorted[0];
    if (!earliest?.date) return '';
    const start = new Date(earliest.date);
    const todayD = new Date();
    start.setHours(0, 0, 0, 0); todayD.setHours(0, 0, 0, 0);
    const days = Math.floor((todayD.getTime() - start.getTime()) / 86400000) + 1;
    return days >= 1 ? String(days) : '';
  }, [allAnniversaries]);

  const svgContent = useMemo(() => {
    const pathFill = (rk: string, n: string): string => {
      const dateCnt = dateMatchedNameCounts[n] || 0;
      const isPlace = placeMatchedNames.has(n);
      const isVisited = dateCnt > 0 || isPlace;
      const isBucket = allBucketlist.some(b => (b.regionName ? b.regionName === n : getRegionGroup(b.region) === rk));
      if (isVisited) return heatColor(dateCnt + (isPlace ? 1 : 0));
      if (isBucket) return '#87CEEB';
      return '#E8E8E8';
    };

    const ulleung = paths.find(p => p.n === '울릉군');
    let pathsSvg = '';
    paths.forEach(({ d, rk, n }) => {
      if (n === '울릉군') return;
      pathsSvg += `<path d="${d}" fill="${pathFill(rk, n)}" stroke="#000000" stroke-width="0.35" class="map-region" data-rkey="${rk}" data-name="${n}"><title>${simplifyRegionName(n)}</title></path>`;
    });
    let labelsSvg = '';
    if (meshD) labelsSvg += `<path d="${meshD}" fill="none" stroke="#000000" stroke-width="0.45" pointer-events="none"/>`;
    paths.forEach(({ n, cx, cy, ba }) => {
      if (n === '울릉군') return;
      if (ba >= LABEL_MIN) labelsSvg += lbl(cx, cy, n);
    });
    let jejuSvg = '';
    if (jejuPaths && jejuPaths.length) {
      let jg = '';
      jejuPaths.forEach(({ d, n, cx, cy, ba }) => {
        jg += `<path d="${d}" fill="${pathFill('제주특별자치도', n)}" stroke="#000000" stroke-width="0.35" class="map-region" data-rkey="제주특별자치도" data-name="${n}"><title>${simplifyRegionName(n)}</title></path>`;
        if (ba >= LABEL_MIN) jg += lbl(cx, cy, n);
      });
      jejuSvg = `<g transform="translate(${jejuTX},${(jejuTY || 0) - 20})">${jg}</g>`;
    }
    let ulleungSvg = '';
    if (ulleung) {
      ulleungSvg = `<g transform="translate(-82,4)" class="map-region" data-rkey="${ulleung.rk}" data-name="${ulleung.n}"><path d="${ulleung.d}" fill="${pathFill(ulleung.rk, ulleung.n)}" stroke="#000000" stroke-width="0.5"/><title>${simplifyRegionName(ulleung.n)}</title></g>`;
    } else if (ulData) {
      ulleungSvg = `<g transform="translate(${Math.round(W * 0.78)},180)" class="map-region" data-rkey="${ulData.rk}" data-name="${ulData.n}"><path d="${ulData.d}" fill="${pathFill(ulData.rk, ulData.n)}" stroke="#000000" stroke-width="0.5"/><title>${simplifyRegionName(ulData.n)}</title></g>`;
    }
    const shadowFilter = `<filter id="mapShadow" x="-8%" y="-8%" width="116%" height="116%"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="rgba(80,120,180,0.25)"/></filter>`;
    // 상단 바다 여백 제거: y=130부터 표시 (H=721 → 가시 높이 591)
    const cropTop = 130;
    const vH = H - cropTop;
    return `<svg id="map-svg" viewBox="-25 ${cropTop} ${W + 25} ${vH}" xmlns="http://www.w3.org/2000/svg" width="100%" style="display:block;user-select:none;-webkit-user-select:none;" class="map-anim"><defs>${shadowFilter}</defs><rect x="-25" y="${cropTop}" width="${W + 50}" height="${vH + 10}" fill="#EBF5FB"/><g id="map-g" filter="url(#mapShadow)">${pathsSvg}${labelsSvg}${jejuSvg}${ulleungSvg}</g></svg>`;
  }, [dateMatchedNameCounts, placeMatchedNames, allBucketlist]);

  const isRegionVisited = (rname: string) =>
    (dateMatchedNameCounts[rname] || 0) > 0 || placeMatchedNames.has(rname);

  return {
    svgContent,
    isRegionVisited,
    counts,
    visitedPathCount,
    totalPathCount,
    progressPct,
    visitedRegionCount,
    ddayVal,
  };
}
