'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { simplifyRegionName } from '@/lib/utils';
import { useMapComputed } from './map/useMapComputed';
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

  useEffect(() => {
    const m: Record<string, string> = {};
    allBucketlist.forEach(b => { m[b.id] = b.memo || ''; });
    setBucketMemos(m);
  }, [allBucketlist]);

  const {
    svgContent, isRegionVisited, counts,
    visitedPathCount, totalPathCount, progressPct, visitedRegionCount, ddayVal,
  } = useMapComputed(allPlaces, allBucketlist, allRequests, allAnniversaries, mapControlActive);

  const handleRegionVisitedClick = (rkey: string, rname: string) => {
    setRegionModalRkey(rkey);
    setRegionModalTitle(simplifyRegionName(rname) + (counts[rkey] ? ` (${counts[rkey]}회)` : ''));
    setShowRegionModal(true);
  };

  const handleToggleBucket = async (rkey: string, rname: string) => {
    const existing = allBucketlist.find(b =>
      (b.regionName ? b.regionName === rname : b.region === rkey)
    );
    if (existing) {
      await deleteDoc(doc(db, 'bucketlist', existing.id));
      showToast('버킷리스트에서 제거했어요');
    } else {
      await addDoc(collection(db, 'bucketlist'), {
        roomId: currentCoupleCode, region: rkey, regionName: rname || rkey,
        createdBy: currentNick, createdAt: serverTimestamp(),
      });
      showToast('버킷리스트에 추가했어요 💗');
    }
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
        isRegionVisited={isRegionVisited}
        onRegionVisitedClick={handleRegionVisitedClick}
        onBucketToggle={handleToggleBucket}
        onDice={handleDice}
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
