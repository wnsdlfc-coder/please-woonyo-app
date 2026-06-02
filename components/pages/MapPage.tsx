'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { simplifyRegionName } from '@/lib/utils';
import { useMapComputed, allSVGPaths, cityMatchesPath } from './map/useMapComputed';
import KoreaMap from './map/KoreaMap';
import PlaceListSheet from './map/PlaceListSheet';
import PlaceAddModal from './map/PlaceAddModal';
import RegionModal from './map/RegionModal';
import type { MapPageProps, PlaceTab } from './map/types';

export default function MapPage({
  currentNick, currentCoupleCode, allPlaces, allBucketlist,
  allRequests, allAnniversaries, allDiaries, showToast, showConfirm,
}: MapPageProps) {
  const [placeTab, setPlaceTab] = useState<PlaceTab>('visited');
  const [placeListOpen, setPlaceListOpen] = useState(false);
  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [regionModalTitle, setRegionModalTitle] = useState('');
  const [regionModalRkey, setRegionModalRkey] = useState('');
  const [mapControlActive, setMapControlActive] = useState(false);
  const [selectedBuckets, setSelectedBuckets] = useState<Set<string>>(new Set());
  const [bucketMemos, setBucketMemos] = useState<Record<string, string>>({});
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const m: Record<string, string> = {};
    allBucketlist.forEach(b => { m[b.id] = b.memo || ''; });
    setBucketMemos(m);
  }, [allBucketlist]);

  const {
    svgContent, counts,
    visitedPathCount, totalPathCount, progressPct, visitedRegionCount, ddayVal,
  } = useMapComputed(allPlaces, allBucketlist, allRequests, allAnniversaries, mapControlActive);

  // 지역 클릭 → 상세 모달 (방문 여부 무관)
  const handleRegionClick = (rkey: string, rname: string) => {
    setRegionModalRkey(rkey);
    setRegionModalTitle(simplifyRegionName(rname) + (counts[rkey] ? ` (${counts[rkey]}회)` : ''));
    setShowRegionModal(true);
  };

  // 현재 위치 인증 — Nominatim 역지오코딩
  const handleVerifyLocation = () => {
    if (!navigator.geolocation) {
      showToast('위치 서비스를 지원하지 않는 브라우저예요', true);
      return;
    }
    setIsVerifying(true);
    showToast('📡 위치를 확인하는 중...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
            { headers: { 'User-Agent': 'PleaseWoonyo/1.0 (couple-app)' } }
          );
          const data = await res.json();
          const addr = data.address || {};

          // 주소 후보: 구/군 → 시 → 도 순서로 매칭 시도
          const candidates: string[] = [
            addr.suburb, addr.quarter, addr.neighbourhood,
            addr.county, addr.city, addr.town, addr.village,
            addr.state,
          ].filter(Boolean) as string[];

          let matchedRkey = '';
          let matchedRname = '';

          for (const candidate of candidates) {
            for (const { n, rk } of allSVGPaths) {
              if (cityMatchesPath(candidate, n)) {
                matchedRkey = rk;
                matchedRname = n;
                break;
              }
            }
            if (matchedRname) break;
          }

          if (!matchedRname) {
            showToast('지역을 인식할 수 없어요. 다시 시도해보세요 😥', true);
            setIsVerifying(false);
            return;
          }

          // 이미 인증된 지역인지 확인 (중복 방지)
          const regionKey = `${matchedRkey} · ${matchedRname}`;
          const alreadyVerified = allPlaces.some(
            p => p.category === 'visited' && p.memo === '위치 인증' && p.region === regionKey
          );
          if (alreadyVerified) {
            showToast(`📍 ${simplifyRegionName(matchedRname)} 은(는) 이미 인증된 지역이에요!`);
            setIsVerifying(false);
            return;
          }

          await addDoc(collection(db, 'places'), {
            name: simplifyRegionName(matchedRname),
            region: regionKey,
            category: 'visited',
            coupleCode: currentCoupleCode,
            memo: '위치 인증',
            createdAt: serverTimestamp(),
          });

          showToast(`🎉 ${simplifyRegionName(matchedRname)} 인증 완료! 지도에 색칠됐어요`);
        } catch {
          showToast('위치 확인 실패. 다시 시도해보세요', true);
        } finally {
          setIsVerifying(false);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) showToast('위치 권한을 허용해주세요 📍', true);
        else showToast('위치를 가져올 수 없어요', true);
        setIsVerifying(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSavePlace = async ({ name, region, category, memo }: { name: string; region: string; category: 'visited' | 'wanna'; memo: string }) => {
    if (!name.trim() || !region) { showToast('지역과 장소명을 입력해주세요', true); return; }
    await addDoc(collection(db, 'places'), {
      name: name.trim(), region, memo, category, coupleCode: currentCoupleCode, createdAt: serverTimestamp(),
    });
    setShowPlaceModal(false);
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
        roomId: currentCoupleCode, type: 'poke', from: currentNick, regionName, createdAt: serverTimestamp(),
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
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:800;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div style="background:white;border-radius:20px;padding:28px 32px;text-align:center;max-width:280px;width:88%;animation:slideUp 0.3s ease;"><div style="font-size:52px;margin-bottom:12px;">🎲</div><div style="font-size:12px;color:var(--text3);margin-bottom:8px;font-weight:600;">오늘의 추천 버킷리스트</div><div style="font-size:22px;font-weight:800;color:var(--rose);margin-bottom:22px;">${name}</div><button id="dice-close-btn" style="padding:10px 28px;background:var(--rose);color:white;border:none;border-radius:20px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">확인</button></div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#dice-close-btn')?.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  };

  return (
    <div id="page-map" className="page active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="page-title" style={{ margin: 0 }}>우리의 장소 🗺️</div>
        <button className="btn btn-rose btn-sm" onClick={() => setShowPlaceModal(true)}>추가</button>
      </div>

      <div id="map-progress-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text2)' }}>전국 정복률</span>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--rose)' }}>{progressPct}%</span>
        </div>
        <div style={{ height: '7px', background: '#FFE4EC', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg,#FF8FB1,#E8456A)', borderRadius: '99px', width: progressPct + '%', transition: 'width 0.7s ease' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', margin: '10px 0', flexWrap: 'wrap' }}>
        <div style={{ background: 'linear-gradient(135deg,#FFE4EC,#FFF0F5)', borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, color: '#E85B8A', display: 'flex', alignItems: 'center', gap: '5px' }}>
          📍 다녀온 곳 <span>{visitedRegionCount}</span>곳
        </div>
        <div style={{ background: 'linear-gradient(135deg,#E3F4FF,#EBF5FB)', borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, color: '#4A90D9', display: 'flex', alignItems: 'center', gap: '5px' }}>
          💙 가고싶은 곳 <span>{allBucketlist.length}</span>곳
        </div>
      </div>

      <KoreaMap
        svgContent={svgContent}
        mapControlActive={mapControlActive}
        onToggleControl={() => setMapControlActive(v => !v)}
        visitedPathCount={visitedPathCount}
        totalPathCount={totalPathCount}
        ddayVal={ddayVal}
        onRegionClick={handleRegionClick}
        onDice={handleDice}
        onVerifyLocation={handleVerifyLocation}
        isVerifying={isVerifying}
      />

      <div className="map-legend-wrap">
        <div className="map-legend-item"><div className="map-legend-dot" style={{ background: '#E8E8E8', border: '1px solid #ccc' }} />0회</div>
        <div className="map-legend-item"><div className="map-legend-dot" style={{ background: '#FFD6E7' }} />1-2</div>
        <div className="map-legend-item"><div className="map-legend-dot" style={{ background: '#FF8FB1' }} />3-5</div>
        <div className="map-legend-item"><div className="map-legend-dot" style={{ background: '#FF6B9D' }} />6-8</div>
        <div className="map-legend-item"><div className="map-legend-dot" style={{ background: '#E8456A' }} />9-10+</div>
        <div className="map-legend-item"><div className="map-legend-dot" style={{ background: '#87CEEB', border: '1px solid #64B5E8' }} />가고싶은</div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        {([['visited', '다녀온 곳'], ['wanna', '가고싶은 곳'], ['stats', '통계']] as [PlaceTab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => { setPlaceTab(tab); setPlaceListOpen(true); }}
            style={{
              flex: 1, padding: '10px 6px', borderRadius: '10px',
              border: '1.5px solid var(--border)', background: '#FFFDF9',
              fontSize: '12px', fontWeight: 700, color: 'var(--text2)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <PlaceListSheet
        isOpen={placeListOpen}
        onClose={() => setPlaceListOpen(false)}
        placeTab={placeTab}
        onTabChange={setPlaceTab}
        allPlaces={allPlaces}
        allBucketlist={allBucketlist}
        allRequests={allRequests}
        selectedBuckets={selectedBuckets}
        onSelectedBucketsChange={setSelectedBuckets}
        bucketMemos={bucketMemos}
        onBucketMemoChange={(id, val) => setBucketMemos(prev => ({ ...prev, [id]: val }))}
        onBucketMemoBlur={async (id, memo) => {
          try { await updateDoc(doc(db, 'bucketlist', id), { memo }); } catch { /* ignore */ }
        }}
        onDeletePlace={handleDeletePlace}
        onDeleteBucket={handleDeleteBucket}
        onPoke={handlePoke}
        showConfirm={showConfirm}
        showToast={showToast}
      />

      <PlaceAddModal
        isOpen={showPlaceModal}
        onClose={() => setShowPlaceModal(false)}
        onSave={handleSavePlace}
      />

      <RegionModal
        isOpen={showRegionModal}
        title={regionModalTitle}
        regionRkey={regionModalRkey}
        allRequests={allRequests}
        allDiaries={allDiaries}
        onClose={() => setShowRegionModal(false)}
      />
    </div>
  );
}
