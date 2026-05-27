'use client';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, deleteDoc, doc, serverTimestamp, updateDoc
} from 'firebase/firestore';
import { heatColor, getRegionGroup, simplifyRegionName, REGIONS } from '@/lib/utils';
import { PREBUILT_MAP } from '@/lib/mapData';

interface Place {
  id: string;
  name: string;
  region: string;
  memo?: string;
  category: 'visited' | 'wanna';
  coupleCode: string;
}

interface Bucketlist {
  id: string;
  roomId: string;
  region: string;
  regionName?: string;
  createdBy?: string;
  createdAt?: { toDate?: () => Date; seconds?: number };
  memo?: string;
}

interface Request {
  id: string;
  date: string;
  time: string;
  theme: string;
  region: string;
  subLocation?: string;
  status: string;
}

interface Diary {
  id: string;
  reqId?: string;
  date: string;
  title: string;
  star?: number;
  region?: string;
}

interface MapPageProps {
  currentNick: string;
  currentCoupleCode: string;
  allPlaces: Place[];
  allBucketlist: Bucketlist[];
  allRequests: Request[];
  allAnniversaries: { id: string; date: string }[];
  allDiaries: Diary[];
  showToast: (msg: string, isErr?: boolean) => void;
  showConfirm: (msg: string, onOk: () => void) => void;
}

type PlaceTab = 'visited' | 'wanna' | 'stats';

const { W, H, paths, meshD, jejuPaths, jejuTX, jejuTY, ulData } = PREBUILT_MAP as unknown as {
  W: number; H: number;
  paths: { d: string; rk: string; n: string; cx: number; cy: number; ba: number }[];
  meshD?: string;
  jejuPaths?: { d: string; n: string; cx: number; cy: number; ba: number }[];
  jejuTX?: number; jejuTY?: number;
  ulData?: { d: string; rk: string; n: string };
};

export default function MapPage({
  currentNick, currentCoupleCode, allPlaces, allBucketlist,
  allRequests, allAnniversaries, allDiaries, showToast, showConfirm
}: MapPageProps) {
  const [placeTab, setPlaceTab] = useState<PlaceTab>('visited');
  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [regionModalTitle, setRegionModalTitle] = useState('');
  const [regionModalRkey, setRegionModalRkey] = useState('');
  const [mapControlActive, setMapControlActive] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  // Place form
  const [placeName, setPlaceName] = useState('');
  const [placeRegion, setPlaceRegion] = useState('');
  const [placeCat, setPlaceCat] = useState<'visited' | 'wanna'>('visited');
  const [placeMemo, setPlaceMemo] = useState('');
  const [placeRegionOpen, setPlaceRegionOpen] = useState(false);

  // Bucket selection state
  const [selectedBuckets, setSelectedBuckets] = useState<Set<string>>(new Set());

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

  const allSVGPaths = [...(paths || []), ...(jejuPaths || [])];

  // Compute counts
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

  const dateMatchedNameCounts: Record<string, number> = {};
  allRequests.filter(r => (r.status === '수락' || r.status === 'accepted') && r.region).forEach(r => {
    const sep = r.region.includes(' · ') ? ' · ' : '-';
    const parts = r.region.split(sep);
    const subTarget = parts.length >= 2 ? parts[1].trim() : '';
    const provTarget = parts[0].trim();
    const matched: string[] = [];
    allSVGPaths.forEach(({ n }) => {
      if (subTarget && cityMatchesPath(subTarget, n)) {
        dateMatchedNameCounts[n] = (dateMatchedNameCounts[n] || 0) + 1;
        matched.push(n);
      }
    });
    if (matched.length === 0) {
      allSVGPaths.forEach(({ n }) => {
        if (cityMatchesPath(provTarget, n)) {
          dateMatchedNameCounts[n] = (dateMatchedNameCounts[n] || 0) + 1;
        }
      });
    }
  });

  const counts: Record<string, number> = { ...placeCounts };
  allRequests.filter(r => (r.status === '수락' || r.status === 'accepted') && r.region).forEach(r => {
    const g = getRegionGroup(r.region);
    counts[g] = (counts[g] || 0) + 1;
  });

  const visitedPathCount = allSVGPaths.filter(({ n }) => (dateMatchedNameCounts[n] || 0) > 0 || placeMatchedNames.has(n)).length;
  const totalPathCount = allSVGPaths.length;
  const progressPct = totalPathCount > 0 ? Math.round(visitedPathCount / totalPathCount * 100) : 0;
  const visitedRegionCount = Object.keys(counts).filter(k => k !== '기타' && counts[k] > 0).length;

  // D+N from earliest anniversary
  let ddayVal = '';
  if (allAnniversaries.length > 0) {
    const sorted = [...allAnniversaries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const earliest = sorted[0];
    if (earliest?.date) {
      const start = new Date(earliest.date);
      const todayD = new Date();
      start.setHours(0, 0, 0, 0); todayD.setHours(0, 0, 0, 0);
      const days = Math.floor((todayD.getTime() - start.getTime()) / 86400000) + 1;
      if (days >= 1) ddayVal = String(days);
    }
  }

  function pathFill(rk: string, n: string): string {
    const dateCnt = dateMatchedNameCounts[n] || 0;
    const isPlace = placeMatchedNames.has(n);
    const isVisited = dateCnt > 0 || isPlace;
    const isBucket = allBucketlist.some(b => (b.regionName ? b.regionName === n : getRegionGroup(b.region) === rk));
    if (isVisited && isBucket) {
      const visitColor = heatColor(dateCnt + (isPlace ? 1 : 0));
      return visitColor; // simplified: no gradient for static SVG
    }
    if (isVisited) return heatColor(dateCnt + (isPlace ? 1 : 0));
    if (isBucket) return '#87CEEB';
    return '#E8E8E8';
  }

  const LABEL_MIN = 400;
  const lbl = (x: number, y: number, txt: string) =>
    `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="6" font-weight="500" fill="rgba(0,0,0,0.45)" pointer-events="none" style="font-family:sans-serif;">${simplifyRegionName(txt)}</text>`;

  const buildSVG = (): string => {
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
      jejuSvg = `<g transform="translate(${jejuTX},${(jejuTY || 0) + 20})">${jg}</g>`;
    }
    let ulleungSvg = '';
    if (ulleung) {
      ulleungSvg = `<g transform="translate(-82,4)" class="map-region" data-rkey="${ulleung.rk}" data-name="${ulleung.n}"><path d="${ulleung.d}" fill="${pathFill(ulleung.rk, ulleung.n)}" stroke="#000000" stroke-width="0.5"/><title>${simplifyRegionName(ulleung.n)}</title></g>`;
    } else if (ulData) {
      ulleungSvg = `<g transform="translate(${Math.round(W * 0.78)},180)" class="map-region" data-rkey="${ulData.rk}" data-name="${ulData.n}"><path d="${ulData.d}" fill="${pathFill(ulData.rk, ulData.n)}" stroke="#000000" stroke-width="0.5"/><title>${simplifyRegionName(ulData.n)}</title></g>`;
    }
    const shadowFilter = `<filter id="mapShadow" x="-8%" y="-8%" width="116%" height="116%"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="rgba(80,120,180,0.25)"/></filter>`;
    const ptrEvt = mapControlActive ? 'all' : 'none';
    const tAct = mapControlActive ? 'none' : 'auto';
    return `<svg id="map-svg" viewBox="-25 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%" style="display:block;pointer-events:${ptrEvt};touch-action:${tAct};user-select:none;-webkit-user-select:none;" class="map-anim"><defs>${shadowFilter}</defs><rect width="${W}" height="${H}" fill="#EBF5FB"/><g id="map-g" filter="url(#mapShadow)">${pathsSvg}${labelsSvg}${jejuSvg}${ulleungSvg}</g></svg>`;
  };

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.innerHTML = buildSVG();

    const el = mapRef.current;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const target = (e instanceof MouseEvent ? e.target : (e as TouchEvent).touches[0]?.target) as Element;
      const region = target?.closest('.map-region');
      if (!region) return;
      const rk = region.getAttribute('data-rkey') || '';
      const rname = region.getAttribute('data-name') || '';
      const isVisited = (dateMatchedNameCounts[rname] || 0) > 0 || placeMatchedNames.has(rname);
      if (isVisited) {
        setRegionModalRkey(rk);
        setRegionModalTitle(simplifyRegionName(rname) + (counts[rk] ? ` (${counts[rk]}회)` : ''));
        setShowRegionModal(true);
      } else {
        handleToggleBucket(rk, rname);
      }
    };
    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPlaces, allBucketlist, allRequests, mapControlActive]);

  const handleToggleBucket = async (rkey: string, rname: string) => {
    const existing = allBucketlist.find(b =>
      (b.regionName ? b.regionName === rname : getRegionGroup(b.region) === rkey)
    );
    if (existing) {
      await deleteDoc(doc(db, 'bucketlist', existing.id));
      showToast('버킷리스트에서 제거했어요');
    } else {
      await addDoc(collection(db, 'bucketlist'), {
        roomId: currentCoupleCode, region: rkey, regionName: rname || rkey,
        createdBy: currentNick, createdAt: serverTimestamp()
      });
      showToast('버킷리스트에 추가했어요 💗');
    }
  };

  const handleSavePlace = async () => {
    if (!placeName.trim() || !placeRegion) { showToast('지역과 장소명을 입력해주세요', true); return; }
    await addDoc(collection(db, 'places'), {
      name: placeName.trim(), region: placeRegion, memo: placeMemo,
      category: placeCat, coupleCode: currentCoupleCode, createdAt: serverTimestamp()
    });
    setShowPlaceModal(false);
    setPlaceName(''); setPlaceMemo(''); setPlaceRegion('');
    showToast('장소가 저장됐어요! 📍');
  };

  const handleDeletePlace = (id: string) => {
    showConfirm('장소를 삭제할까요?', async () => {
      await deleteDoc(doc(db, 'places', id));
      showToast('삭제됐어요');
    });
  };

  const handleDeleteBucket = (id: string) => {
    showConfirm('버킷리스트에서 삭제할까요?', async () => {
      await deleteDoc(doc(db, 'bucketlist', id));
      showToast('삭제됐어요');
    });
  };

  const handlePoke = async (regionName: string) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        roomId: currentCoupleCode, type: 'poke', from: currentNick, regionName,
        createdAt: serverTimestamp()
      });
      showToast('콕 찔렀어요 ❤️');
    } catch {
      showToast('전송 실패', true);
    }
  };

  const handleDice = () => {
    if (allBucketlist.length === 0) { showToast('가고싶은 곳을 먼저 추가해줘요! 💙'); return; }
    const pick = allBucketlist[Math.floor(Math.random() * allBucketlist.length)];
    const name = pick.regionName || pick.region;
    // Show a simple overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:800;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div style="background:white;border-radius:20px;padding:28px 32px;text-align:center;max-width:280px;width:88%;animation:slideUp 0.3s ease;"><div style="font-size:52px;margin-bottom:12px;">🎲</div><div style="font-size:12px;color:var(--text3);margin-bottom:8px;font-weight:600;">오늘의 추천 버킷리스트</div><div style="font-size:22px;font-weight:800;color:var(--rose);margin-bottom:22px;">${name}</div><button id="dice-close-btn" style="padding:10px 28px;background:var(--rose);color:white;border:none;border-radius:20px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">확인</button></div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#dice-close-btn')?.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  };

  // Stats
  const renderStats = () => {
    const accepted = allRequests.filter(r => r.status === '수락' || r.status === 'accepted');
    const regionCounts: Record<string, number> = {};
    accepted.forEach(r => {
      if (r.region) {
        const g = getRegionGroup(r.region);
        regionCounts[g] = (regionCounts[g] || 0) + 1;
      }
    });
    allPlaces.filter(p => p.category === 'visited').forEach(p => {
      const g = getRegionGroup(p.region || '기타');
      regionCounts[g] = (regionCounts[g] || 0) + 1;
    });
    const visitedRegions = Object.keys(regionCounts).filter(k => k !== '기타' && regionCounts[k] > 0);
    const sorted = Object.entries(regionCounts).filter(([k]) => k !== '기타').sort((a, b) => b[1] - a[1]).slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];

    const now = new Date();
    const months: { y: number; m: number; cnt: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth() + 1, cnt: 0 });
    }
    accepted.forEach(r => {
      if (!r.date) return;
      const [ry, rm] = r.date.split('-').map(Number);
      const slot = months.find(s => s.y === ry && s.m === rm);
      if (slot) slot.cnt++;
    });
    const maxCnt = Math.max(...months.map(s => s.cnt), 1);

    return (
      <div style={{ display: 'block' }}>
        <div className="stats-num-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="stats-num-card">
            <div className="stats-num-val">{accepted.length}</div>
            <div className="stats-num-lbl">총 데이트</div>
          </div>
          <div className="stats-num-card" style={{ background: 'var(--yellow2)' }}>
            <div className="stats-num-val" style={{ color: '#E0A800' }}>{visitedRegions.length}</div>
            <div className="stats-num-lbl">방문 지역</div>
          </div>
          <div className="stats-num-card" style={{ background: '#FFF8E1' }}>
            <div className="stats-num-val" style={{ color: '#E0A800' }}>{allBucketlist.length}</div>
            <div className="stats-num-lbl">버킷리스트</div>
          </div>
        </div>
        <div className="section-label" style={{ marginTop: 0 }}>TOP 3 지역</div>
        <div className="stats-top3">
          {sorted.length ? sorted.map(([k, v], i) => (
            <div key={k} className="stats-top3-tag">{medals[i]} {k} <span style={{ fontSize: '11px', opacity: 0.85 }}>{v}회</span></div>
          )) : <div style={{ color: 'var(--text3)', fontSize: '13px' }}>아직 데이트 기록이 없어요</div>}
        </div>
        <div className="section-label">월별 데이트</div>
        <div style={{ marginBottom: '8px' }}>
          {months.map(s => (
            <div key={s.y + '-' + s.m} className="stats-bar-row">
              <div className="stats-bar-label">{s.m}월</div>
              <div className="stats-bar-track"><div className="stats-bar-fill" style={{ width: Math.round((s.cnt / maxCnt) * 100) + '%' }} /></div>
              <div className="stats-bar-cnt">{s.cnt}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const regionVisitedDates = allRequests.filter(r =>
    (r.status === '수락' || r.status === 'accepted') && r.region && getRegionGroup(r.region) === regionModalRkey
  ).sort((a, b) => b.date.localeCompare(a.date));

  // Bucket memo update
  const handleBucketMemoBlur = async (id: string, memo: string) => {
    try { await updateDoc(doc(db, 'bucketlist', id), { memo }); } catch { /* ignore */ }
  };

  const [bucketMemos, setBucketMemos] = useState<Record<string, string>>({});
  useEffect(() => {
    const m: Record<string, string> = {};
    allBucketlist.forEach(b => { m[b.id] = b.memo || ''; });
    setBucketMemos(m);
  }, [allBucketlist]);

  return (
    <div id="page-map" className="page active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="page-title" style={{ margin: 0 }}>우리의 장소 🗺️</div>
        <button className="btn btn-rose btn-sm" onClick={() => setShowPlaceModal(true)}>추가</button>
      </div>

      {/* 진행률 바 */}
      <div id="map-progress-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text2)' }}>전국 정복률</span>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--rose)' }}>{progressPct}%</span>
        </div>
        <div style={{ height: '7px', background: '#FFE4EC', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg,#FF8FB1,#E8456A)', borderRadius: '99px', width: progressPct + '%', transition: 'width 0.7s ease' }} />
        </div>
      </div>

      {/* 통계 뱃지 */}
      <div style={{ display: 'flex', gap: '8px', margin: '10px 0', flexWrap: 'wrap' }}>
        <div style={{ background: 'linear-gradient(135deg,#FFE4EC,#FFF0F5)', borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, color: '#E85B8A', display: 'flex', alignItems: 'center', gap: '5px' }}>
          📍 다녀온 곳 <span>{visitedRegionCount}</span>곳
        </div>
        <div style={{ background: 'linear-gradient(135deg,#E3F4FF,#EBF5FB)', borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, color: '#4A90D9', display: 'flex', alignItems: 'center', gap: '5px' }}>
          💙 가고싶은 곳 <span>{allBucketlist.length}</span>곳
        </div>
      </div>

      {/* 지도 */}
      <div className="map-wrap">
        <div ref={mapRef} id="korea-map" />
        <div id="map-float-dash">
          <div className="map-float-label">전국 정복</div>
          <div><span>{visitedPathCount}</span>/<span>{totalPathCount}</span> 지역</div>
          {ddayVal && <div style={{ color: 'var(--text2)', fontSize: '11px', marginTop: '2px' }}>D+{ddayVal}</div>}
        </div>
        <button id="map-dice-btn" title="랜덤 추천" onClick={handleDice}>🎲</button>
        <button
          id="map-control-toggle"
          className={mapControlActive ? 'active' : ''}
          onClick={() => setMapControlActive(v => !v)}
        >지도 조작</button>
      </div>

      {/* 범례 */}
      <div className="map-legend-wrap">
        <div className="map-legend-item"><div className="map-legend-dot" style={{ background: '#E8E8E8', border: '1px solid #ccc' }} />0회</div>
        <div className="map-legend-item"><div className="map-legend-dot" style={{ background: '#FFD6E7' }} />1-2</div>
        <div className="map-legend-item"><div className="map-legend-dot" style={{ background: '#FF8FB1' }} />3-5</div>
        <div className="map-legend-item"><div className="map-legend-dot" style={{ background: '#FF6B9D' }} />6-8</div>
        <div className="map-legend-item"><div className="map-legend-dot" style={{ background: '#E8456A' }} />9-10+</div>
        <div className="map-legend-item"><div className="map-legend-dot" style={{ background: '#87CEEB', border: '1px solid #64B5E8' }} />가고싶은</div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        <button className={'tab-btn' + (placeTab === 'visited' ? ' active' : '')} onClick={() => setPlaceTab('visited')}>다녀온 곳</button>
        <button className={'tab-btn' + (placeTab === 'wanna' ? ' active' : '')} onClick={() => setPlaceTab('wanna')}>가고싶은 곳</button>
        <button className={'tab-btn' + (placeTab === 'stats' ? ' active' : '')} onClick={() => setPlaceTab('stats')}>통계</button>
      </div>

      {/* 탭 컨텐츠 */}
      {placeTab === 'visited' && (
        <div>
          {allPlaces.filter(p => p.category === 'visited').map(p => (
            <div key={p.id} className="place-item">
              <div className="place-dot" />
              <div style={{ flex: 1 }}>
                <div className="place-name-big">{p.name}</div>
                <div className="place-region-lbl">{p.region}{p.memo ? ' · ' + p.memo : ''}</div>
              </div>
              <button className="btn btn-outline btn-xs" onClick={() => handleDeletePlace(p.id)}>삭제</button>
            </div>
          ))}
          {allRequests.filter(r => (r.status === '수락' || r.status === 'accepted') && r.region)
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(r => (
              <div key={r.id} className="visited-date-item">
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--rose)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="place-name-big">{r.region}</div>
                  <div className="place-region-lbl">{r.date} · {r.theme}</div>
                </div>
              </div>
            ))}
          {allPlaces.filter(p => p.category === 'visited').length === 0 && allRequests.filter(r => r.status === '수락' && r.region).length === 0 && (
            <div className="empty-state">가본 곳 기록이 없어요</div>
          )}
        </div>
      )}

      {placeTab === 'wanna' && (
        <div>
          {allPlaces.filter(p => p.category === 'wanna').map(p => (
            <div key={p.id} className="place-item">
              <div className="place-dot" style={{ background: 'var(--yellow)' }} />
              <div style={{ flex: 1 }}>
                <div className="place-name-big">{p.name}</div>
                <div className="place-region-lbl">{p.region}{p.memo ? ' · ' + p.memo : ''}</div>
              </div>
              <button className="btn btn-outline btn-xs" onClick={() => handleDeletePlace(p.id)}>삭제</button>
            </div>
          ))}
          {allBucketlist.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
              <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: 'var(--text3)' }}>버킷리스트 {allBucketlist.length}개</span>
              <button className="btn btn-outline btn-xs" onClick={() => {
                setSelectedBuckets(prev => prev.size === allBucketlist.length ? new Set() : new Set(allBucketlist.map(b => b.id)));
              }}>전체 선택</button>
              {selectedBuckets.size > 0 && (
                <button className="btn btn-outline btn-xs" onClick={() => {
                  showConfirm('선택한 항목을 삭제할까요?', async () => {
                    await Promise.all([...selectedBuckets].map(id => deleteDoc(doc(db, 'bucketlist', id))));
                    setSelectedBuckets(new Set());
                    showToast('삭제됐어요');
                  });
                }}>선택 삭제</button>
              )}
              <button className="btn btn-outline btn-xs" style={{ color: 'var(--rose)' }} onClick={() => {
                showConfirm('버킷리스트를 전체 삭제할까요?', async () => {
                  await Promise.all(allBucketlist.map(b => deleteDoc(doc(db, 'bucketlist', b.id))));
                  showToast('전체 삭제됐어요');
                });
              }}>전체 삭제</button>
            </div>
          )}
          {allBucketlist.map(b => {
            const name = b.regionName || b.region;
            const dateStr = b.createdAt
              ? (() => { const d = b.createdAt!.toDate ? b.createdAt!.toDate!() : new Date((b.createdAt!.seconds || 0) * 1000); return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'); })()
              : '';
            const meta = [b.createdBy, dateStr].filter(Boolean).join(' · ');
            return (
              <div key={b.id} className="bucket-card">
                <div className="bucket-card-top">
                  <input
                    type="checkbox"
                    checked={selectedBuckets.has(b.id)}
                    onChange={e => {
                      setSelectedBuckets(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(b.id); else next.delete(b.id);
                        return next;
                      });
                    }}
                    style={{ width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer', accentColor: 'var(--rose)', marginTop: '2px' }}
                  />
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>💗</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="bucket-card-name">{name}</div>
                    {meta && <div className="bucket-card-meta">{meta}</div>}
                  </div>
                  <button
                    className="bucket-poke-btn"
                    title="콕 찌르기"
                    onClick={() => handlePoke(name)}
                  >❤️</button>
                  <button className="btn btn-outline btn-xs" onClick={() => handleDeleteBucket(b.id)}>삭제</button>
                </div>
                <input
                  className="bucket-card-memo"
                  type="text"
                  placeholder="기대평을 적어봐요... ✏️"
                  value={bucketMemos[b.id] ?? (b.memo || '')}
                  onChange={e => setBucketMemos(prev => ({ ...prev, [b.id]: e.target.value }))}
                  onBlur={e => handleBucketMemoBlur(b.id, e.target.value)}
                />
              </div>
            );
          })}
          {allPlaces.filter(p => p.category === 'wanna').length === 0 && allBucketlist.length === 0 && (
            <div className="empty-state">가고 싶은 곳을 추가해보세요</div>
          )}
        </div>
      )}

      {placeTab === 'stats' && renderStats()}

      {/* 장소 추가 모달 */}
      <div className={'modal-bg' + (showPlaceModal ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) setShowPlaceModal(false); }}>
        <div className="modal">
          <div className="modal-bar" />
          <div className="modal-title">장소 추가 📍</div>
          <div className="form-group">
            <label className="form-label">지역</label>
            <div className="region-wrap">
              <button
                className={'region-btn' + (placeRegionOpen ? ' open' : '')}
                onClick={() => setPlaceRegionOpen(v => !v)}
              >
                <span>{placeRegion || '지역을 선택하세요'}</span><span>▾</span>
              </button>
              {placeRegionOpen && (
                <div className="region-dropdown open">
                  {Object.entries(REGIONS).map(([group, cities]) => (
                    <div key={group}>
                      <div className="region-group-title">{group}</div>
                      {cities.map(city => (
                        <div
                          key={city}
                          className={'region-opt' + (placeRegion === city ? ' selected' : '')}
                          onClick={() => { setPlaceRegion(city); setPlaceRegionOpen(false); }}
                        >{city}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">장소명</label>
            <input type="text" className="form-input" placeholder="예) 수성못" value={placeName} onChange={e => setPlaceName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">카테고리</label>
            <select className="form-input" value={placeCat} onChange={e => setPlaceCat(e.target.value as 'visited' | 'wanna')}>
              <option value="visited">가봤던 곳</option>
              <option value="wanna">가고싶은 곳</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">메모</label>
            <input type="text" className="form-input" placeholder="기억나는 것..." value={placeMemo} onChange={e => setPlaceMemo(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline btn-full" onClick={() => setShowPlaceModal(false)}>취소</button>
            <button className="btn btn-rose btn-full" onClick={handleSavePlace}>저장</button>
          </div>
        </div>
      </div>

      {/* 지역 날짜 모달 */}
      <div className={'modal-bg' + (showRegionModal ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) setShowRegionModal(false); }}>
        <div className="modal">
          <div className="modal-bar" />
          <div className="modal-title">{regionModalTitle}</div>
          {regionVisitedDates.length ? regionVisitedDates.map(r => {
            const diary = allDiaries.find(d => d.reqId === r.id)
              || allDiaries.find(d => d.date === r.date && getRegionGroup(d.region || '') === regionModalRkey);
            return (
              <div key={r.id} className="date-card" style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div className="date-card-date">{r.date} {r.time}</div>
                  <span className="sbadge s-accepted">확정 💕</span>
                </div>
                <div className="date-card-info">{r.theme} · {r.region}{r.subLocation ? ' / ' + r.subLocation : ''}</div>
                {diary && (
                  <div style={{ background: 'var(--rose4)', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', marginTop: '8px' }}>
                    <span style={{ fontWeight: 700 }}>📔 {diary.title}</span>
                    <div style={{ color: 'var(--text2)', marginTop: '3px', fontSize: '12px' }}>{'★'.repeat(diary.star || 5)}</div>
                  </div>
                )}
              </div>
            );
          }) : <div className="empty-state">이 지역 데이트 기록이 없어요 🗺️</div>}
          <button className="btn btn-outline btn-full" style={{ marginTop: '16px' }} onClick={() => setShowRegionModal(false)}>닫기</button>
        </div>
      </div>
    </div>
  );
}
