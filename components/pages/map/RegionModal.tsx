'use client';
import { getRegionGroup } from '@/lib/utils';
import type { DateRequest, Diary } from './types';

interface RegionModalProps {
  isOpen: boolean;
  title: string;
  regionRkey: string;
  allRequests: DateRequest[];
  allDiaries: Diary[];
  onClose: () => void;
}

export default function RegionModal({ isOpen, title, regionRkey, allRequests, allDiaries, onClose }: RegionModalProps) {
  const visitedDates = allRequests.filter(r =>
    (r.status === '수락' || r.status === 'accepted') && r.region && getRegionGroup(r.region) === regionRkey
  ).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className={'modal-bg' + (isOpen ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-bar" />
        <div className="modal-title">{title}</div>
        {visitedDates.length ? visitedDates.map(r => {
          const diary = allDiaries.find(d => d.reqId === r.id)
            || allDiaries.find(d => d.date === r.date && getRegionGroup(d.region || '') === regionRkey);
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
        <button className="btn btn-outline btn-full" style={{ marginTop: '16px' }} onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
