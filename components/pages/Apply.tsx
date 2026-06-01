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

const THEMES = [
  { label: '맛집탐방', emoji: '🍽️' },
  { label: '카페', emoji: '☕' },
  { label: '드라이브', emoji: '🚗' },
  { label: '액티비티', emoji: '🎯' },
  { label: '힐링', emoji: '🌿' },
  { label: '문화생활', emoji: '🎬' },
  { label: '집데이트', emoji: '🏠' },
  { label: '로맨틱', emoji: '💕' },
];

export default function Apply({ currentNick, currentCoupleCode, members, showToast, onSubmitted }: ApplyProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('14:00');
  const [selTheme, setSelTheme] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');

  const partner = members.find(m => m !== currentNick) || '';

  const handleSubmit = async () => {
    if (!date) { showToast('날짜를 골라주세요', true); return; }
    if (!selTheme) { showToast('테마를 골라주세요', true); return; }
    if (!location.trim()) { showToast('장소를 입력해주세요', true); return; }
    if (!partner) { showToast('상대방이 아직 방에 없어요', true); return; }

    await addDoc(collection(db, 'requests'), {
      fromUser: currentNick,
      toUser: partner,
      date,
      time,
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
    setSelTheme('');
    setLocation('');
    setMessage('');
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
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">날짜</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">시간</label>
            <input
              type="time"
              className="form-input"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">어떤 데이트?</label>
          <div className="theme-grid">
            {THEMES.map(t => (
              <button
                key={t.label}
                className={'theme-chip' + (selTheme === t.label ? ' selected' : '')}
                onClick={() => setSelTheme(t.label)}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

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
