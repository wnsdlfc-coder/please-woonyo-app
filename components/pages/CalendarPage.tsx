'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDday } from '@/lib/utils';
import { arrayUnion } from 'firebase/firestore';

interface Request {
  id: string;
  fromUser: string;
  toUser: string;
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
  content: string;
  star?: number;
  author?: string;
  comments?: { author: string; text: string; createdAt: string }[];
}

interface Anniversary {
  id: string;
  name: string;
  date: string;
  emoji: string;
  repeat: boolean;
}

interface Schedule {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  description?: string;
  createdBy?: string;
  fromRequest?: string;
}

interface CalendarPageProps {
  currentNick: string;
  currentCoupleCode: string;
  allRequests: Request[];
  allDiaries: Diary[];
  allAnniversaries: Anniversary[];
  allSchedules: Schedule[];
  showToast: (msg: string, isErr?: boolean) => void;
  onOpenDiary: (reqId: string, date?: string) => void;
}

export default function CalendarPage({
  currentNick, currentCoupleCode, allRequests, allDiaries,
  allAnniversaries, allSchedules, showToast, onOpenDiary
}: CalendarPageProps) {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [showAnniModal, setShowAnniModal] = useState(false);
  const [showSchModal, setShowSchModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailDate, setDetailDate] = useState('');

  // Detail modal comment state
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Anniversary form
  const [anniName, setAnniName] = useState('');
  const [anniDate, setAnniDate] = useState('');
  const [anniEmoji, setAnniEmoji] = useState('🎂');
  const [anniRepeat, setAnniRepeat] = useState(false);
  const [editAnniId, setEditAnniId] = useState<string | null>(null);

  // Schedule form
  const [schTitle, setSchTitle] = useState('');
  const [schDate, setSchDate] = useState(new Date().toISOString().split('T')[0]);
  const [schEndDate, setSchEndDate] = useState('');
  const [schDesc, setSchDesc] = useState('');

  const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = today.toISOString().split('T')[0];

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const lastDate = new Date(calYear, calMonth + 1, 0).getDate();

  const acceptedDates = new Set(allRequests.filter(r => r.status === '수락').map(r => r.date));
  const pendingDates = new Set(allRequests.filter(r => r.status === '대기').map(r => r.date));

  const anniDatesMap: Record<string, Anniversary[]> = {};
  allAnniversaries.forEach(a => {
    let d = new Date(a.date);
    if (a.repeat) d.setFullYear(calYear);
    const key = d.toISOString().split('T')[0];
    if (!anniDatesMap[key]) anniDatesMap[key] = [];
    anniDatesMap[key].push(a);
  });

  const scheduleDatesMap: Record<string, Schedule[]> = {};
  allSchedules.forEach(s => {
    const cur = new Date(s.date + 'T00:00:00');
    const end = new Date((s.endDate || s.date) + 'T00:00:00');
    while (cur <= end) {
      const key = cur.toISOString().split('T')[0];
      if (!scheduleDatesMap[key]) scheduleDatesMap[key] = [];
      scheduleDatesMap[key].push(s);
      cur.setDate(cur.getDate() + 1);
    }
  });

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const handleSaveAnni = async () => {
    if (!anniName.trim() || !anniDate) { showToast('이름과 날짜를 입력해주세요', true); return; }
    if (editAnniId) {
      await updateDoc(doc(db, 'anniversaries', editAnniId), {
        name: anniName, date: anniDate, emoji: anniEmoji || '🎂', repeat: anniRepeat,
      });
      showToast('기념일이 수정됐어요! ✏️');
    } else {
      await addDoc(collection(db, 'anniversaries'), {
        name: anniName, date: anniDate, emoji: anniEmoji || '🎂',
        repeat: anniRepeat, coupleCode: currentCoupleCode, createdAt: serverTimestamp()
      });
      showToast('기념일이 저장됐어요! 🎂');
    }
    setShowAnniModal(false);
    setEditAnniId(null);
    setAnniName(''); setAnniDate(''); setAnniEmoji('🎂'); setAnniRepeat(false);
  };

  const handleEditAnni = (a: Anniversary) => {
    setEditAnniId(a.id);
    setAnniName(a.name);
    setAnniDate(a.date);
    setAnniEmoji(a.emoji || '🎂');
    setAnniRepeat(a.repeat);
    setShowAnniModal(true);
  };

  const handleSaveSch = async () => {
    if (!schTitle.trim() || !schDate) { showToast('제목과 날짜를 입력해주세요', true); return; }
    if (schEndDate && schEndDate < schDate) { showToast('종료일이 시작일보다 앞서요', true); return; }
    await addDoc(collection(db, 'schedules'), {
      title: schTitle,
      date: schDate,
      endDate: schEndDate || null,
      description: schDesc,
      createdBy: currentNick,
      roomId: currentCoupleCode,
      createdAt: serverTimestamp()
    });
    setShowSchModal(false);
    setSchTitle(''); setSchDesc(''); setSchEndDate('');
    showToast('일정이 저장됐어요! 📋');
  };

  const handleDeleteAnni = async (id: string) => {
    await deleteDoc(doc(db, 'anniversaries', id));
    showToast('삭제됐어요');
  };

  const handleSendComment = async (diaryId: string) => {
    const text = (commentInputs[diaryId] || '').trim();
    if (!text) return;
    await updateDoc(doc(db, 'diaries', diaryId), {
      comments: arrayUnion({ author: currentNick, text, createdAt: new Date().toISOString() })
    });
    setCommentInputs(prev => ({ ...prev, [diaryId]: '' }));
    showToast('댓글을 달았어요!');
  };

  const renderCalCells = () => {
    const days = ['일','월','화','수','목','금','토'];
    const cells = [];
    days.forEach((d, i) => (
      cells.push(
        <div key={'lbl-' + i} className="cal-day-label" style={i === 0 ? { color: '#E74C3C' } : i === 6 ? { color: '#4A90D9' } : {}}>{d}</div>
      )
    ));
    // prev month filler
    for (let i = 0; i < firstDay; i++) {
      const prevDate = new Date(calYear, calMonth, -firstDay + i + 1);
      cells.push(
        <button key={'prev-' + i} className="cal-cell other-month" disabled>
          <span className="cal-num">{prevDate.getDate()}</span>
        </button>
      );
    }
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const cellDate = new Date(calYear, calMonth, d);
      const dow = cellDate.getDay();
      const isToday = cellDate.getTime() === today.getTime();
      const hasAnni = !!anniDatesMap[dateStr];
      const hasSched = !!scheduleDatesMap[dateStr];
      const hasAccepted = acceptedDates.has(dateStr);
      const hasPending = pendingDates.has(dateStr);
      const pastAccepted = hasAccepted && dateStr < todayStr;
      const hasNoDiary = pastAccepted && !allDiaries.some(di => di.date === dateStr);

      const anniColor = '#FFD6E0', schedColor = '#B3E5FC', dateColor = '#DCEDC8';
      const colorsOn = [hasAnni && anniColor, hasSched && schedColor, hasAccepted && dateColor].filter(Boolean) as string[];
      let bgStyle: React.CSSProperties = {};
      if (colorsOn.length === 3) bgStyle = { background: `conic-gradient(${anniColor} 0deg 120deg,${schedColor} 120deg 240deg,${dateColor} 240deg 360deg)` };
      else if (colorsOn.length === 2) bgStyle = { background: `linear-gradient(135deg,${colorsOn[0]} 50%,${colorsOn[1]} 50%)` };
      else if (colorsOn.length === 1) bgStyle = { background: colorsOn[0] };

      let cls = 'cal-cell'
        + (isToday ? ' today' : '')
        + (dow === 0 ? ' sunday' : '') + (dow === 6 ? ' saturday' : '')
        + (hasNoDiary ? ' no-diary-cell' : '');

      cells.push(
        <button key={dateStr} className={cls} style={bgStyle} onClick={() => { setDetailDate(dateStr); setShowDetailModal(true); }}>
          <span className="cal-num">{d}</span>
          <div style={{ display: 'flex', gap: '1px', marginTop: '2px', flexWrap: 'wrap', justifyContent: 'center', minHeight: '10px' }}>
            {hasAnni && (
              <span style={{ fontSize: '7px', fontWeight: 800, color: '#B71C1C', background: 'rgba(255,100,130,0.28)', borderRadius: '2px', padding: '0 2px', lineHeight: '11px' }}>
                {(anniDatesMap[dateStr]?.[0]?.name || '기').charAt(0)}
              </span>
            )}
            {hasAccepted && (
              <span style={{ fontSize: '7px', fontWeight: 800, color: '#1B5E20', background: 'rgba(100,210,100,0.28)', borderRadius: '2px', padding: '0 2px', lineHeight: '11px' }}>
                {(allRequests.find(r => r.date === dateStr && (r.status === '수락' || r.status === 'accepted'))?.region || '♥').charAt(0)}
              </span>
            )}
            {hasSched && (
              <span style={{ fontSize: '7px', fontWeight: 800, color: '#0D47A1', background: 'rgba(100,160,255,0.28)', borderRadius: '2px', padding: '0 2px', lineHeight: '11px' }}>
                {(scheduleDatesMap[dateStr]?.[0]?.title || '일').charAt(0)}
              </span>
            )}
            {hasPending && (
              <span style={{ fontSize: '7px', fontWeight: 800, color: '#E65100', background: 'rgba(255,200,80,0.35)', borderRadius: '2px', padding: '0 2px', lineHeight: '11px' }}>대</span>
            )}
            {hasNoDiary && !hasAccepted && (
              <span style={{ fontSize: '7px', fontWeight: 800, color: '#BF360C', background: 'rgba(255,120,80,0.22)', borderRadius: '2px', padding: '0 2px', lineHeight: '11px' }}>📔</span>
            )}
          </div>
        </button>
      );
    }
    return cells;
  };

  const renderDetail = () => {
    if (!detailDate) return null;
    const [y, m, d] = detailDate.split('-');
    const annisOnDay = anniDatesMap[detailDate] || [];
    const schsOnDay = scheduleDatesMap[detailDate] || [];
    const reqsOnDay = allRequests.filter(r => r.date === detailDate && r.status === '수락');
    const pendingOnDay = allRequests.filter(r => r.date === detailDate && r.status === '대기');

    return (
      <>
        {annisOnDay.map(a => (
          <div key={a.id} className="anni-card" style={{ marginBottom: '8px', background: 'linear-gradient(135deg,#FFE4EC 0%,white 100%)', border: '1px solid rgba(255,180,200,0.3)' }}>
            <div className="anni-icon">{a.emoji}</div>
            <div><div className="anni-name">{a.name}</div></div>
          </div>
        ))}
        {schsOnDay.map(s => (
          <div key={s.id} className="card" style={{ background: 'linear-gradient(135deg,#E4F0FF 0%,white 100%)', border: '1px solid rgba(147,210,255,0.3)', marginBottom: '8px' }}>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>📋 {s.title}</div>
            {s.description && <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>{s.description}</div>}
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>{s.createdBy || ''}</div>
          </div>
        ))}
        {reqsOnDay.map(r => {
          const diary = allDiaries.find(x => x.reqId === r.id);
          return (
            <div key={r.id} className="card" style={{ background: 'linear-gradient(135deg,#E4FFE4 0%,white 100%)', border: '1px solid rgba(150,230,150,0.3)', marginBottom: '8px' }}>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>{r.time} · {r.theme}</div>
              <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>{r.region}{r.subLocation ? ' / ' + r.subLocation : ''}</div>
              {diary ? (
                <div style={{ marginTop: '10px', padding: '12px', background: 'var(--rose4)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>📔 {diary.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: '1.6', marginBottom: '6px' }}>{diary.content}</div>
                  <div style={{ fontSize: '13px', color: '#F4A300', marginBottom: '8px' }}>
                    {'★'.repeat(diary.star || 5)}{'☆'.repeat(5 - (diary.star || 5))}
                  </div>
                  {(diary.comments || []).map((c, ci) => (
                    <div key={ci} className="comment-item">
                      <span className="comment-author">{c.author}</span>
                      <span className="comment-text">{c.text}</span>
                    </div>
                  ))}
                  <div className="comment-row" style={{ marginTop: '8px' }}>
                    <input
                      type="text"
                      className="form-input comment-input"
                      placeholder="댓글 달기..."
                      style={{ fontSize: '13px', padding: '8px 12px' }}
                      value={commentInputs[diary.id] || ''}
                      onChange={e => setCommentInputs(prev => ({ ...prev, [diary.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleSendComment(diary.id); }}
                    />
                    <button className="btn btn-rose btn-sm" onClick={() => handleSendComment(diary.id)}>↑</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-outline btn-sm btn-full" style={{ marginTop: '8px' }} onClick={() => { setShowDetailModal(false); onOpenDiary(r.id, r.date); }}>
                  일기 쓰기 📔
                </button>
              )}
            </div>
          );
        })}
        {pendingOnDay.map(r => (
          <div key={r.id} className="card" style={{ background: 'linear-gradient(135deg,#FFF9E4 0%,white 100%)', border: '1px solid rgba(255,220,50,0.25)', marginBottom: '8px' }}>
            <div style={{ fontWeight: 700 }}>{r.time} · {r.theme}</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{r.fromUser} → {r.toUser} (대기 중)</div>
          </div>
        ))}
        {annisOnDay.length === 0 && schsOnDay.length === 0 && reqsOnDay.length === 0 && pendingOnDay.length === 0 && (
          <div className="empty-state">이 날에는 일정이 없어요</div>
        )}
      </>
    );
  };

  const [y, m, d] = detailDate ? detailDate.split('-') : ['', '', ''];
  const detailTitle = detailDate ? `${y}년 ${parseInt(m)}월 ${parseInt(d)}일` : '';

  return (
    <div id="page-calendar" className="page active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div className="page-title" style={{ margin: 0 }}>달력 📅</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline btn-sm" onClick={() => { setSchDate(new Date().toISOString().split('T')[0]); setShowSchModal(true); }}>일정 추가</button>
          <button className="btn btn-rose btn-sm" onClick={() => setShowAnniModal(true)}>기념일 추가</button>
        </div>
      </div>

      <div className="card">
        <div className="cal-header">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <div className="cal-month">{calYear}년 {MONTHS[calMonth]}</div>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
        </div>
        <div className="cal-grid">{renderCalCells()}</div>
        <div className="cal-legend">
          <div className="cal-legend-item">
            <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#FFE4EC', border: '1px solid #F8B4CC', flexShrink: 0 }} /> 기념일
          </div>
          <div className="cal-legend-item">
            <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#E4F0FF', border: '1px solid #A8C8F0', flexShrink: 0 }} /> 일기
          </div>
          <div className="cal-legend-item">
            <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#FFF9E4', border: '1px solid #F0D890', flexShrink: 0 }} /> 일정
          </div>
        </div>
      </div>

      <div className="section-label">기념일</div>
      {allAnniversaries.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {allAnniversaries.map(a => (
            <div key={a.id} style={{ background: 'white', borderRadius: '14px', padding: '12px 14px', border: '1px solid var(--border)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span style={{ fontSize: '24px', lineHeight: 1 }}>{a.emoji}</span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button onClick={() => handleEditAnni(a)} style={{ background: 'none', border: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--text3)', padding: '2px 5px', borderRadius: '4px' }}>✏️</button>
                  <button onClick={() => handleDeleteAnni(a.id)} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--text3)', padding: '2px 5px', borderRadius: '4px', lineHeight: 1 }}>×</button>
                </div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '6px' }}>{a.date}{a.repeat ? ' · 매년' : ''}</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--rose)' }}>{getDday(a.date, a.repeat)}</div>
            </div>
          ))}
        </div>
      ) : <div className="empty-state">기념일을 추가해봐요 🎂</div>}

      {/* 기념일 추가/수정 모달 */}
      <div className={'modal-bg' + (showAnniModal ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) { setShowAnniModal(false); setEditAnniId(null); setAnniName(''); setAnniDate(''); setAnniEmoji('🎂'); setAnniRepeat(false); } }}>
        <div className="modal">
          <div className="modal-bar" />
          <div className="modal-title">{editAnniId ? '기념일 수정 ✏️' : '기념일 추가 🎂'}</div>
          <div className="form-group">
            <label className="form-label">기념일 이름</label>
            <input type="text" className="form-input" placeholder="예) 100일, 첫 만남" value={anniName} onChange={e => setAnniName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">날짜</label>
            <input type="date" className="form-input" value={anniDate} onChange={e => setAnniDate(e.target.value)} style={{ fontSize: '14px' }} />
          </div>
          <div className="form-group">
            <label className="form-label">이모지</label>
            <input type="text" className="form-input" placeholder="🎂" maxLength={2} value={anniEmoji} onChange={e => setAnniEmoji(e.target.value)} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input type="checkbox" checked={anniRepeat} onChange={e => setAnniRepeat(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--rose)' }} id="anni-repeat-ck" />
            <label htmlFor="anni-repeat-ck" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text2)', cursor: 'pointer' }}>매년 반복</label>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline btn-full" onClick={() => { setShowAnniModal(false); setEditAnniId(null); setAnniName(''); setAnniDate(''); setAnniEmoji('🎂'); setAnniRepeat(false); }}>취소</button>
            <button className="btn btn-rose btn-full" onClick={handleSaveAnni}>{editAnniId ? '수정' : '저장'}</button>
          </div>
        </div>
      </div>

      {/* 일정 추가 모달 */}
      <div className={'modal-bg' + (showSchModal ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) setShowSchModal(false); }}>
        <div className="modal">
          <div className="modal-bar" />
          <div className="modal-title">일정 추가 📋</div>
          <div className="form-group">
            <label className="form-label">제목</label>
            <input type="text" className="form-input" placeholder="일정 제목" value={schTitle} onChange={e => setSchTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">기간</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="date" className="form-input" value={schDate} onChange={e => setSchDate(e.target.value)} style={{ flex: 1, minWidth: 0, fontSize: '14px' }} />
              <span style={{ fontSize: '12px', color: 'var(--text3)', flexShrink: 0 }}>~</span>
              <input type="date" className="form-input" value={schEndDate} min={schDate} onChange={e => setSchEndDate(e.target.value)} style={{ flex: 1, minWidth: 0, fontSize: '14px' }} placeholder="종료일 (선택)" />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>하루 일정이면 종료일 생략 가능</div>
          </div>
          <div className="form-group">
            <label className="form-label">내용 (선택)</label>
            <textarea className="form-input" placeholder="간단한 메모..." value={schDesc} onChange={e => setSchDesc(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline btn-full" onClick={() => setShowSchModal(false)}>취소</button>
            <button className="btn btn-rose btn-full" onClick={handleSaveSch}>저장</button>
          </div>
        </div>
      </div>

      {/* 날짜 상세 모달 */}
      <div className={'modal-bg' + (showDetailModal ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) setShowDetailModal(false); }}>
        <div className="modal">
          <div className="modal-bar" />
          <div className="modal-title">{detailTitle}</div>
          {renderDetail()}
          <button className="btn btn-outline btn-full" style={{ marginTop: '16px' }} onClick={() => setShowDetailModal(false)}>닫기</button>
        </div>
      </div>
    </div>
  );
}
