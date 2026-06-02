'use client';
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface ApplyProps {
  currentNick: string;
  currentCoupleCode: string;
  members: string[];
  showToast: (msg: string, isErr?: boolean) => void;
  onSubmitted: () => void;
}

const THEMES = ['맛집탐방', '카페', '드라이브', '액티비티', '힐링', '문화생활', '집데이트', '로맨틱'];

export default function Apply({ currentNick, currentCoupleCode, members, showToast, onSubmitted }: ApplyProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [multiDay, setMultiDay] = useState(false);
  const [time, setTime] = useState('14:00');
  const [selTheme, setSelTheme] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');

  // 강퇴된 멤버 제외하고 상대방 찾기
  const partner = members.find(m => m !== currentNick) || '';

  const handleSubmit = async () => {
    if (!date) { showToast('날짜를 골라주세요', true); return; }
    if (!selTheme) { showToast('테마를 골라주세요', true); return; }
    if (!location.trim()) { showToast('장소를 입력해주세요', true); return; }
    if (!partner) { showToast('상대방이 아직 방에 없어요', true); return; }

    if (multiDay && endDate && endDate < date) { showToast('종료일이 시작일보다 앞서요', true); return; }

    await addDoc(collection(db, 'requests'), {
      fromUser: currentNick,
      toUser: partner,
      date, time,
      endDate: multiDay && endDate ? endDate : null,
      theme: selTheme,
      region: location.trim(),
      subLocation: '',
      checklist: [],
      message,
      status: '대기',
      coupleCode: currentCoupleCode,
      createdAt: serverTimestamp(),
    });

    showToast('데이트 신청 완료 💕');
    setSelTheme(''); setLocation(''); setMessage(''); setEndDate(''); setMultiDay(false);
    onSubmitted();
  };

  return (
    <div id="page-apply" className="page active">
      <div className="page-title">데이트 신청 💌</div>

      {partner ? (
        <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '14px', color: 'var(--text2)' }}>
          <span style={{ fontWeight: 700, color: 'var(--rose)' }}>{partner}</span>님에게 보내는 데이트 신청
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '14px', color: 'var(--text3)' }}>
          상대방이 아직 방에 없어요
        </div>
      )}

      <div className="card">
        {/* 날짜 + 시간 - 모바일 오버플로우 방지 */}
        <div className="form-group">
          <label className="form-label">날짜 / 시간</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ flex: '1 1 140px', minWidth: 0, fontSize: '15px' }}
            />
            <input
              type="time"
              className="form-input"
              value={time}
              onChange={e => setTime(e.target.value)}
              style={{ flex: '1 1 100px', minWidth: 0, fontSize: '15px' }}
            />
          </div>
        </div>

        {/* 기간 설정 */}
        <div className="form-group" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => { setMultiDay(v => !v); if (multiDay) setEndDate(''); }}
              style={{
                padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                border: '1.5px solid ' + (multiDay ? 'var(--rose)' : 'var(--border)'),
                background: multiDay ? 'var(--rose4)' : 'transparent',
                color: multiDay ? 'var(--rose)' : 'var(--text3)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >🗓️ 기간 설정 {multiDay ? 'ON' : ''}</button>
            {multiDay && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                <span style={{ fontSize: '12px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>~ 종료일</span>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  min={date}
                  onChange={e => setEndDate(e.target.value)}
                  style={{ flex: 1, minWidth: 0, fontSize: '14px' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* 테마 — 이모지 없이, 4열 작은 칩 */}
        <div className="form-group">
          <label className="form-label">어떤 데이트?</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {THEMES.map(t => (
              <button
                key={t}
                onClick={() => setSelTheme(t)}
                style={{
                  padding: '7px 4px',
                  borderRadius: '8px',
                  border: '1.5px solid ' + (selTheme === t ? 'var(--rose)' : 'var(--border)'),
                  background: selTheme === t ? 'var(--rose4)' : 'white',
                  color: selTheme === t ? 'var(--rose)' : 'var(--text2)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'center',
                  lineHeight: 1.3,
                  transition: 'all 0.15s',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 장소 */}
        <div className="form-group">
          <label className="form-label">어디서?</label>
          <input
            type="text"
            className="form-input"
            placeholder="예) 홍대, 한강공원, 경복궁..."
            value={location}
            onChange={e => setLocation(e.target.value)}
          />
        </div>

        {/* 한마디 */}
        <div className="form-group">
          <label className="form-label">한마디 <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '12px' }}>(선택)</span></label>
          <textarea
            className="form-input"
            placeholder="전하고 싶은 말을 적어봐요 💕"
            rows={3}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>

        <button className="please-btn" onClick={handleSubmit}>
          데이트 신청하기 💕
        </button>
      </div>
    </div>
  );
}
