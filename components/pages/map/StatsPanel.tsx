'use client';
import { getRegionGroup } from '@/lib/utils';
import type { DateRequest, Place, Bucketlist } from './types';

interface StatsPanelProps {
  allRequests: DateRequest[];
  allPlaces: Place[];
  allBucketlist: Bucketlist[];
}

export default function StatsPanel({ allRequests, allPlaces, allBucketlist }: StatsPanelProps) {
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
}
