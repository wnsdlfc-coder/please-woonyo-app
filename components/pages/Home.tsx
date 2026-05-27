'use client';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getGreeting } from '@/lib/utils';

interface ChecklistItem {
  text: string;
  done: boolean;
  important: boolean;
}

interface Request {
  id: string;
  fromUser: string;
  toUser: string;
  date: string;
  time: string;
  theme: string;
  region: string;
  subLocation?: string;
  message?: string;
  status: string;
  checklist?: ChecklistItem[];
  coupleCode: string;
}

interface Diary {
  id: string;
  reqId?: string;
  date: string;
  title: string;
  content: string;
  star?: number;
  author?: string;
  region?: string;
}

interface Note {
  id: string;
  fromUser: string;
  toUser: string;
  text: string;
  read: boolean;
  createdAt?: { toDate?: () => Date; seconds?: number };
}

interface HomeProps {
  currentNick: string;
  allRequests: Request[];
  allDiaries: Diary[];
  allNotes: Note[];
  onNavigate: (page: 'home' | 'apply' | 'calendar' | 'map' | 'my') => void;
  onOpenDiaryShortcut: () => void;
  showToast: (msg: string, isErr?: boolean) => void;
  showConfirm: (msg: string, onOk: () => void) => void;
  onSwitchMyTab: (tab: string) => void;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    '대기': 's-pending', '수락': 's-accepted', '거절': 's-rejected', '취소': 's-canceled', '반려': 's-returned'
  };
  return <span className={'sbadge ' + (map[status] || 's-pending')}>{status}</span>;
}

export default function Home({
  currentNick, allRequests, allDiaries, allNotes,
  onNavigate, onOpenDiaryShortcut, showToast, showConfirm, onSwitchMyTab
}: HomeProps) {
  const today = new Date().toISOString().split('T')[0];
  const pending = allRequests.filter(r => r.status === '대기');
  const accepted = allRequests.filter(r => r.status === '수락');
  const incoming = pending.filter(r => r.toUser === currentNick);
  const upcoming = accepted.filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const recentDates = accepted
    .filter(r => r.date < today && r.region)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const unreadNotes = allNotes.filter(n => n.toUser === currentNick && !n.read).length;
  const noDiaryCount = accepted.filter(r => r.date < today && !allDiaries.some(d => d.reqId === r.id || d.date === r.date)).length;

  const handleAccept = async (id: string) => {
    await updateDoc(doc(db, 'requests', id), { status: '수락' });
    showToast('수락했어요! 💕');
  };

  const handleReject = (id: string) => {
    showConfirm('거절할까요?', async () => {
      await deleteDoc(doc(db, 'requests', id));
      showToast('거절했어요');
    });
  };

  const handleCheckItem = async (req: Request, idx: number) => {
    const cl = (req.checklist || []).map((c, i) =>
      i === idx ? { ...c, done: !c.done } : c
    );
    await updateDoc(doc(db, 'requests', req.id), { checklist: cl });
  };

  return (
    <div id="page-home" className="page active">
      <div className="hero">
        <div className="hero-greeting">{getGreeting()}</div>
        <div className="hero-name">{currentNick}님</div>
        <div className="hero-stats">
          <div>
            <div className="h-val">{accepted.length}</div>
            <div className="h-label">함께한 데이트</div>
          </div>
          <div>
            <div className="h-val">{pending.length}</div>
            <div className="h-label">대기중 신청</div>
          </div>
          <div>
            <div className="h-val">{allDiaries.length}</div>
            <div className="h-label">일기</div>
          </div>
        </div>
      </div>

      {noDiaryCount > 0 && (
        <div
          style={{ background: 'linear-gradient(135deg,#FF9A7B,#FF6B9D)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
          onClick={() => { onNavigate('my'); onSwitchMyTab('dates'); }}
        >
          📔 아직 일기를 안 쓴 날이 {noDiaryCount}일 있어요
        </div>
      )}

      {unreadNotes > 0 && (
        <div
          style={{ background: 'var(--rose4)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', color: 'var(--rose)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
          onClick={() => { onNavigate('my'); onSwitchMyTab('notes'); }}
        >
          💌 읽지 않은 쪽지 {unreadNotes}개가 있어요
        </div>
      )}

      <div className="section-label">받은 신청</div>
      {incoming.length ? incoming.map(r => (
        <div key={r.id} className="req-card">
          <div className="req-from">{r.fromUser} → {r.toUser}</div>
          <div className="req-date-big">{r.date} {r.time}</div>
          <div className="req-info">{r.theme} · {r.region}{r.subLocation ? ' / ' + r.subLocation : ''}</div>
          {r.message && (
            <div style={{ fontSize: '13px', color: 'var(--text2)', fontStyle: 'italic', marginBottom: '10px', padding: '10px 12px', background: 'var(--rose4)', borderRadius: '10px' }}>
              &ldquo;{r.message}&rdquo;
            </div>
          )}
          <div className="req-actions">
            <button className="btn btn-rose btn-sm" onClick={() => handleAccept(r.id)}>수락 💕</button>
            <button className="btn btn-outline btn-sm" onClick={() => handleReject(r.id)}>거절</button>
          </div>
        </div>
      )) : <div className="empty-state">아직 받은 신청이 없어요 💌</div>}

      <div className="section-label">다가오는 데이트</div>
      {upcoming.length ? upcoming.map(r => (
        <div key={r.id} className="date-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <div className="date-card-date">{r.date} {r.time}</div>
            <span className="sbadge s-accepted">확정 💕</span>
          </div>
          <div className="date-card-info">{r.theme} · {r.region}{r.subLocation ? ' / ' + r.subLocation : ''}</div>
          {(r.checklist || []).map((c, i) => (
            <div key={i} className="mini-item" onClick={() => handleCheckItem(r, i)}>
              <div className={'mini-chk' + (c.done ? ' done' : '')}>{c.done ? '✓' : ''}</div>
              <span className={'mini-txt' + (c.done ? ' done' : '')}>
                {c.important && <span style={{ color: '#F4A300' }}>★ </span>}{c.text}
              </span>
            </div>
          ))}
        </div>
      )) : <div className="empty-state">예정된 데이트가 없어요 🌸</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <div className="section-label" style={{ margin: 0 }}>최근 다녀온 곳</div>
        <button className="btn btn-outline btn-xs" onClick={onOpenDiaryShortcut}>일기 쓰기 📔</button>
      </div>
      <div style={{ marginTop: '10px' }}>
        {recentDates.length ? recentDates.map(r => {
          const diary = allDiaries.find(d => d.reqId === r.id || d.date === r.date);
          return (
            <div key={r.id} className="recent-date-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800 }}>{r.region}</div>
                <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{r.date}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{r.theme}{r.subLocation ? ' · ' + r.subLocation : ''}</div>
              {diary && <div style={{ fontSize: '12px', color: 'var(--rose)', marginTop: '6px' }}>📔 {diary.title}</div>}
            </div>
          );
        }) : <div className="empty-state" style={{ padding: '20px 0' }}>아직 다녀온 데이트가 없어요 🌸</div>}
      </div>
    </div>
  );
}
