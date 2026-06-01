'use client';
import { useState, useEffect } from 'react';
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
  star?: number; author?: string; region?: string;
  tags?: string[];
  comments?: { author: string; text: string; createdAt: string }[];
}
interface Note {
  id: string; fromUser: string; toUser: string; text: string; read: boolean;
  createdAt?: { toDate?: () => Date; seconds?: number };
}
interface Member { nick: string; email: string; uid: string; }

interface MyPageProps {
  currentUser: { uid: string; email: string | null; photoURL: string | null };
  currentNick: string;
  currentCoupleCode: string;
  allRequests: Request[];
  allDiaries: Diary[];
  allNotes: Note[];
  allPlaces: { id: string; category: string }[];
  activeMyTab: string;
  onChangeNick: (newNick: string) => void;
  onSwitchRoom: (code: string, nick: string) => void;
  showToast: (msg: string, isErr?: boolean) => void;
  showConfirm: (msg: string, onOk: () => void) => void;
  onOpenDiary: (reqId: string, date?: string) => void;
  onOpenNoteModal: () => void;
  onMarkNotesRead: () => void;
}

type MyTab = 'received' | 'sent' | 'dates' | 'diaries' | 'notes';
type FilterType = '전체' | '대기' | '수락' | '반려';

export default function MyPage({
  currentUser, currentNick, currentCoupleCode,
  allRequests, allDiaries, allNotes, allPlaces,
  activeMyTab, onChangeNick, onSwitchRoom,
  showToast, showConfirm, onOpenDiary, onOpenNoteModal, onMarkNotesRead
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

  // Join other room modal
  const [showJoinOtherModal, setShowJoinOtherModal] = useState(false);
  const [joinOtherCode, setJoinOtherCode] = useState('');
  const [joinOtherStep, setJoinOtherStep] = useState<'input' | 'nick'>('input');
  const [joinOtherMembers, setJoinOtherMembers] = useState<string[]>([]);
  const [joinOtherNick, setJoinOtherNick] = useState('');
  const [joinOtherNewNick, setJoinOtherNewNick] = useState('');
  const [joinOtherErr, setJoinOtherErr] = useState(false);

  // Create new room modal
  const [showCreateNewModal, setShowCreateNewModal] = useState(false);
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomNick, setNewRoomNick] = useState(currentNick);

  useEffect(() => {
    setMyTab((activeMyTab as MyTab) || 'received');
  }, [activeMyTab]);

  useEffect(() => {
    loadRoomInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCoupleCode, currentNick]);

  useEffect(() => {
    if (myTab === 'notes') {
      onMarkNotesRead();
    }
  }, [myTab, onMarkNotesRead]);

  const loadRoomInfo = async () => {
    const roomDoc = await getDoc(doc(db, 'rooms', currentCoupleCode));
    const roomData = roomDoc.exists() ? roomDoc.data() : {};
    setRoomTitle(roomData.title || '우리의 방');
    setRoomTitleInput(roomData.title || '우리의 방');
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
        await updateDoc(doc(db, 'rooms', currentCoupleCode), {
          kickedMembers: arrayUnion(nick),
        });
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
      await setDoc(doc(db, 'users', newNick.trim()), {
        uid: currentUser.uid, nickname: newNick.trim(),
        coupleCode: currentCoupleCode, email: currentUser.email || '', kicked: false
      }, { merge: true });
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
      showToast('이 방은 이미 2명이에요 💑', true);
      return;
    }
    setShowJoinOtherModal(false);
    onSwitchRoom(joinOtherCode, nick);
  };

  const handleCreateNewRoom = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setNewRoomCode(code);
    setNewRoomNick(currentNick);
    setShowCreateNewModal(true);
  };

  const handleConfirmCreateNew = async () => {
    if (!newRoomNick.trim()) { showToast('닉네임을 입력해주세요', true); return; }
    setShowCreateNewModal(false);
    onSwitchRoom(newRoomCode, newRoomNick.trim());
  };

  const handleCheckItem = async (req: Request, idx: number) => {
    const cl = (req.checklist || []).map((c, i) => i === idx ? { ...c, done: !c.done } : c);
    await updateDoc(doc(db, 'requests', req.id), { checklist: cl });
  };

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
    const map: Record<string, string> = {
      '대기': 's-pending', '수락': 's-accepted', '거절': 's-rejected', '취소': 's-canceled', '반려': 's-returned'
    };
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
      ) : r.status === '수락' && r.toUser === currentNick ? (
        <div className="req-actions">
          {statusBadge(r.status)}
          <button className="btn btn-outline btn-xs" style={{ marginLeft: '8px' }} onClick={() => handleReturn(r.id)}>반려</button>
        </div>
      ) : statusBadge(r.status)}
    </div>
  );

  const renderDiaryCard = (d: Diary) => {
    const relReq = allRequests.find(r => r.id === d.reqId || (r.date === d.date && (r.status === '수락' || r.status === 'accepted')));
    return (
      <div key={d.id} className="diary-card">
        <div className="diary-date-lbl">
          {d.date} · {d.author || ''}
          {relReq?.region && (
            <span style={{ display: 'inline-block', background: 'var(--rose4)', color: 'var(--rose)', borderRadius: '12px', padding: '2px 9px', fontSize: '11px', fontWeight: 700, marginLeft: '6px' }}>📍{relReq.region}</span>
          )}
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
            <input
              type="text"
              className="form-input comment-input"
              placeholder="댓글 달기..."
              style={{ fontSize: '13px', padding: '8px 12px' }}
              value={commentInputs[d.id] || ''}
              onChange={e => setCommentInputs(prev => ({ ...prev, [d.id]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleSendComment(d.id); }}
            />
            <button className="btn btn-rose btn-sm" onClick={() => handleSendComment(d.id)}>↑</button>
          </div>
        </div>
      </div>
    );
  };

  const accepted = allRequests.filter(r => r.status === '수락' || r.status === '확정');
  const filterReqs = (list: Request[]) => myFilter === '전체' ? list : list.filter(r => r.status === myFilter);

  const renderContent = () => {
    if (myTab === 'received') {
      const list = filterReqs(allRequests.filter(r => r.toUser === currentNick));
      return list.length ? list.map(r => renderReqCard(r, r.status === '대기')) : <div className="empty-state">받은 신청이 없어요</div>;
    }
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
    if (myTab === 'dates') {
      const list = allRequests.filter(r => r.status === '수락').sort((a, b) => b.date.localeCompare(a.date));
      return list.length ? list.map(r => {
        const diary = allDiaries.find(x => x.reqId === r.id);
        return (
          <div key={r.id} className="date-card">
            <div className="date-card-date">{r.date} {r.time}</div>
            <div className="date-card-info">{r.theme} · {r.region}{r.subLocation ? ' / ' + r.subLocation : ''}</div>
            {(r.checklist || []).map((c, i) => (
              <div key={i} className="mini-item" onClick={() => handleCheckItem(r, i)}>
                <div className={'mini-chk' + (c.done ? ' done' : '')}>{c.done ? '✓' : ''}</div>
                <span className={'mini-txt' + (c.done ? ' done' : '')}>{c.important && <span style={{ color: '#F4A300' }}>★ </span>}{c.text}</span>
              </div>
            ))}
            {diary
              ? <div style={{ background: 'var(--rose4)', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: 'var(--text2)', marginTop: '8px' }}>📔 {diary.title}</div>
              : <button className="btn btn-outline btn-sm btn-full" style={{ marginTop: '8px' }} onClick={() => onOpenDiary(r.id, r.date)}>일기 쓰기 📔</button>
            }
          </div>
        );
      }) : <div className="empty-state">데이트 기록이 없어요</div>;
    }
    if (myTab === 'diaries') {
      return allDiaries.length
        ? allDiaries.map(d => renderDiaryCard(d))
        : <div className="empty-state">아직 일기가 없어요 📔</div>;
    }
    if (myTab === 'notes') {
      return (
        <>
          <div style={{ textAlign: 'right', marginBottom: '12px' }}>
            <button className="btn btn-rose btn-sm" onClick={onOpenNoteModal}>쪽지 보내기 💌</button>
          </div>
          {allNotes.length ? allNotes.map(n => (
            <div key={n.id} className={'note-item' + (n.toUser === currentNick && !n.read ? ' unread' : '')}>
              <div className="note-from">{n.fromUser === currentNick ? '내가 보냄 → ' + n.toUser : n.fromUser + ' → 나'}</div>
              <div className="note-text">{n.text}</div>
              <div className="note-time">{formatTime(n.createdAt)}</div>
            </div>
          )) : <div className="empty-state">쪽지가 없어요 💌<br />상대방에게 쪽지를 보내봐요</div>}
        </>
      );
    }
  };

  return (
    <div id="page-my" className="page active">
      <div className="page-title">마이페이지</div>

      {/* 로그인 정보 카드 */}
      <div className="card" style={{ marginBottom: '12px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {currentUser.photoURL ? (
            <img src={currentUser.photoURL} alt="profile" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--rose2)' }} />
          ) : (
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--rose4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>👤</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px', marginBottom: '2px' }}>로그인 계정</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.email || '(이메일 없음)'}</div>
          </div>
        </div>
        {/* 닉네임 변경 */}
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px', marginBottom: '6px' }}>닉네임</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, flex: 1, color: 'var(--text)' }}>{currentNick}</div>
            <button className="btn btn-outline btn-xs" onClick={() => { setChangeNickOpen(v => !v); setNickErr(''); setNewNick(currentNick); }}>변경</button>
          </div>
          {changeNickOpen && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="새 닉네임"
                  maxLength={10}
                  value={newNick}
                  onChange={e => setNewNick(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveNick(); }}
                  style={{ flex: 1, fontSize: '14px', padding: '8px 12px' }}
                />
                <button className="btn btn-rose btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={handleSaveNick}>저장</button>
              </div>
              {nickErr && <div className="err-msg" style={{ marginTop: '4px' }}>{nickErr}</div>}
            </div>
          )}
        </div>
      </div>

      {/* 방 정보 카드 */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>ROOM</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>{roomTitle}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setEditRoomTitle(v => !v)}>
            {editRoomTitle ? '취소' : '편집'}
          </button>
        </div>
        {editRoomTitle && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input type="text" className="form-input" maxLength={20} placeholder="방 이름 (최대 20자)" value={roomTitleInput} onChange={e => setRoomTitleInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveRoomTitle(); }} style={{ flex: 1 }} />
            <button className="btn btn-rose btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={handleSaveRoomTitle}>저장</button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>COUPLE CODE</div>
            <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '6px', color: 'var(--rose)', fontVariantNumeric: 'tabular-nums' }}>{currentCoupleCode}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => {
            navigator.clipboard.writeText(currentCoupleCode).then(() => showToast('코드를 복사했어요! 📋')).catch(() => showToast(currentCoupleCode));
          }}>복사 📋</button>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px', marginBottom: '8px' }}>MEMBERS</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', minHeight: '28px' }}>
            {members.map(m => (
              <div key={m.nick} style={{ background: 'var(--rose4)', borderRadius: '12px', padding: '8px 12px', flex: 1, minWidth: '120px' }}>
                <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--rose)' }}>
                  {m.nick}
                </div>
                {m.email && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px', wordBreak: 'break-all' }}>{m.email}</div>}
                {m.nick !== currentNick && (
                  <button className="btn btn-outline btn-xs" style={{ marginTop: '6px', fontSize: '11px', color: '#e74c3c', borderColor: '#e74c3c' }} onClick={() => handleKick(m.nick)}>내보내기</button>
                )}
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

      {/* 탭 */}
      <div className="tab-nav">
        {(['received', 'sent', 'dates', 'diaries', 'notes'] as MyTab[]).map(tab => (
          <button key={tab} className={'tab-btn' + (myTab === tab ? ' active' : '')} onClick={() => setMyTab(tab)}>
            {tab === 'received' ? '받은 신청' : tab === 'sent' ? '보낸 신청' : tab === 'dates' ? '데이트 기록' : tab === 'diaries' ? '일기' : '쪽지 💌'}
          </button>
        ))}
      </div>

      {(myTab === 'received' || myTab === 'sent') && (
        <div className="filter-row">
          {(['전체', '대기', '수락', '반려'] as FilterType[]).map(f => (
            <button key={f} className={'filter-btn' + (myFilter === f ? ' active' : '')} onClick={() => setMyFilter(f)}>{f}</button>
          ))}
        </div>
      )}

      <div id="my-content">{renderContent()}</div>

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
              <input type="text" className="form-input" maxLength={6} placeholder="000000" style={{ flex: 1, letterSpacing: '4px', fontSize: '20px', fontWeight: 800, textAlign: 'center' }} value={joinOtherCode} onChange={e => { setJoinOtherCode(e.target.value); setJoinOtherErr(false); }} disabled={joinOtherStep === 'nick'} onKeyDown={e => { if (e.key === 'Enter') handleJoinOtherVerify(); }} />
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
