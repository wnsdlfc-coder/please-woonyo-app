'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  collection, doc, setDoc, updateDoc, deleteDoc, addDoc,
  getDocs, query, where, serverTimestamp, getDoc
} from 'firebase/firestore';
import { arrayUnion } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { formatTime } from '@/lib/utils';

interface ChecklistItem { text: string; done: boolean; important: boolean; }
interface Request {
  id: string; fromUser: string; toUser: string;
  date: string; time: string; theme: string; region: string;
  subLocation?: string; message?: string; status: string;
  checklist?: ChecklistItem[];
}
interface Diary {
  id: string; reqId?: string; date: string; title: string; content: string;
  star?: number; author?: string; region?: string; tags?: string[];
  comments?: { author: string; text: string; createdAt: string }[];
}
interface Message {
  id: string; fromUser: string; toUser?: string; text: string;
  isLetter?: boolean; chatRoomId?: string;
  createdAt: { seconds?: number } | null;
  readAt: { seconds?: number } | null;
  selfDestruct?: boolean;
}
interface Member { nick: string; email: string; uid: string; }

interface MyPageProps {
  currentUser: { uid: string; email: string | null; photoURL: string | null };
  currentNick: string;
  currentCoupleCode: string;
  allRequests: Request[];
  allDiaries: Diary[];
  allMessages: Message[];
  allPlaces: { id: string; category: string }[];
  activeMyTab: string;
  onChangeNick: (newNick: string) => void;
  onSwitchRoom: (code: string, nick: string) => void;
  showToast: (msg: string, isErr?: boolean) => void;
  showConfirm: (msg: string, onOk: () => void) => void;
  onOpenDiary: (reqId: string, date?: string) => void;
  onSendMessage: (text: string, selfDestruct: boolean) => void;
}

type MyTab = 'received' | 'sent' | 'dates' | 'diaries' | 'stats' | 'letters';
type FilterType = '전체' | '대기' | '수락' | '반려';

const THEME_EMOJI: Record<string, string> = {
  '맛집탐방': '🍽️', '카페': '☕', '드라이브': '🚗', '액티비티': '🎯',
  '힐링': '🌿', '문화생활': '🎬', '집데이트': '🏠', '로맨틱': '💕',
};

export default function MyPage({
  currentUser, currentNick, currentCoupleCode,
  allRequests, allDiaries, allMessages, allPlaces,
  activeMyTab, onChangeNick, onSwitchRoom,
  showToast, showConfirm, onOpenDiary, onSendMessage,
}: MyPageProps) {
  const [myTab, setMyTab] = useState<MyTab>((activeMyTab as MyTab) || 'received');
  const [myFilter, setMyFilter] = useState<FilterType>('전체');
  const [members, setMembers] = useState<Member[]>([]);
  const [roomTitle, setRoomTitle] = useState('우리의 방');
  const [editRoomTitle, setEditRoomTitle] = useState(false);
  const [roomTitleInput, setRoomTitleInput] = useState('');
  const [changeNickOpen, setChangeNickOpen] = useState(false);
  const [newNick, setNewNick] = useState('');
  const [nickErr, setNickErr] = useState('');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // 카테고리 모달
  const [contentModalOpen, setContentModalOpen] = useState(false);
  // 커플코드 표시 여부
  const [codeVisible, setCodeVisible] = useState(false);
  // 방문 통계
  const [visitsData, setVisitsData] = useState<Record<string, Record<string, number>>>({});

  // 다른 방 입장
  const [showJoinOtherModal, setShowJoinOtherModal] = useState(false);
  const [joinOtherCode, setJoinOtherCode] = useState('');
  const [joinOtherStep, setJoinOtherStep] = useState<'input' | 'nick'>('input');
  const [joinOtherMembers, setJoinOtherMembers] = useState<string[]>([]);
  const [joinOtherNick, setJoinOtherNick] = useState('');
  const [joinOtherNewNick, setJoinOtherNewNick] = useState('');
  const [joinOtherErr, setJoinOtherErr] = useState(false);

  // 새 방 만들기
  const [showCreateNewModal, setShowCreateNewModal] = useState(false);
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomNick, setNewRoomNick] = useState(currentNick);

  // 쪽지
  const [letterSubTab, setLetterSubTab] = useState<'received' | 'sent'>('received');
  const [letterWriteOpen, setLetterWriteOpen] = useState(false);
  const [letterInput, setLetterInput] = useState('');

  const handleSendLetter = async () => {
    const text = letterInput.trim();
    if (!text) return;
    const partner = members.find(m => m.nick !== currentNick)?.nick || '';
    try {
      await addDoc(collection(db, 'notes'), {
        fromUser: currentNick, toUser: partner, coupleCode: currentCoupleCode,
        text, isLetter: true, createdAt: serverTimestamp(), readAt: null,
      });
      setLetterInput(''); setLetterWriteOpen(false);
      showToast('쪽지를 보냈어요 💌');
    } catch { showToast('전송 실패', true); }
  };

  useEffect(() => {
    const tab = (activeMyTab as MyTab) || 'received';
    setMyTab(tab);
    // 외부(홈 등)에서 탭 지정 시 모달 자동 열기
    if (activeMyTab && activeMyTab !== 'received') {
      setContentModalOpen(true);
    }
  }, [activeMyTab]);
  useEffect(() => { loadRoomInfo(); }, [currentCoupleCode, currentNick]); // eslint-disable-line

  // 쪽지함 열면 받은 쪽지 읽음 처리
  useEffect(() => {
    if (myTab === 'letters' && contentModalOpen) {
      allMessages.filter(m => m.isLetter && m.fromUser !== currentNick && !m.readAt).forEach(m => {
        updateDoc(doc(db, 'notes', m.id), { readAt: serverTimestamp() }).catch(() => {});
      });
    }
  }, [myTab, contentModalOpen]); // eslint-disable-line


  const loadRoomInfo = async () => {
    const roomDoc = await getDoc(doc(db, 'rooms', currentCoupleCode));
    const roomData = roomDoc.exists() ? roomDoc.data() : {};
    setRoomTitle(roomData.title || '우리의 방');
    setRoomTitleInput(roomData.title || '우리의 방');
    setVisitsData(roomData.visits || {});
    const kickedMembers: string[] = roomData.kickedMembers || [];
    const membersSnap = await getDocs(query(collection(db, 'users'), where('coupleCode', '==', currentCoupleCode)));
    const seen = new Set<string>();
    const mems: Member[] = membersSnap.docs
      .map(d => ({ nick: d.data().nickname || d.id, email: d.data().email || '', uid: d.data().uid || '' }))
      .filter(m => {
        if (seen.has(m.nick) || kickedMembers.includes(m.nick)) return false;
        seen.add(m.nick);
        return true;
      });
    setMembers(mems);
  };

  const handleKick = async (nick: string) => {
    showConfirm(`${nick}님을 방에서 내보낼까요?`, async () => {
      try {
        await updateDoc(doc(db, 'rooms', currentCoupleCode), { kickedMembers: arrayUnion(nick) });
        showToast(`${nick}님을 내보냈어요`);
        loadRoomInfo();
      } catch (e: unknown) {
        const err = e as { message?: string };
        showToast('내보내기 실패: ' + (err.message || ''), true);
      }
    });
  };

  const handleSaveRoomTitle = async () => {
    if (!roomTitleInput.trim()) { showToast('방 이름을 입력해주세요', true); return; }
    await setDoc(doc(db, 'rooms', currentCoupleCode), { title: roomTitleInput.trim() }, { merge: true });
    setRoomTitle(roomTitleInput.trim());
    setEditRoomTitle(false);
    showToast('방 이름이 변경됐어요 💕');
  };

  const handleSaveNick = async () => {
    setNickErr('');
    if (!newNick.trim()) { setNickErr('닉네임을 입력해주세요'); return; }
    if (newNick.trim() === currentNick) { setChangeNickOpen(false); return; }
    try {
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: newNick.trim() });
      await setDoc(doc(db, 'users', currentUser.uid), { nickname: newNick.trim(), updatedAt: serverTimestamp() }, { merge: true });
      await setDoc(doc(db, 'users', newNick.trim()), { uid: currentUser.uid, nickname: newNick.trim(), coupleCode: currentCoupleCode, email: currentUser.email || '', kicked: false }, { merge: true });
      if (currentNick && currentNick !== newNick.trim()) {
        setDoc(doc(db, 'users', currentNick), { coupleCode: '', nickname: newNick.trim() }, { merge: true }).catch(() => {});
      }
      localStorage.setItem('nick_' + currentUser.uid, newNick.trim());
      onChangeNick(newNick.trim());
      setChangeNickOpen(false);
      showToast('닉네임이 변경됐어요 ✓');
      loadRoomInfo();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setNickErr('변경 실패: ' + (err.message || ''));
    }
  };

  const handleJoinOtherVerify = async () => {
    if (joinOtherCode.length !== 6) { showToast('6자리 코드를 입력해주세요', true); return; }
    if (joinOtherCode === currentCoupleCode) { showToast('현재 방이에요', true); return; }
    const snap = await getDocs(query(collection(db, 'users'), where('coupleCode', '==', joinOtherCode)));
    if (snap.empty) { setJoinOtherErr(true); return; }
    setJoinOtherErr(false);
    const seen = new Set<string>();
    const ms = snap.docs.map(d => d.data().nickname || d.id).filter(n => { if (seen.has(n)) return false; seen.add(n); return true; });
    setJoinOtherMembers(ms);
    setJoinOtherStep('nick');
  };

  const handleConfirmJoinOther = async () => {
    if (joinOtherStep === 'input') { handleJoinOtherVerify(); return; }
    let nick = joinOtherNick;
    if (nick === '__new__') nick = joinOtherNewNick.trim();
    if (!nick) { showToast('닉네임을 선택하거나 입력해주세요', true); return; }
    if (!joinOtherMembers.includes(nick) && joinOtherMembers.length >= 2) {
      showToast('이 방은 이미 2명이에요 💑', true); return;
    }
    setShowJoinOtherModal(false);
    onSwitchRoom(joinOtherCode, nick);
  };

  const handleCreateNewRoom = () => {
    setNewRoomCode(String(Math.floor(100000 + Math.random() * 900000)));
    setNewRoomNick(currentNick);
    setShowCreateNewModal(true);
  };

  const handleConfirmCreateNew = async () => {
    if (!newRoomNick.trim()) { showToast('닉네임을 입력해주세요', true); return; }
    setShowCreateNewModal(false);
    onSwitchRoom(newRoomCode, newRoomNick.trim());
  };

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
  const handleReturn = (id: string) => {
    showConfirm('수락한 신청을 반려할까요?', async () => {
      await updateDoc(doc(db, 'requests', id), { status: '반려' });
      showToast('반려했어요');
    });
  };
  const handleCancel = (id: string) => {
    showConfirm('신청을 취소할까요?', async () => {
      await deleteDoc(doc(db, 'requests', id));
      showToast('신청이 취소됐어요');
    });
  };
  const handleDeleteAccepted = (id: string) => {
    showConfirm('데이트 기록을 삭제할까요?\n연결된 일기는 남아 있어요.', async () => {
      await deleteDoc(doc(db, 'requests', id));
      showToast('삭제됐어요');
    });
  };
  const handleCheckItem = async (req: Request, idx: number) => {
    const cl = (req.checklist || []).map((c, i) => i === idx ? { ...c, done: !c.done } : c);
    await updateDoc(doc(db, 'requests', req.id), { checklist: cl });
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


  function statusBadge(status: string) {
    const map: Record<string, string> = { '대기': 's-pending', '수락': 's-accepted', '거절': 's-rejected', '취소': 's-canceled', '반려': 's-returned' };
    return <span className={'sbadge ' + (map[status] || 's-pending')}>{status}</span>;
  }

  const renderReqCard = (r: Request, showActions: boolean) => (
    <div key={r.id} className="req-card">
      <div className="req-from">{r.fromUser} → {r.toUser}</div>
      <div className="req-date-big">{r.date} {r.time}</div>
      <div className="req-info">{r.theme} · {r.region}{r.subLocation ? ' / ' + r.subLocation : ''}</div>
      {r.message && (
        <div style={{ fontSize: '13px', color: 'var(--text2)', fontStyle: 'italic', marginBottom: '10px', padding: '10px 12px', background: 'var(--rose4)', borderRadius: '10px' }}>
          &ldquo;{r.message}&rdquo;
        </div>
      )}
      {showActions && r.status === '대기' ? (
        <div className="req-actions">
          <button className="btn btn-rose btn-sm" onClick={() => handleAccept(r.id)}>수락 💕</button>
          <button className="btn btn-outline btn-sm" onClick={() => handleReject(r.id)}>거절</button>
        </div>
      ) : (r.status === '수락' || r.status === 'accepted') ? (
        <div className="req-actions">
          {statusBadge(r.status)}
          {r.toUser === currentNick && (
            <button className="btn btn-outline btn-xs" style={{ marginLeft: '8px' }} onClick={() => handleReturn(r.id)}>반려</button>
          )}
          <button className="btn btn-outline btn-xs" style={{ marginLeft: '6px', color: 'var(--text3)' }} onClick={() => handleDeleteAccepted(r.id)}>🗑️ 삭제</button>
        </div>
      ) : statusBadge(r.status)}
    </div>
  );

  const renderDiaryCard = (d: Diary) => (
    <div key={d.id} className="diary-card">
      <div className="diary-date-lbl">
        {d.date} · {d.author || ''}
        {d.region && <span style={{ display: 'inline-block', background: 'var(--rose4)', color: 'var(--rose)', borderRadius: '12px', padding: '2px 9px', fontSize: '11px', fontWeight: 700, marginLeft: '6px' }}>📍{d.region}</span>}
      </div>
      <div className="diary-title">{d.title}</div>
      <div className="diary-body">{d.content}</div>
      <div className="diary-stars">{'★'.repeat(d.star || 5)}{'☆'.repeat(5 - (d.star || 5))}</div>
      {d.tags && d.tags.length > 0 && (
        <div className="diary-tags">{d.tags.map(t => <span key={t} className="diary-tag">#{t.trim()}</span>)}</div>
      )}
      <div className="comment-area">
        {(d.comments || []).map((c, i) => (
          <div key={i} className="comment-item">
            <span className="comment-author">{c.author}</span>
            <span className="comment-text">{c.text}</span>
          </div>
        ))}
        <div className="comment-row">
          <input type="text" className="form-input comment-input" placeholder="댓글 달기..." style={{ fontSize: '13px', padding: '8px 12px' }}
            value={commentInputs[d.id] || ''}
            onChange={e => setCommentInputs(prev => ({ ...prev, [d.id]: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') handleSendComment(d.id); }} />
          <button className="btn btn-rose btn-sm" onClick={() => handleSendComment(d.id)}>↑</button>
        </div>
      </div>
    </div>
  );

  const accepted = allRequests.filter(r => r.status === '수락' || r.status === '확정');
  const filterReqs = (list: Request[]) => myFilter === '전체' ? list : list.filter(r => r.status === myFilter);

  const renderContent = () => {
    // ── 받은 신청 ──
    if (myTab === 'received') {
      const list = filterReqs(allRequests.filter(r => r.toUser === currentNick));
      return list.length ? list.map(r => renderReqCard(r, r.status === '대기')) : <div className="empty-state">받은 신청이 없어요</div>;
    }

    // ── 보낸 신청 ──
    if (myTab === 'sent') {
      const list = filterReqs(allRequests.filter(r => r.fromUser === currentNick));
      return list.length ? list.map(r => (
        <div key={r.id}>
          {renderReqCard(r, false)}
          {r.status === '대기' && (
            <button className="btn btn-outline btn-sm btn-full" style={{ marginTop: '-4px', marginBottom: '10px' }} onClick={() => handleCancel(r.id)}>신청 취소</button>
          )}
        </div>
      )) : <div className="empty-state">보낸 신청이 없어요</div>;
    }

    // ── 데이트 기록 ──
    if (myTab === 'dates') {
      const list = allRequests.filter(r => r.status === '수락').sort((a, b) => b.date.localeCompare(a.date));
      return list.length ? list.map(r => {
        const diary = allDiaries.find(x => x.reqId === r.id);
        return (
          <div key={r.id} className="date-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="date-card-date">{r.date} {r.time}</div>
                <div className="date-card-info">{THEME_EMOJI[r.theme] || ''} {r.theme} · {r.region}{r.subLocation ? ' / ' + r.subLocation : ''}</div>
              </div>
              <button
                onClick={() => handleDeleteAccepted(r.id)}
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--text3)', padding: '4px', lineHeight: 1, flexShrink: 0 }}
                title="삭제"
              >🗑️</button>
            </div>
            {diary
              ? <div style={{ background: 'var(--rose4)', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: 'var(--text2)', marginTop: '8px' }}>📔 {diary.title}</div>
              : <button className="btn btn-outline btn-sm btn-full" style={{ marginTop: '8px' }} onClick={() => onOpenDiary(r.id, r.date)}>일기 쓰기 📔</button>
            }
          </div>
        );
      }) : <div className="empty-state">데이트 기록이 없어요</div>;
    }

    // ── 일기 ──
    if (myTab === 'diaries') {
      return allDiaries.length ? allDiaries.map(d => renderDiaryCard(d)) : <div className="empty-state">아직 일기가 없어요 📔</div>;
    }

    // ── 쪽지 ──
    if (myTab === 'letters') {
      const letters = allMessages.filter(m => m.isLetter)
        .sort((a, b) => ((b.createdAt as { seconds?: number })?.seconds || 0) - ((a.createdAt as { seconds?: number })?.seconds || 0));
      const list = letterSubTab === 'received'
        ? letters.filter(m => m.fromUser !== currentNick)
        : letters.filter(m => m.fromUser === currentNick);
      return (
        <div>
          <button className="btn btn-rose btn-sm btn-full" style={{ marginBottom: '14px' }} onClick={() => setLetterWriteOpen(true)}>✉️ 쪽지 쓰기</button>
          {list.length === 0
            ? <div className="empty-state">{letterSubTab === 'received' ? '받은 쪽지가 없어요' : '보낸 쪽지가 없어요'}</div>
            : list.map(m => {
                const secs = (m.createdAt as { seconds?: number })?.seconds;
                const dateStr = secs ? new Date(secs * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                const isUnread = letterSubTab === 'received' && !m.readAt;
                return (
                  <div key={m.id} className="card" style={{ marginBottom: '8px', borderLeft: isUnread ? '3px solid var(--rose)' : '3px solid transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--rose)' }}>
                        {isUnread && <span style={{ background: 'var(--rose)', color: 'white', borderRadius: '8px', padding: '1px 6px', fontSize: '10px', marginRight: '6px' }}>NEW</span>}
                        {letterSubTab === 'received' ? `from. ${m.fromUser}` : `to. ${m.toUser || '상대방'}`}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{dateStr}</div>
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.text}</div>
                  </div>
                );
              })
          }
        </div>
      );
    }

    // ── 통계 ──
    if (myTab === 'stats') {
      const partner = members.find(m => m.nick !== currentNick)?.nick || '상대방';
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7);
      const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

      // 이번 달 대결 데이터
      const myReqs = allRequests.filter(r => r.fromUser === currentNick && r.date.startsWith(currentMonth)).length;
      const ptReqs = allRequests.filter(r => r.fromUser === partner && r.date.startsWith(currentMonth)).length;
      const myDiar = allDiaries.filter(d => d.author === currentNick && d.date.startsWith(currentMonth)).length;
      const ptDiar = allDiaries.filter(d => d.author === partner && d.date.startsWith(currentMonth)).length;
      const toMon = (sec?: number) => sec ? new Date(sec * 1000).toISOString().slice(0, 7) : '';
      const myMsgs = allMessages.filter(m => m.fromUser === currentNick && toMon((m.createdAt as { seconds?: number })?.seconds) === currentMonth).length;
      const ptMsgs = allMessages.filter(m => m.fromUser === partner && toMon((m.createdAt as { seconds?: number })?.seconds) === currentMonth).length;
      const myVisit = (visitsData[currentNick] || {})[currentMonth] || 0;
      const ptVisit = (visitsData[partner] || {})[currentMonth] || 0;
      const myTotal = myReqs + myDiar + myMsgs + myVisit;
      const ptTotal = ptReqs + ptDiar + ptMsgs + ptVisit;
      const winner = myTotal > ptTotal ? currentNick : myTotal < ptTotal ? partner : null;

      // 가로 비율 바 컴포넌트
      const StatBar = ({ label, myVal, ptVal }: { label: string; myVal: number; ptVal: number }) => {
        const total = myVal + ptVal;
        if (total === 0) return (
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.3px', marginBottom: '6px' }}>{label}</div>
            <div style={{ height: '38px', background: '#F0F0F0', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text3)' }}>아직 없어요</span>
            </div>
          </div>
        );
        const myPct = Math.round((myVal / total) * 100);
        const ptPct = 100 - myPct;
        return (
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.3px', marginBottom: '7px' }}>{label}</div>
            <div style={{ display: 'flex', height: '38px', borderRadius: '20px', overflow: 'hidden' }}>
              <div style={{ flex: myPct || 0.5, background: '#5B9BD5', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '4px' }}>
                {myPct >= 18 && <span style={{ color: 'white', fontSize: '11px', fontWeight: 800, padding: '0 6px' }}>{myVal}회</span>}
              </div>
              <div style={{ flex: ptPct || 0.5, background: 'var(--rose)', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '4px' }}>
                {ptPct >= 18 && <span style={{ color: 'white', fontSize: '11px', fontWeight: 800, padding: '0 6px' }}>{ptVal}회</span>}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontSize: '11px' }}>
              <span style={{ color: '#5B9BD5', fontWeight: 700 }}>{currentNick} {myPct}%</span>
              <span style={{ color: 'var(--rose)', fontWeight: 700 }}>{partner} {ptPct}%</span>
            </div>
          </div>
        );
      };

      // 전체 통계
      const totalDates = allRequests.filter(r => r.status === '수락').length;
      const avgStar = allDiaries.length > 0 ? (allDiaries.reduce((s, d) => s + (d.star || 5), 0) / allDiaries.length).toFixed(1) : null;
      const themeCounts = allRequests.filter(r => r.status === '수락').reduce((acc, r) => { if (r.theme) acc[r.theme] = (acc[r.theme] || 0) + 1; return acc; }, {} as Record<string, number>);
      const topThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const regionCounts = allRequests.filter(r => r.status === '수락' && r.region).reduce((acc, r) => { const reg = r.region.split(' · ')[0]; acc[reg] = (acc[reg] || 0) + 1; return acc; }, {} as Record<string, number>);
      const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const medals = ['🥇', '🥈', '🥉'];

      return (
        <div>
          {/* ── 이번 달 대결 ── */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.5px', marginBottom: '4px' }}>{monthLabel} 애정도</div>
            <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text)', marginBottom: '6px' }}>
              {roomTitle}에서 더 좋아하는 사람은? 💕
            </div>
            {/* 범례 */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#5B9BD5', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text2)' }}>{currentNick}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--rose)', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text2)' }}>{partner}</span>
              </div>
            </div>

            <StatBar label="데이트 신청" myVal={myReqs} ptVal={ptReqs} />
            <StatBar label="일기 작성" myVal={myDiar} ptVal={ptDiar} />
            <StatBar label="채팅 전송" myVal={myMsgs} ptVal={ptMsgs} />
            <StatBar label="앱 방문" myVal={myVisit} ptVal={ptVisit} />

            {/* 승자 발표 */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', textAlign: 'center' }}>
              {winner ? (
                <>
                  <div style={{ fontSize: '30px', marginBottom: '6px' }}>👑</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: winner === currentNick ? '#5B9BD5' : 'var(--rose)' }}>{winner}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '3px' }}>
                    더 많이 좋아해요 💕
                  </div>
                </>
              ) : (myTotal + ptTotal > 0) ? (
                <>
                  <div style={{ fontSize: '28px', marginBottom: '6px' }}>🤝</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text2)' }}>서로 똑같이 좋아해요 💕</div>
                </>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--text3)' }}>이번 달 기록이 없어요</div>
              )}
            </div>
          </div>

          {/* ── 전체 통계 ── */}
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.5px', marginBottom: '10px' }}>전체 기록</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            {[
              { val: totalDates, label: '함께한 데이트' },
              { val: allDiaries.length, label: '기록한 일기' },
              { val: avgStar ? `★${avgStar}` : '-', label: '평균 별점' },
              { val: allPlaces.filter(p => p.category === 'visited').length, label: '방문한 장소' },
            ].map(({ val, label }) => (
              <div key={label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                <div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--rose)', lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '5px' }}>{label}</div>
              </div>
            ))}
          </div>

          {topThemes.length > 0 && (
            <div className="card" style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.5px', marginBottom: '14px' }}>즐겨하는 데이트</div>
              {topThemes.map(([theme, count], i) => (
                <div key={theme} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: i < topThemes.length - 1 ? '10px' : 0 }}>
                  <span style={{ fontSize: '18px' }}>{medals[i]}</span>
                  <span style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>{THEME_EMOJI[theme] || ''} {theme}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text3)' }}>{count}회</span>
                </div>
              ))}
            </div>
          )}

          {topRegions.length > 0 && (
            <div className="card">
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.5px', marginBottom: '14px' }}>자주 간 지역</div>
              {topRegions.map(([region, count], i) => (
                <div key={region} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: i < topRegions.length - 1 ? '10px' : 0 }}>
                  <span style={{ fontSize: '18px' }}>{medals[i]}</span>
                  <span style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>{region}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text3)' }}>{count}회</span>
                </div>
              ))}
            </div>
          )}

          {totalDates === 0 && (
            <div className="empty-state">데이트를 기록하면<br />통계가 나타나요 💕</div>
          )}
        </div>
      );
    }
  };

  return (
    <div id="page-my" className="page active">
      <div className="page-title">마이페이지</div>

      {/* 로그인 정보 — 가로 레이아웃 */}
      <div className="card" style={{ marginBottom: '12px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {currentUser.photoURL ? (
            <img src={currentUser.photoURL} alt="profile" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--rose2)', flexShrink: 0 }} />
          ) : (
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--rose4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>👤</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', marginBottom: '2px' }}>{currentNick}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.email || '(이메일 없음)'}</div>
          </div>
          <button className="btn btn-outline btn-xs" style={{ flexShrink: 0 }} onClick={() => { setChangeNickOpen(v => !v); setNickErr(''); setNewNick(currentNick); }}>닉네임 변경</button>
        </div>
        {changeNickOpen && (
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" className="form-input" placeholder="새 닉네임" maxLength={10} value={newNick}
                onChange={e => setNewNick(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveNick(); }}
                style={{ flex: 1, fontSize: '14px', padding: '8px 12px' }} />
              <button className="btn btn-rose btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={handleSaveNick}>저장</button>
            </div>
            {nickErr && <div className="err-msg" style={{ marginTop: '4px' }}>{nickErr}</div>}
          </div>
        )}
      </div>

      {/* 방 정보 */}
      <div className="card" style={{ marginBottom: '16px' }}>
        {/* 방 이름 + 커플 코드 한 줄 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: editRoomTitle ? '10px' : '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px', marginBottom: '2px' }}>ROOM</div>
            <div style={{ fontSize: '16px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roomTitle}</div>
          </div>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
            {codeVisible && (
              <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '3px', color: 'var(--rose)', fontVariantNumeric: 'tabular-nums' }}>{currentCoupleCode}</span>
            )}
            <button className="btn btn-outline btn-xs" onClick={() => setCodeVisible(v => !v)} style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
              {codeVisible ? '숨기기' : '코드'}
            </button>
            {codeVisible && (
              <button className="btn btn-outline btn-xs" style={{ fontSize: '11px' }} onClick={() => {
                navigator.clipboard.writeText(currentCoupleCode).then(() => showToast('복사됐어요! 📋')).catch(() => showToast(currentCoupleCode));
              }}>복사</button>
            )}
            <button className="btn btn-outline btn-xs" style={{ fontSize: '11px' }} onClick={() => setEditRoomTitle(v => !v)}>{editRoomTitle ? '취소' : '편집'}</button>
          </div>
        </div>
        {editRoomTitle && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input type="text" className="form-input" maxLength={20} placeholder="방 이름 (최대 20자)" value={roomTitleInput}
              onChange={e => setRoomTitleInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveRoomTitle(); }} style={{ flex: 1 }} />
            <button className="btn btn-rose btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={handleSaveRoomTitle}>저장</button>
          </div>
        )}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px', marginBottom: '8px' }}>MEMBERS</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', minHeight: '28px' }}>
            {members.map(m => (
              <div key={m.nick} style={{ background: 'var(--rose4)', borderRadius: '10px', padding: '8px 12px', flex: 1, minWidth: '120px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--rose)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nick}</div>
                  {m.nick !== currentNick && (
                    <button className="btn btn-outline btn-xs" style={{ fontSize: '10px', color: '#e74c3c', borderColor: '#e74c3c', flexShrink: 0, padding: '3px 7px' }} onClick={() => handleKick(m.nick)}>내보내기</button>
                  )}
                </div>
                {m.email && <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>}
              </div>
            ))}
            {members.length === 0 && <div style={{ color: 'var(--text3)', fontSize: '13px' }}>아직 멤버가 없어요</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => { setJoinOtherCode(''); setJoinOtherStep('input'); setJoinOtherErr(false); setJoinOtherMembers([]); setJoinOtherNick(''); setShowJoinOtherModal(true); }}>다른 방 입장</button>
          <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={handleCreateNewRoom}>새 방 만들기</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--rose)' }}>{accepted.length}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>데이트</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--rose)' }}>{allDiaries.length}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>일기</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--rose)' }}>{allPlaces.filter(p => p.category === 'visited').length}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>방문 장소</div>
          </div>
        </div>
      </div>

      {/* 카테고리 그리드 */}
      {(() => {
        const CATS: { tab: MyTab; label: string; count: number | null }[] = [
          { tab: 'received', label: '받은 신청', count: allRequests.filter(r => r.toUser === currentNick).length },
          { tab: 'sent',     label: '보낸 신청', count: allRequests.filter(r => r.fromUser === currentNick).length },
          { tab: 'dates',    label: '데이트 기록', count: allRequests.filter(r => r.status === '수락').length },
          { tab: 'diaries',  label: '일기',     count: allDiaries.length },
          { tab: 'stats',    label: '애정도',    count: null },
          { tab: 'letters',  label: '쪽지',      count: allMessages.filter(m => m.isLetter && m.fromUser !== currentNick && !m.readAt).length || allMessages.filter(m => m.isLetter).length },
        ];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {CATS.map(({ tab, label, count }) => (
              <button
                key={tab}
                onClick={() => { setMyTab(tab); setMyFilter('전체'); setContentModalOpen(true); }}
                style={{
                  padding: '16px 8px', borderRadius: '14px',
                  border: '1.5px solid var(--border)',
                  background: 'white', cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'center', transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>{label}</div>
                {count !== null && (
                  <div style={{ fontSize: '20px', fontWeight: 900, color: count > 0 ? 'var(--rose)' : 'var(--text3)' }}>{count}</div>
                )}
              </button>
            ))}
          </div>
        );
      })()}

      {/* 카테고리 콘텐츠 모달 */}
      {contentModalOpen && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setContentModalOpen(false); }}>
          <div className="modal" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-bar" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div className="modal-title" style={{ margin: 0 }}>
                {{ received: '💌 받은 신청', sent: '📤 보낸 신청', dates: '💕 데이트 기록', diaries: '📔 일기', stats: '📊 통계', letters: '✉️ 쪽지 보관함' }[myTab]}
              </div>
              <button onClick={() => setContentModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text3)', padding: '0 4px', lineHeight: 1 }}>×</button>
            </div>
            {(myTab === 'received' || myTab === 'sent') && (
              <div className="filter-row" style={{ marginBottom: '12px' }}>
                {(['전체', '대기', '수락', '반려'] as FilterType[]).map(f => (
                  <button key={f} className={'filter-btn' + (myFilter === f ? ' active' : '')} onClick={() => setMyFilter(f)}>{f}</button>
                ))}
              </div>
            )}
            {myTab === 'letters' && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {(['received', 'sent'] as const).map(t => (
                  <button key={t} onClick={() => setLetterSubTab(t)} style={{
                    padding: '5px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontWeight: 700, fontSize: '12px',
                    background: letterSubTab === t ? 'var(--rose)' : 'var(--border)',
                    color: letterSubTab === t ? 'white' : 'var(--text2)',
                  }}>{t === 'received' ? '받은 쪽지' : '보낸 쪽지'}</button>
                ))}
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto' }}>{renderContent()}</div>
          </div>
        </div>
      )}

      {/* 쪽지 쓰기 모달 */}
      <div className={'modal-bg' + (letterWriteOpen ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) setLetterWriteOpen(false); }}>
        <div className="modal">
          <div className="modal-bar" />
          <div className="modal-title">쪽지 쓰기 ✉️</div>
          <div className="form-group">
            <label className="form-label">내용</label>
            <textarea
              className="form-input"
              placeholder="전하고 싶은 말을 적어보세요..."
              rows={6}
              value={letterInput}
              onChange={e => setLetterInput(e.target.value)}
              style={{ resize: 'none', lineHeight: 1.7 }}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline btn-full" onClick={() => { setLetterWriteOpen(false); setLetterInput(''); }}>취소</button>
            <button className="btn btn-rose btn-full" onClick={handleSendLetter}>보내기 💌</button>
          </div>
        </div>
      </div>

      {/* 다른 방 입장 모달 */}
      <div className={'modal-bg' + (showJoinOtherModal ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) setShowJoinOtherModal(false); }}>
        <div className="modal">
          <div className="modal-bar" />
          <div className="modal-title">다른 방 입장</div>
          <div style={{ background: 'var(--rose4)', borderLeft: '3px solid var(--rose)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px' }}>
            현재 방 <strong style={{ letterSpacing: '3px', fontFamily: 'monospace', color: 'var(--rose)' }}>{currentCoupleCode}</strong> 에서 나가게 됩니다.
          </div>
          <div className="form-group">
            <label className="form-label">새 커플 코드 (6자리)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" className="form-input" maxLength={6} placeholder="000000" style={{ flex: 1, letterSpacing: '4px', fontSize: '20px', fontWeight: 800, textAlign: 'center' }}
                value={joinOtherCode} onChange={e => { setJoinOtherCode(e.target.value); setJoinOtherErr(false); }}
                disabled={joinOtherStep === 'nick'} onKeyDown={e => { if (e.key === 'Enter') handleJoinOtherVerify(); }} />
              <button className="btn btn-outline btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={handleJoinOtherVerify}>확인</button>
            </div>
            {joinOtherErr && <div className="err-msg">존재하지 않는 코드예요</div>}
          </div>
          {joinOtherStep === 'nick' && (
            <div className="form-group">
              <label className="form-label">닉네임 선택</label>
              <select className="form-input" value={joinOtherNick} onChange={e => setJoinOtherNick(e.target.value)}>
                <option value="">선택해주세요</option>
                {joinOtherMembers.map(m => <option key={m} value={m}>{m}</option>)}
                <option value="__new__">직접 입력...</option>
              </select>
              {joinOtherNick === '__new__' && (
                <input type="text" className="form-input" placeholder="직접 입력" value={joinOtherNewNick} onChange={e => setJoinOtherNewNick(e.target.value)} style={{ marginTop: '8px' }} />
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button className="btn btn-outline btn-full" onClick={() => setShowJoinOtherModal(false)}>취소</button>
            <button className="btn btn-rose btn-full" onClick={handleConfirmJoinOther}>입장하기 💕</button>
          </div>
        </div>
      </div>

      {/* 새 방 만들기 모달 */}
      <div className={'modal-bg' + (showCreateNewModal ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) setShowCreateNewModal(false); }}>
        <div className="modal">
          <div className="modal-bar" />
          <div className="modal-title">새 방 만들기</div>
          <div style={{ background: 'var(--rose4)', borderLeft: '3px solid var(--rose)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px' }}>
            현재 방 <strong style={{ letterSpacing: '3px', fontFamily: 'monospace', color: 'var(--rose)' }}>{currentCoupleCode}</strong> 에서 나가게 됩니다.
          </div>
          <div className="couple-code-box" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 700, letterSpacing: '1px', marginBottom: '8px' }}>새 커플 코드</div>
            <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '8px', color: 'var(--rose)', fontVariantNumeric: 'tabular-nums' }}>{newRoomCode}</div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: '10px' }} onClick={() => {
              navigator.clipboard.writeText(newRoomCode).then(() => showToast('코드 복사됨! 📋')).catch(() => showToast(newRoomCode));
            }}>복사 📋</button>
          </div>
          <div className="form-group">
            <label className="form-label">내 닉네임</label>
            <input type="text" className="form-input" placeholder="이름 입력" maxLength={10} value={newRoomNick} onChange={e => setNewRoomNick(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button className="btn btn-outline btn-full" onClick={() => setShowCreateNewModal(false)}>취소</button>
            <button className="btn btn-rose btn-full" onClick={handleConfirmCreateNew}>방 만들기 💕</button>
          </div>
        </div>
      </div>
    </div>
  );
}
