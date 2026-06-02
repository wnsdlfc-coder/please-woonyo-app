'use client';
import { db } from '@/lib/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import StatsPanel from './StatsPanel';
import type { Place, Bucketlist, DateRequest, PlaceTab } from './types';

interface PlaceListSheetProps {
  isOpen: boolean;
  onClose: () => void;
  placeTab: PlaceTab;
  onTabChange: (tab: PlaceTab) => void;
  allPlaces: Place[];
  allBucketlist: Bucketlist[];
  allRequests: DateRequest[];
  selectedBuckets: Set<string>;
  onSelectedBucketsChange: (s: Set<string>) => void;
  bucketMemos: Record<string, string>;
  onBucketMemoChange: (id: string, val: string) => void;
  onBucketMemoBlur: (id: string, val: string) => void;
  onDeletePlace: (id: string) => void;
  onDeleteBucket: (id: string) => void;
  onPoke: (regionName: string) => void;
  showConfirm: (msg: string, onOk: () => void) => void;
  showToast: (msg: string, isErr?: boolean) => void;
}

const TABS: [PlaceTab, string][] = [['visited', '다녀온 곳'], ['wanna', '가고싶은 곳'], ['stats', '통계']];

export default function PlaceListSheet({
  isOpen, onClose, placeTab, onTabChange,
  allPlaces, allBucketlist, allRequests,
  selectedBuckets, onSelectedBucketsChange,
  bucketMemos, onBucketMemoChange, onBucketMemoBlur,
  onDeletePlace, onDeleteBucket, onPoke,
  showConfirm, showToast,
}: PlaceListSheetProps) {
  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: '#FFFDF9', borderRadius: '20px 20px 0 0',
        padding: '0 16px 80px', maxHeight: '70vh', overflowY: 'auto',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {TABS.map(([tab, label]) => (
              <button key={tab} onClick={() => onTabChange(tab)} style={{
                padding: '5px 12px', borderRadius: '20px', border: 'none',
                background: placeTab === tab ? 'var(--rose)' : 'var(--border)',
                color: placeTab === tab ? 'white' : 'var(--text2)',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{label}</button>
            ))}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>

        {placeTab === 'visited' && (
          <div>
            {allPlaces.filter(p => p.category === 'visited').map(p => (
              <div key={p.id} className="place-item">
                <div className="place-dot" />
                <div style={{ flex: 1 }}>
                  <div className="place-name-big">{p.name}</div>
                  <div className="place-region-lbl">{p.region}{p.memo ? ' · ' + p.memo : ''}</div>
                </div>
                <button className="btn btn-outline btn-xs" onClick={() => onDeletePlace(p.id)}>삭제</button>
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
            {allPlaces.filter(p => p.category === 'visited').length === 0 &&
              allRequests.filter(r => r.status === '수락' && r.region).length === 0 && (
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
                <button className="btn btn-outline btn-xs" onClick={() => onDeletePlace(p.id)}>삭제</button>
              </div>
            ))}
            {allBucketlist.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
                <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: 'var(--text3)' }}>버킷리스트 {allBucketlist.length}개</span>
                <button className="btn btn-outline btn-xs" onClick={() => {
                  onSelectedBucketsChange(
                    selectedBuckets.size === allBucketlist.length
                      ? new Set()
                      : new Set(allBucketlist.map(b => b.id))
                  );
                }}>전체 선택</button>
                {selectedBuckets.size > 0 && (
                  <button className="btn btn-outline btn-xs" onClick={() => {
                    showConfirm('선택한 항목을 삭제할까요?', async () => {
                      await Promise.all([...selectedBuckets].map(id => deleteDoc(doc(db, 'bucketlist', id))));
                      onSelectedBucketsChange(new Set());
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
                ? (() => {
                    const d = b.createdAt!.toDate
                      ? b.createdAt!.toDate!()
                      : new Date((b.createdAt!.seconds || 0) * 1000);
                    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
                  })()
                : '';
              const meta = [b.createdBy, dateStr].filter(Boolean).join(' · ');
              return (
                <div key={b.id} className="bucket-card">
                  <div className="bucket-card-top">
                    <input
                      type="checkbox"
                      checked={selectedBuckets.has(b.id)}
                      onChange={e => {
                        const next = new Set(selectedBuckets);
                        if (e.target.checked) next.add(b.id); else next.delete(b.id);
                        onSelectedBucketsChange(next);
                      }}
                      style={{ width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer', accentColor: 'var(--rose)', marginTop: '2px' }}
                    />
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>💗</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="bucket-card-name">{name}</div>
                      {meta && <div className="bucket-card-meta">{meta}</div>}
                    </div>
                    <button className="bucket-poke-btn" title="콕 찌르기" onClick={() => onPoke(name)}>❤️</button>
                    <button className="btn btn-outline btn-xs" onClick={() => onDeleteBucket(b.id)}>삭제</button>
                  </div>
                  <input
                    className="bucket-card-memo"
                    type="text"
                    placeholder="기대평을 적어봐요... ✏️"
                    value={bucketMemos[b.id] ?? (b.memo || '')}
                    onChange={e => onBucketMemoChange(b.id, e.target.value)}
                    onBlur={e => onBucketMemoBlur(b.id, e.target.value)}
                  />
                </div>
              );
            })}
            {allPlaces.filter(p => p.category === 'wanna').length === 0 && allBucketlist.length === 0 && (
              <div className="empty-state">가고 싶은 곳을 추가해보세요</div>
            )}
          </div>
        )}

        {placeTab === 'stats' && (
          <StatsPanel allRequests={allRequests} allPlaces={allPlaces} allBucketlist={allBucketlist} />
        )}
      </div>
    </>
  );
}
