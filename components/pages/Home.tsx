'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getGreeting, getDday } from '@/lib/utils';

interface Request {
  id: string; fromUser: string; toUser: string;
  date: string; time: string; theme: string; region: string;
  subLocation?: string; message?: string; status: string; coupleCode: string;
}
interface Diary { id: string; reqId?: string; date: string; title: string; content: string; star?: number; }
interface Anniversary { id: string; name: string; date: string; emoji: string; repeat: boolean; targetDate?: string; }
interface Message { id: string; fromUser: string; text: string; readAt: { seconds?: number } | null; createdAt: { seconds?: number } | null; }

interface HomeProps {
  currentNick: string;
  currentCoupleCode: string;
  allRequests: Request[];
  allDiaries: Diary[];
  allMessages: Message[];
  allAnniversaries: Anniversary[];
  onNavigate: (page: string) => void;
  onOpenDiaryShortcut: () => void;
  showToast: (msg: string, isErr?: boolean) => void;
  showConfirm: (msg: string, onOk: () => void) => void;
  onSwitchMyTab: (tab: string) => void;
}

const THEME_EMOJI: Record<string, string> = {
  '맛집탐방': '🍽️', '카페': '☕', '드라이브': '🚗', '액티비티': '🎯',
  '힐링': '🌿', '문화생활': '🎬', '집데이트': '🏠', '로맨틱': '💕',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}
function formatTimePretty(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h < 12 ? '오전' : '오후'} ${h === 0 ? 12 : h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')}`;
}

export default function Home({
  currentNick, currentCoupleCode, allRequests, allDiaries, allMessages, allAnniversaries,
  onNavigate, showToast, showConfirm, onSwitchMyTab,
}: HomeProps) {
  const today = new Date().toISOString().split('T')[0];
  const accepted = allRequests.filter(r => r.status === '수락' || r.status === 'accepted');
  const pending = allRequests.filter(r => r.status === '대기');
  const incoming = pending.filter(r => r.toUser === currentNick);
  const upcoming = accepted.filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const todayDate = accepted.find(r => r.date === today);
  const unreadMsgCount = allMessages.filter(m => m.fromUser !== currentNick && !m.readAt).length;
  const noDiaryCount = accepted.filter(r => r.date < today && !allDiaries.some(d => d.reqId === r.id || d.date === r.date)).length;

  // D+Day 기준일 (localStorage 우선, 없으면 첫 데이트 날짜)
  const lsKey = `startDate_${currentCoupleCode}`;
  const [startDate, setStartDate] = useState<string>('');
  const [dPlusModalOpen, setDPlusModalOpen] = useState(false);
  const [dPlusInput, setDPlusInput] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(lsKey);
    if (saved) { setStartDate(saved); return; }
    const firstDate = accepted.map(r => r.date).sort()[0];
    if (firstDate) setStartDate(firstDate);
  }, [currentCoupleCode, allRequests.length]); // eslint-disable-line

  const daysTogether = startDate
    ? Math.floor((Date.now() - new Date(startDate + 'T00:00:00').getTime()) / 86400000)
    : null;

  const handleSaveDPlus = () => {
    if (!dPlusInput) return;
    localStorage.setItem(lsKey, dPlusInput);
    setStartDate(dPlusInput);
    setDPlusModalOpen(false);
    showToast('기준일이 설정됐어요 💕');
  };

  // 다음 데이트
  const nextDate = upcoming[0] ?? null;
  const ddayNum = nextDate ? Math.ceil((new Date(nextDate.date + 'T00:00:00').getTime() - Date.now()) / 86400000) : null;

  // 가장 가까운 기념일
  const nextAnniversary = allAnniversaries.map(a => {
    let targetDate = a.date;
    if (a.repeat) {
      const yr = new Date().getFullYear();
      const c = `${yr}-${a.date.slice(5)}`;
      targetDate = c >= today ? c : `${yr + 1}-${a.date.slice(5)}`;
    }
    return { ...a, targetDate };
  }).filter(a => a.targetDate >= today).sort((a, b) => (a.targetDate || '').localeCompare(b.targetDate || ''))[0] ?? null;

  // 최신 메시지
  const latestMsg = allMessages.length > 0 ? allMessages[allMessages.length - 1] : null;

  const handleAccept = async (id: string) => {
    const req = allRequests.find(r => r.id === id);
    await updateDoc(doc(db, 'requests', id), { status: '수락' });
    if (req) {
      await addDoc(collection(db, 'schedules'), {
        title: `${req.theme} · ${req.region}`,
        date: req.date,
        description: req.time || '',
        createdBy: 'auto',
        roomId: currentCoupleCode,
        createdAt: serverTimestamp(),
        fromRequest: id,
      });
    }
    showToast('수락했어요! 💕');
  };
  const handleReject = (id: string) => {
    showConfirm('거절할까요?', async () => {
      await deleteDoc(doc(db, 'requests', id));
      showToast('거절했어요');
    });
  };

  return (
    <div id="page-home" className="page active">

      {/* ── Hero ── */}
      <div className="hero" style={{ borderRadius: '20px', padding: '28px 24px', marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>{getGreeting()}</div>
        <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: '22px' }}>{currentNick}님</div>

        {daysTogether !== null ? (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
              <div style={{ fontSize: '52px', fontWeight: 900, lineHeight: 1, letterSpacing: '-2px' }}>D+{daysTogether}</div>
              <button
                onClick={() => { setDPlusInput(startDate); setDPlusModalOpen(true); }}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', marginBottom: '6px', fontFamily: 'inherit' }}
              >변경</button>
            </div>
            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px', letterSpacing: '0.5px' }}>
              {startDate} 기준
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: '22px' }}>
            <button onClick={() => { setDPlusInput(''); setDPlusModalOpen(true); }}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              처음 만난 날 설정하기 💕
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '24px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '16px' }}>
          <div><div style={{ fontSize: '22px', fontWeight: 900, lineHeight: 1 }}>{accepted.length}</div><div style={{ fontSize: '10px', opacity: 0.72, marginTop: '4px' }}>데이트</div></div>
          <div><div style={{ fontSize: '22px', fontWeight: 900, lineHeight: 1 }}>{allDiaries.length}</div><div style={{ fontSize: '10px', opacity: 0.72, marginTop: '4px' }}>일기</div></div>
          {pending.length > 0 && (
            <div><div style={{ fontSize: '22px', fontWeight: 900, lineHeight: 1 }}>{pending.length}</div><div style={{ fontSize: '10px', opacity: 0.72, marginTop: '4px' }}>대기중</div></div>
          )}
        </div>
      </div>

      {/* ── 오늘 데이트 배너 ── */}
      {todayDate && (
        <div style={{ background: 'linear-gradient(135deg,#FF9A7B,var(--rose))', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px', color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', marginBottom: '6px' }}>🎉</div>
          <div style={{ fontSize: '16px', fontWeight: 900, marginBottom: '4px' }}>오늘 데이트 날이에요!</div>
          <div style={{ fontSize: '13px', opacity: 0.9 }}>{THEME_EMOJI[todayDate.theme] || ''} {todayDate.theme} · 📍 {todayDate.region}</div>
        </div>
      )}

      {/* ── 기념일 D-day ── */}
      {nextAnniversary && (
        <div style={{ background: 'linear-gradient(135deg,#F3E8FF,#FFF0F5)', border: '1px solid #E9D5FF', borderRadius: '14px', padding: '14px 18px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#7C3AED', letterSpacing: '0.5px', marginBottom: '4px' }}>기념일</div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>{nextAnniversary.emoji} {nextAnniversary.name}</div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#7C3AED' }}>{getDday(nextAnniversary.targetDate || nextAnniversary.date, false)}</div>
        </div>
      )}

      {/* ── 채팅 바로가기 ── */}
      <div
        onClick={() => onNavigate('chat')}
        style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px 16px', marginBottom: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
      >
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--rose4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>💬</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text3)', marginBottom: '2px' }}>채팅</div>
          {latestMsg ? (
            <div style={{ fontSize: '13px', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {latestMsg.fromUser === currentNick ? '나: ' : ''}{latestMsg.text}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--text3)' }}>대화를 시작해봐요</div>
          )}
        </div>
        {unreadMsgCount > 0 && (
          <div style={{ background: 'var(--rose)', color: 'white', borderRadius: '12px', padding: '2px 8px', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}>{unreadMsgCount}</div>
        )}
      </div>

      {/* ── 받은 신청 ── */}
      {incoming.map(r => (
        <div key={r.id} style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '12px', border: '1.5px solid var(--rose3)', boxShadow: '0 4px 20px rgba(255,107,157,0.12)' }}>
          <div style={{ fontSize: '12px', color: 'var(--rose)', fontWeight: 700, marginBottom: '12px' }}>💌 데이트 신청이 왔어요</div>
          <div style={{ fontSize: '20px', fontWeight: 900, marginBottom: '4px', letterSpacing: '-0.3px', color: 'var(--text)' }}>{formatDate(r.date)}</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: r.message ? '14px' : '18px' }}>
            {formatTimePretty(r.time)} · {THEME_EMOJI[r.theme] || ''} {r.theme} · 📍 {r.region}
          </div>
          {r.message && (
            <div style={{ fontSize: '14px', color: 'var(--text2)', fontStyle: 'italic', marginBottom: '18px', padding: '12px 16px', background: 'var(--rose4)', borderRadius: '12px', lineHeight: 1.7, borderLeft: '3px solid var(--rose2)' }}>
              &ldquo;{r.message}&rdquo;
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-rose" style={{ flex: 1, padding: '12px', fontWeight: 800, borderRadius: '10px' }} onClick={() => handleAccept(r.id)}>수락 💕</button>
            <button className="btn btn-outline" style={{ padding: '12px 20px', borderRadius: '10px' }} onClick={() => handleReject(r.id)}>거절</button>
          </div>
        </div>
      ))}

      {/* ── 알림 배너 ── */}
      {noDiaryCount > 0 && (
        <div style={{ background: 'linear-gradient(135deg,#FF9A7B,#FF6B9D)', borderRadius: '12px', padding: '12px 16px', marginBottom: '10px', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          onClick={() => { onNavigate('my'); onSwitchMyTab('dates'); }}>
          <span>📔 일기 안 쓴 날이 {noDiaryCount}일 있어요</span><span style={{ opacity: 0.8 }}>›</span>
        </div>
      )}

      {/* ── 다가오는 데이트 ── */}
      {nextDate ? (
        <>
          <div className="section-label" style={{ marginTop: '16px' }}>다가오는 데이트</div>
          <div style={{ background: 'linear-gradient(135deg,#FFF5FB,#FFFAF0)', border: '1.5px solid var(--rose3)', borderRadius: '16px', padding: '18px 20px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text)', marginBottom: '4px' }}>{formatDate(nextDate.date)}</div>
              <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '2px' }}>{formatTimePretty(nextDate.time)}</div>
              <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{THEME_EMOJI[nextDate.theme] || ''} {nextDate.theme} · 📍 {nextDate.region}</div>
            </div>
            <div style={{ background: 'var(--rose)', borderRadius: '14px', padding: '10px 16px', textAlign: 'center', color: 'white', minWidth: '64px' }}>
              <div style={{ fontSize: '10px', opacity: 0.85, marginBottom: '4px' }}>{ddayNum === 0 ? '오늘!' : '남은 날'}</div>
              <div style={{ fontSize: '26px', fontWeight: 900, lineHeight: 1 }}>{ddayNum === 0 ? '🎉' : `D-${ddayNum}`}</div>
            </div>
          </div>
          {upcoming.slice(1).map(r => (
            <div key={r.id} style={{ background: 'white', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '2px' }}>{formatDate(r.date)}</div>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{THEME_EMOJI[r.theme] || ''} {r.theme} · {r.region}</div>
              </div>
              <span className="sbadge s-accepted">확정</span>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="section-label" style={{ marginTop: '16px' }}>다가오는 데이트</div>
          <div style={{ background: 'white', border: '1.5px dashed var(--border)', borderRadius: '16px', padding: '32px 20px', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => onNavigate('apply')}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>예정된 데이트가 없어요</div>
            <div style={{ fontSize: '13px', color: 'var(--rose)', fontWeight: 700 }}>데이트 신청하기 →</div>
          </div>
        </>
      )}

      {/* D+Day 기준일 설정 모달 */}
      <div className={'modal-bg' + (dPlusModalOpen ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) setDPlusModalOpen(false); }}>
        <div className="modal">
          <div className="modal-bar" />
          <div className="modal-title">D+Day 기준일 설정 💕</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px', lineHeight: 1.6 }}>
            처음 만난 날이나 사귄 날을 설정하면<br />홈 화면에서 D+일수를 확인할 수 있어요
          </div>
          <div className="form-group">
            <label className="form-label">기준일</label>
            <input type="date" className="form-input" value={dPlusInput} onChange={e => setDPlusInput(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline btn-full" onClick={() => setDPlusModalOpen(false)}>취소</button>
            <button className="btn btn-rose btn-full" onClick={handleSaveDPlus}>저장 💕</button>
          </div>
        </div>
      </div>
    </div>
  );
}
