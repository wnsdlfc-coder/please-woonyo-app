'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection, doc, setDoc, getDoc, getDocs,
  onSnapshot, query, where, serverTimestamp, updateDoc, addDoc, deleteDoc, increment
} from 'firebase/firestore';
import { arrayUnion } from 'firebase/firestore';

import AuthScreen from '@/components/AuthScreen';
import CoupleSetup from '@/components/CoupleSetup';
import AppBar from '@/components/AppBar';
import BottomNav from '@/components/BottomNav';
import Toast, { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';
import Home from '@/components/pages/Home';
import Apply from '@/components/pages/Apply';
import CalendarPage from '@/components/pages/CalendarPage';
import MapPage from '@/components/pages/MapPage';
import MyPage from '@/components/pages/MyPage';
import ChatPage from '@/components/pages/ChatPage';

type AuthState = 'loading' | 'login' | 'couple' | 'app';
type PageId = 'home' | 'apply' | 'chat' | 'calendar' | 'map' | 'my';

interface ChecklistItem { text: string; done: boolean; important: boolean; }
interface Request {
  id: string; fromUser: string; toUser: string;
  date: string; time: string; theme: string; region: string;
  subLocation?: string; message?: string; status: string;
  checklist?: ChecklistItem[]; coupleCode: string;
}
interface Place { id: string; name: string; region: string; memo?: string; category: 'visited' | 'wanna'; coupleCode: string; }
interface Diary {
  id: string; reqId?: string; date: string; title: string; content: string;
  star?: number; author?: string; region?: string; tags?: string[];
  comments?: { author: string; text: string; createdAt: string }[];
  coupleCode: string;
}
interface Anniversary { id: string; name: string; date: string; emoji: string; repeat: boolean; coupleCode: string; }
interface Message {
  id: string; fromUser: string; toUser?: string; coupleCode: string; text: string;
  chatRoomId?: string;
  isLetter?: boolean;
  createdAt: { seconds?: number } | null;
  readAt: { seconds?: number } | null;
  selfDestruct?: boolean;
}
interface Schedule { id: string; title: string; date: string; endDate?: string; description?: string; createdBy?: string; roomId: string; }
interface Bucketlist { id: string; roomId: string; region: string; regionName?: string; memo?: string; }
interface ChatRoom { id: string; title: string; coupleCode: string; createdBy: string; createdAt: { seconds?: number } | null; }

export default function PageRoot() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentNick, setCurrentNick] = useState('');
  const [currentCoupleCode, setCurrentCoupleCode] = useState('');
  const [activePage, setActivePage] = useState<PageId>('home');
  const [members, setMembers] = useState<string[]>([]);
  const [activeMyTab, setActiveMyTab] = useState('received');

  const [roomTitle, setRoomTitle] = useState('우리의 방');
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [allDiaries, setAllDiaries] = useState<Diary[]>([]);
  const [allAnniversaries, setAllAnniversaries] = useState<Anniversary[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [allBucketlist, setAllBucketlist] = useState<Bucketlist[]>([]);
  const [allChatRooms, setAllChatRooms] = useState<ChatRoom[]>([]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const confirmCbRef = useRef<(() => void) | null>(null);
  const { toast, showToast } = useToast();

  const [diaryModalOpen, setDiaryModalOpen] = useState(false);
  const [diaryReqId, setDiaryReqId] = useState('');
  const [diaryDate, setDiaryDate] = useState('');
  const [diaryTitle, setDiaryTitle] = useState('');
  const [diaryContent, setDiaryContent] = useState('');
  const [diaryStar, setDiaryStar] = useState(5);
  const [diaryTags, setDiaryTags] = useState('');
  const [diaryShortcutOpen, setDiaryShortcutOpen] = useState(false);
  const [diaryShortcutCustomDate, setDiaryShortcutCustomDate] = useState('');

  const unsubscribersRef = useRef<(() => void)[]>([]);
  const kickListenerRef = useRef<(() => void) | null>(null);

  const showConfirm = useCallback((msg: string, onOk: () => void) => {
    setConfirmMsg(msg); confirmCbRef.current = onOk; setConfirmOpen(true);
  }, []);

  // kicked 멤버 필터링 포함
  const loadRoomMembers = useCallback(async (coupleCode: string) => {
    const [usersSnap, roomDoc] = await Promise.all([
      getDocs(query(collection(db, 'users'), where('coupleCode', '==', coupleCode))),
      getDoc(doc(db, 'rooms', coupleCode)),
    ]);
    const kicked: string[] = roomDoc.exists() ? (roomDoc.data().kickedMembers || []) : [];
    const seen = new Set<string>();
    const mems = usersSnap.docs
      .map(d => d.data().nickname || d.id)
      .filter(n => { if (seen.has(n) || kicked.includes(n)) return false; seen.add(n); return true; });
    setMembers(mems);
  }, []);

  const loadAll = useCallback((code: string) => {
    unsubscribersRef.current.forEach(u => u());
    unsubscribersRef.current = [];

    const u1 = onSnapshot(query(collection(db, 'requests'), where('coupleCode', '==', code)), snap => {
      setAllRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as Request)).sort((a, b) => {
        const aTs = (a as unknown as { createdAt?: { seconds?: number } }).createdAt?.seconds || 0;
        const bTs = (b as unknown as { createdAt?: { seconds?: number } }).createdAt?.seconds || 0;
        return bTs - aTs;
      }));
    });
    const u2 = onSnapshot(query(collection(db, 'places'), where('coupleCode', '==', code)), snap => {
      setAllPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() } as Place)).sort((a, b) => {
        const aTs = (a as unknown as { createdAt?: { seconds?: number } }).createdAt?.seconds || 0;
        const bTs = (b as unknown as { createdAt?: { seconds?: number } }).createdAt?.seconds || 0;
        return bTs - aTs;
      }));
    });
    const u3 = onSnapshot(query(collection(db, 'diaries'), where('coupleCode', '==', code)), snap => {
      setAllDiaries(snap.docs.map(d => ({ id: d.id, ...d.data() } as Diary)).sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    });
    const u4 = onSnapshot(query(collection(db, 'anniversaries'), where('coupleCode', '==', code)), snap => {
      setAllAnniversaries(snap.docs.map(d => ({ id: d.id, ...d.data() } as Anniversary)).sort((a, b) => (a.date || '').localeCompare(b.date || '')));
    });
    // 채팅: notes 컬렉션 사용 (Firestore 권한 보장)
    const u5 = onSnapshot(query(collection(db, 'notes'), where('coupleCode', '==', code)), snap => {
      setAllMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message))
        .sort((a, b) => ((a.createdAt as { seconds?: number })?.seconds || 0) - ((b.createdAt as { seconds?: number })?.seconds || 0)));
    });
    const u6 = onSnapshot(query(collection(db, 'schedules'), where('roomId', '==', code)), snap => {
      setAllSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() } as Schedule)).sort((a, b) => (a.date || '').localeCompare(b.date || '')));
    });
    const u7 = onSnapshot(query(collection(db, 'bucketlist'), where('roomId', '==', code)), snap => {
      const seenBucket = new Map<string, string>();
      snap.docs.forEach(d => {
        const key = d.data().regionName || d.data().region || d.id;
        if (seenBucket.has(key)) deleteDoc(doc(db, 'bucketlist', d.id)).catch(() => {});
        else seenBucket.set(key, d.id);
      });
      setAllBucketlist(snap.docs
        .filter((d, i, arr) => arr.findIndex(x => (x.data().regionName || x.data().region) === (d.data().regionName || d.data().region)) === i)
        .map(d => ({ id: d.id, ...d.data() } as Bucketlist)));
    });
    const u8 = onSnapshot(query(collection(db, 'chatRooms'), where('coupleCode', '==', code)), snap => {
      setAllChatRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatRoom))
        .sort((a, b) => ((a.createdAt as { seconds?: number })?.seconds || 0) - ((b.createdAt as { seconds?: number })?.seconds || 0)));
    });
    unsubscribersRef.current = [u1, u2, u3, u4, u5, u6, u7, u8];
  }, []);

  const enterApp = useCallback((user: User, nick: string, code: string) => {
    setCurrentUser(user); setCurrentNick(nick); setCurrentCoupleCode(code); setAuthState('app');
    if (kickListenerRef.current) { kickListenerRef.current(); kickListenerRef.current = null; }
    kickListenerRef.current = onSnapshot(doc(db, 'rooms', code), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setRoomTitle(data.title || '우리의 방');
        const kicked: string[] = data.kickedMembers || [];
        if (kicked.includes(nick)) {
          unsubscribersRef.current.forEach(u => u()); unsubscribersRef.current = [];
          if (kickListenerRef.current) { kickListenerRef.current(); kickListenerRef.current = null; }
          localStorage.removeItem('nick_' + user.uid); localStorage.removeItem('couple_' + user.uid);
          setCurrentNick(''); setCurrentCoupleCode(''); setAuthState('couple');
          showToast('방에서 내보내졌어요', true);
        }
      }
    });
    // 방문 횟수 기록 — setDoc+merge로 폰/PC 모두 카운팅
    const monthKey = new Date().toISOString().slice(0, 7);
    setDoc(doc(db, 'rooms', code), {
      visits: { [nick]: { [monthKey]: increment(1) } },
    }, { merge: true }).catch(() => {});

    loadAll(code); loadRoomMembers(code);
  }, [loadAll, loadRoomMembers, showToast]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (user) {
        setCurrentUser(user);
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.coupleCode && data.nickname) {
              localStorage.setItem('nick_' + user.uid, data.nickname);
              localStorage.setItem('couple_' + user.uid, data.coupleCode);
              enterApp(user, data.nickname, data.coupleCode); return;
            }
          }
        } catch { /* fallback */ }
        const savedNick = localStorage.getItem('nick_' + user.uid);
        const savedCouple = localStorage.getItem('couple_' + user.uid);
        if (savedNick && savedCouple) {
          setDoc(doc(db, 'users', user.uid), { uid: user.uid, nickname: savedNick, coupleCode: savedCouple, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
          setDoc(doc(db, 'rooms', savedCouple), { members: arrayUnion(user.uid) }, { merge: true }).catch(() => {});
          enterApp(user, savedNick, savedCouple);
        } else { setAuthState('couple'); }
      } else { setAuthState('login'); }
    });
    return () => unsub();
  }, [enterApp, showToast]);

  const handleLogout = async () => {
    unsubscribersRef.current.forEach(u => u()); unsubscribersRef.current = [];
    if (kickListenerRef.current) { kickListenerRef.current(); kickListenerRef.current = null; }
    await signOut(auth);
    setCurrentUser(null); setCurrentNick(''); setCurrentCoupleCode(''); setAuthState('login');
  };

  const handleSwitchRoom = useCallback(async (code: string, nick: string) => {
    if (!currentUser) return;
    const email = currentUser.email || '', photoURL = currentUser.photoURL || '';
    await setDoc(doc(db, 'users', currentUser.uid), { uid: currentUser.uid, nickname: nick, coupleCode: code, email, photoURL, updatedAt: serverTimestamp(), kicked: false }, { merge: true });
    await setDoc(doc(db, 'users', nick), { uid: currentUser.uid, nickname: nick, coupleCode: code, email, photoURL, kicked: false }, { merge: true });
    await setDoc(doc(db, 'rooms', code), { members: arrayUnion(currentUser.uid) }, { merge: true });
    localStorage.setItem('nick_' + currentUser.uid, nick);
    localStorage.setItem('couple_' + currentUser.uid, code);
    setCurrentNick(nick); setCurrentCoupleCode(code);
    loadAll(code); loadRoomMembers(code); showToast('방에 입장했어요 💕');
  }, [currentUser, loadAll, loadRoomMembers, showToast]);

  const handleOpenDiary = useCallback((reqId: string, date?: string) => {
    setDiaryReqId(reqId || '');
    setDiaryDate(date || new Date().toISOString().split('T')[0]);
    setDiaryTitle(''); setDiaryContent(''); setDiaryTags(''); setDiaryStar(5);
    setDiaryModalOpen(true);
  }, []);

  const handleSaveDiary = async () => {
    if (!diaryTitle.trim() || !diaryContent.trim()) { showToast('제목과 내용을 입력해주세요', true); return; }
    const req = allRequests.find(r => r.id === diaryReqId);
    await addDoc(collection(db, 'diaries'), {
      reqId: diaryReqId, title: diaryTitle.trim(), content: diaryContent.trim(),
      date: req ? req.date : (diaryDate || new Date().toISOString().split('T')[0]),
      star: diaryStar, tags: diaryTags.split(',').map(t => t.trim()).filter(Boolean),
      author: currentNick, comments: [], coupleCode: currentCoupleCode, createdAt: serverTimestamp()
    });
    setDiaryModalOpen(false); setDiaryTitle(''); setDiaryContent(''); setDiaryTags(''); setDiaryStar(5);
    showToast('일기가 저장됐어요! 📔');
    setActiveMyTab('diaries'); setActivePage('my');
  };

  // 채팅 전송 — notes 컬렉션에 저장
  const handleSendMessage = useCallback(async (text: string, selfDestruct: boolean) => {
    const partner = members.find(m => m !== currentNick) || '';
    await addDoc(collection(db, 'notes'), {
      fromUser: currentNick,
      toUser: partner,
      coupleCode: currentCoupleCode,
      text,
      createdAt: serverTimestamp(),
      readAt: null,
      selfDestruct,
      chatMode: true,
    });
  }, [currentNick, currentCoupleCode, members]);

  const handleSendChatMessage = useCallback(async (text: string, selfDestruct: boolean, roomId: string) => {
    const partner = members.find(m => m !== currentNick) || '';
    await addDoc(collection(db, 'notes'), {
      fromUser: currentNick, toUser: partner, coupleCode: currentCoupleCode,
      text, chatRoomId: roomId, createdAt: serverTimestamp(), readAt: null, selfDestruct, chatMode: true,
    });
  }, [currentNick, currentCoupleCode, members]);

  const unreadMsgCount = allMessages.filter(m => m.chatRoomId && m.fromUser !== currentNick && !m.readAt).length;

  const todayStr = new Date().toISOString().split('T')[0];
  const pastAccepted = allRequests.filter(r => (r.status === '수락' || r.status === 'accepted') && r.date <= todayStr).sort((a, b) => b.date.localeCompare(a.date));
  const noDiary = pastAccepted.filter(r => !allDiaries.some(d => d.reqId === r.id || d.date === r.date));

  if (authState === 'loading') return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: '32px' }}>💕</div></div>;
  if (authState === 'login') return <AuthScreen onAuthSuccess={() => {}} />;
  if (authState === 'couple') {
    if (!currentUser) return <AuthScreen onAuthSuccess={() => {}} />;
    return <CoupleSetup currentUser={{ uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName, photoURL: currentUser.photoURL }} onEnterApp={(nick, code) => { enterApp(currentUser, nick, code); }} showToast={showToast} />;
  }
  if (!currentUser) return null;

  return (
    <>
      <AppBar currentNick={currentNick} onLogout={handleLogout} roomTitle={roomTitle} />
      <main>
        {activePage === 'home' && (
          <Home
            currentNick={currentNick}
            currentCoupleCode={currentCoupleCode}
            allRequests={allRequests}
            allDiaries={allDiaries}
            allMessages={allMessages}
            allAnniversaries={allAnniversaries}
            onNavigate={page => setActivePage(page as PageId)}
            onOpenDiaryShortcut={() => { setDiaryShortcutCustomDate(todayStr); setDiaryShortcutOpen(true); }}
            showToast={showToast}
            showConfirm={showConfirm}
            onSwitchMyTab={tab => { setActiveMyTab(tab); setActivePage('my'); }}
          />
        )}
        {activePage === 'apply' && (
          <Apply currentNick={currentNick} currentCoupleCode={currentCoupleCode} members={members} showToast={showToast} onSubmitted={() => setActivePage('home')} />
        )}
        {activePage === 'chat' && (
          <ChatPage
            currentNick={currentNick}
            currentCoupleCode={currentCoupleCode}
            allChatRooms={allChatRooms}
            allMessages={allMessages}
            onSendMessage={handleSendChatMessage}
            showToast={showToast}
          />
        )}
        {activePage === 'calendar' && (
          <CalendarPage currentNick={currentNick} currentCoupleCode={currentCoupleCode} allRequests={allRequests} allDiaries={allDiaries} allAnniversaries={allAnniversaries} allSchedules={allSchedules} showToast={showToast} onOpenDiary={handleOpenDiary} />
        )}
        {activePage === 'map' && (
          <MapPage currentNick={currentNick} currentCoupleCode={currentCoupleCode} allPlaces={allPlaces} allBucketlist={allBucketlist} allRequests={allRequests} allAnniversaries={allAnniversaries} allDiaries={allDiaries} showToast={showToast} showConfirm={showConfirm} />
        )}
        {activePage === 'my' && (
          <MyPage
            currentUser={{ uid: currentUser.uid, email: currentUser.email, photoURL: currentUser.photoURL }}
            currentNick={currentNick} currentCoupleCode={currentCoupleCode}
            allRequests={allRequests} allDiaries={allDiaries} allMessages={allMessages} allPlaces={allPlaces}
            activeMyTab={activeMyTab} onChangeNick={newNick => setCurrentNick(newNick)}
            onSwitchRoom={handleSwitchRoom} showToast={showToast} showConfirm={showConfirm}
            onOpenDiary={handleOpenDiary} onSendMessage={handleSendMessage}
          />
        )}
      </main>
      <BottomNav activePage={activePage} onNavigate={page => { setActivePage(page); if (page !== 'my') setActiveMyTab('received'); }} unreadMsgCount={unreadMsgCount} />

      {/* Diary Modal */}
      <div className={'modal-bg' + (diaryModalOpen ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) setDiaryModalOpen(false); }}>
        <div className="modal">
          <div className="modal-bar" />
          <div className="modal-title">데이트 일기 📔</div>
          <div className="form-group">
            <label className="form-label">제목</label>
            <input type="text" className="form-input" placeholder="오늘 데이트 한 줄 제목" value={diaryTitle} onChange={e => setDiaryTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">내용</label>
            <textarea className="form-input" placeholder="오늘 어땠어요? 💕" style={{ minHeight: '120px' }} value={diaryContent} onChange={e => setDiaryContent(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">별점</label>
            <div style={{ display: 'flex', gap: '6px', fontSize: '24px', cursor: 'pointer' }}>
              {[1,2,3,4,5].map(n => <span key={n} onClick={() => setDiaryStar(n)} style={{ color: n <= diaryStar ? '#F4A300' : '#ccc' }}>{n <= diaryStar ? '★' : '☆'}</span>)}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">태그 (쉼표로 구분)</label>
            <input type="text" className="form-input" placeholder="맛집, 야경, 행복한날" value={diaryTags} onChange={e => setDiaryTags(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline btn-full" onClick={() => setDiaryModalOpen(false)}>취소</button>
            <button className="btn btn-rose btn-full" onClick={handleSaveDiary}>저장 💕</button>
          </div>
        </div>
      </div>

      {/* Diary Shortcut Modal */}
      <div className={'modal-bg' + (diaryShortcutOpen ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) setDiaryShortcutOpen(false); }}>
        <div className="modal">
          <div className="modal-bar" />
          <div className="modal-title">일기 쓸 날짜 선택 📔</div>
          <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '12px' }}>
            {pastAccepted.length ? [...noDiary, ...pastAccepted.filter(r => allDiaries.some(d => d.reqId === r.id || d.date === r.date))].map(r => {
              const written = allDiaries.some(d => d.reqId === r.id || d.date === r.date);
              return (
                <div key={r.id} className="card" style={{ marginBottom: '8px', cursor: 'pointer', borderLeft: `3px solid ${written ? '#DCEDC8' : 'var(--rose)'}` }}
                  onClick={() => { setDiaryShortcutOpen(false); handleOpenDiary(r.id, r.date); }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{r.date} · {r.region}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{r.theme}</div>
                  <div style={{ fontSize: '12px', marginTop: '4px', color: written ? '#8BC34A' : 'var(--rose)' }}>{written ? '✓ 일기 있음' : '📔 일기 없음'}</div>
                </div>
              );
            }) : <div className="empty-state">과거 데이트 기록이 없어요</div>}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' }}>날짜 직접 선택</div>
            <input type="date" className="form-input" value={diaryShortcutCustomDate} onChange={e => setDiaryShortcutCustomDate(e.target.value)} style={{ marginBottom: '10px' }} />
            <button className="btn btn-rose btn-full" onClick={() => {
              const req = allRequests.find(r => r.date === diaryShortcutCustomDate && (r.status === '수락' || r.status === 'accepted'));
              setDiaryShortcutOpen(false); handleOpenDiary(req ? req.id : '', diaryShortcutCustomDate);
            }}>이 날짜로 일기 쓰기</button>
          </div>
          <button className="btn btn-outline btn-full" onClick={() => setDiaryShortcutOpen(false)}>취소</button>
        </div>
      </div>

      <ConfirmModal open={confirmOpen} message={confirmMsg} onOk={() => { setConfirmOpen(false); confirmCbRef.current?.(); }} onCancel={() => setConfirmOpen(false)} />
      <Toast message={toast.message} isError={toast.isError} visible={toast.visible} />
    </>
  );
}
