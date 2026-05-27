'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import {
  onAuthStateChanged, signOut
} from 'firebase/auth';
import {
  collection, doc, setDoc, getDoc, getDocs,
  onSnapshot, query, where, serverTimestamp, updateDoc, addDoc, deleteDoc
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

type AuthState = 'loading' | 'login' | 'couple' | 'app';
type PageId = 'home' | 'apply' | 'calendar' | 'map' | 'my';

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
interface Note { id: string; fromUser: string; toUser: string; text: string; read: boolean; coupleCode: string; createdAt?: { toDate?: () => Date; seconds?: number }; }
interface Schedule { id: string; title: string; date: string; description?: string; createdBy?: string; roomId: string; }
interface Bucketlist { id: string; roomId: string; region: string; regionName?: string; createdBy?: string; createdAt?: { toDate?: () => Date; seconds?: number }; memo?: string; }

export default function PageRoot() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentNick, setCurrentNick] = useState('');
  const [currentCoupleCode, setCurrentCoupleCode] = useState('');
  const [activePage, setActivePage] = useState<PageId>('home');
  const [members, setMembers] = useState<string[]>([]);
  const [activeMyTab, setActiveMyTab] = useState('received');

  // All data
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [allDiaries, setAllDiaries] = useState<Diary[]>([]);
  const [allAnniversaries, setAllAnniversaries] = useState<Anniversary[]>([]);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [allBucketlist, setAllBucketlist] = useState<Bucketlist[]>([]);

  // Confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const confirmCbRef = useRef<(() => void) | null>(null);

  // Toast
  const { toast, showToast } = useToast();

  // Diary modal
  const [diaryModalOpen, setDiaryModalOpen] = useState(false);
  const [diaryReqId, setDiaryReqId] = useState('');
  const [diaryDate, setDiaryDate] = useState('');
  const [diaryTitle, setDiaryTitle] = useState('');
  const [diaryContent, setDiaryContent] = useState('');
  const [diaryStar, setDiaryStar] = useState(5);
  const [diaryTags, setDiaryTags] = useState('');

  // Diary shortcut modal
  const [diaryShortcutOpen, setDiaryShortcutOpen] = useState(false);
  const [diaryShortcutCustomDate, setDiaryShortcutCustomDate] = useState('');

  // Note modal
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');

  const unsubscribersRef = useRef<(() => void)[]>([]);
  const kickListenerRef = useRef<(() => void) | null>(null);

  const showConfirm = useCallback((msg: string, onOk: () => void) => {
    setConfirmMsg(msg);
    confirmCbRef.current = onOk;
    setConfirmOpen(true);
  }, []);

  const loadRoomMembers = useCallback(async (coupleCode: string) => {
    const snap = await getDocs(query(collection(db, 'users'), where('coupleCode', '==', coupleCode)));
    const seen = new Set<string>();
    const mems = snap.docs
      .map(d => d.data().nickname || d.id)
      .filter(n => { if (seen.has(n)) return false; seen.add(n); return true; });
    setMembers(mems);
  }, []);

  const loadAll = useCallback((code: string) => {
    unsubscribersRef.current.forEach(u => u());
    unsubscribersRef.current = [];

    const u1 = onSnapshot(query(collection(db, 'requests'), where('coupleCode', '==', code)), snap => {
      setAllRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as Request)
      ).sort((a, b) => {
        const aTs = (a as unknown as { createdAt?: { seconds?: number } }).createdAt?.seconds || 0;
        const bTs = (b as unknown as { createdAt?: { seconds?: number } }).createdAt?.seconds || 0;
        return bTs - aTs;
      }));
    });
    const u2 = onSnapshot(query(collection(db, 'places'), where('coupleCode', '==', code)), snap => {
      setAllPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() } as Place)
      ).sort((a, b) => {
        const aTs = (a as unknown as { createdAt?: { seconds?: number } }).createdAt?.seconds || 0;
        const bTs = (b as unknown as { createdAt?: { seconds?: number } }).createdAt?.seconds || 0;
        return bTs - aTs;
      }));
    });
    const u3 = onSnapshot(query(collection(db, 'diaries'), where('coupleCode', '==', code)), snap => {
      setAllDiaries(snap.docs.map(d => ({ id: d.id, ...d.data() } as Diary))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    });
    const u4 = onSnapshot(query(collection(db, 'anniversaries'), where('coupleCode', '==', code)), snap => {
      setAllAnniversaries(snap.docs.map(d => ({ id: d.id, ...d.data() } as Anniversary))
        .sort((a, b) => (a.date || '').localeCompare(b.date || '')));
    });
    const u5 = onSnapshot(query(collection(db, 'notes'), where('coupleCode', '==', code)), snap => {
      setAllNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Note))
        .sort((a, b) => ((b.createdAt as { seconds?: number })?.seconds || 0) - ((a.createdAt as { seconds?: number })?.seconds || 0)));
    });
    const u6 = onSnapshot(query(collection(db, 'schedules'), where('roomId', '==', code)), snap => {
      setAllSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() } as Schedule))
        .sort((a, b) => (a.date || '').localeCompare(b.date || '')));
    });
    const u7 = onSnapshot(query(collection(db, 'bucketlist'), where('roomId', '==', code)), snap => {
      const seenBucket = new Map<string, string>();
      snap.docs.forEach(d => {
        const key = d.data().regionName || d.data().region || d.id;
        if (seenBucket.has(key)) {
          deleteDoc(doc(db, 'bucketlist', d.id)).catch(() => {});
        } else {
          seenBucket.set(key, d.id);
        }
      });
      setAllBucketlist(snap.docs
        .filter((d, idx, arr) => arr.findIndex(x => (x.data().regionName || x.data().region) === (d.data().regionName || d.data().region)) === idx)
        .map(d => ({ id: d.id, ...d.data() } as Bucketlist)));
    });
    unsubscribersRef.current = [u1, u2, u3, u4, u5, u6, u7];
  }, []);

  const enterApp = useCallback((user: User, nick: string, code: string) => {
    setCurrentUser(user);
    setCurrentNick(nick);
    setCurrentCoupleCode(code);
    setAuthState('app');

    // Kick listener
    if (kickListenerRef.current) { kickListenerRef.current(); kickListenerRef.current = null; }
    kickListenerRef.current = onSnapshot(doc(db, 'users', user.uid), snap => {
      if (snap.exists() && snap.data().kicked) {
        unsubscribersRef.current.forEach(u => u());
        unsubscribersRef.current = [];
        if (kickListenerRef.current) { kickListenerRef.current(); kickListenerRef.current = null; }
        setAuthState('couple');
        showToast('방에서 내보내졌어요', true);
      }
    });

    loadAll(code);
    loadRoomMembers(code);
  }, [loadAll, loadRoomMembers, showToast]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (user) {
        setCurrentUser(user);
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.kicked) {
              localStorage.removeItem('nick_' + user.uid);
              localStorage.removeItem('couple_' + user.uid);
              setAuthState('couple');
              showToast('방에서 내보내졌어요', true);
              return;
            }
            if (data.coupleCode && data.nickname) {
              localStorage.setItem('nick_' + user.uid, data.nickname);
              localStorage.setItem('couple_' + user.uid, data.coupleCode);
              enterApp(user, data.nickname, data.coupleCode);
              return;
            }
          }
        } catch { /* fallback */ }
        const savedNick = localStorage.getItem('nick_' + user.uid);
        const savedCouple = localStorage.getItem('couple_' + user.uid);
        if (savedNick && savedCouple) {
          setDoc(doc(db, 'users', user.uid), {
            uid: user.uid, nickname: savedNick, coupleCode: savedCouple, updatedAt: serverTimestamp()
          }, { merge: true }).catch(() => {});
          setDoc(doc(db, 'rooms', savedCouple), { members: arrayUnion(user.uid) }, { merge: true }).catch(() => {});
          enterApp(user, savedNick, savedCouple);
        } else {
          setAuthState('couple');
        }
      } else {
        setAuthState('login');
      }
    });
    return () => unsub();
  }, [enterApp, showToast]);

  const handleLogout = async () => {
    unsubscribersRef.current.forEach(u => u());
    unsubscribersRef.current = [];
    if (kickListenerRef.current) { kickListenerRef.current(); kickListenerRef.current = null; }
    await signOut(auth);
    setCurrentUser(null);
    setCurrentNick('');
    setCurrentCoupleCode('');
    setAuthState('login');
  };

  const handleSwitchRoom = useCallback(async (code: string, nick: string) => {
    if (!currentUser) return;
    const email = currentUser.email || '';
    const photoURL = currentUser.photoURL || '';
    await setDoc(doc(db, 'users', currentUser.uid), {
      uid: currentUser.uid, nickname: nick, coupleCode: code,
      email, photoURL, updatedAt: serverTimestamp(), kicked: false,
    }, { merge: true });
    await setDoc(doc(db, 'users', nick), {
      uid: currentUser.uid, nickname: nick, coupleCode: code, email, photoURL, kicked: false,
    }, { merge: true });
    await setDoc(doc(db, 'rooms', code), { members: arrayUnion(currentUser.uid) }, { merge: true });
    localStorage.setItem('nick_' + currentUser.uid, nick);
    localStorage.setItem('couple_' + currentUser.uid, code);
    setCurrentNick(nick);
    setCurrentCoupleCode(code);
    loadAll(code);
    loadRoomMembers(code);
    showToast('방에 입장했어요 💕');
  }, [currentUser, loadAll, loadRoomMembers, showToast]);

  const handleOpenDiary = useCallback((reqId: string, date?: string) => {
    setDiaryReqId(reqId || '');
    setDiaryDate(date || new Date().toISOString().split('T')[0]);
    setDiaryTitle(''); setDiaryContent(''); setDiaryTags('');
    setDiaryStar(5);
    setDiaryModalOpen(true);
  }, []);

  const handleSaveDiary = async () => {
    if (!diaryTitle.trim() || !diaryContent.trim()) { showToast('제목과 내용을 입력해주세요', true); return; }
    const req = allRequests.find(r => r.id === diaryReqId);
    await addDoc(collection(db, 'diaries'), {
      reqId: diaryReqId,
      title: diaryTitle.trim(), content: diaryContent.trim(),
      date: req ? req.date : (diaryDate || new Date().toISOString().split('T')[0]),
      star: diaryStar,
      tags: diaryTags.split(',').map(t => t.trim()).filter(Boolean),
      author: currentNick, comments: [],
      coupleCode: currentCoupleCode, createdAt: serverTimestamp()
    });
    setDiaryModalOpen(false);
    setDiaryTitle(''); setDiaryContent(''); setDiaryTags(''); setDiaryStar(5);
    showToast('일기가 저장됐어요! 📔');
    setActiveMyTab('diaries');
    setActivePage('my');
  };

  const handleSendNote = async () => {
    if (!noteContent.trim()) { showToast('내용을 입력해주세요', true); return; }
    const toUser = allRequests.find(r => r.fromUser === currentNick)?.toUser
      || allRequests.find(r => r.toUser === currentNick)?.fromUser
      || '상대방';
    await addDoc(collection(db, 'notes'), {
      fromUser: currentNick, toUser, text: noteContent.trim(), read: false,
      coupleCode: currentCoupleCode, createdAt: serverTimestamp()
    });
    setNoteContent('');
    setNoteModalOpen(false);
    showToast('쪽지를 보냈어요 💌');
  };

  const handleMarkNotesRead = useCallback(() => {
    allNotes.filter(n => n.toUser === currentNick && !n.read).forEach(n => {
      updateDoc(doc(db, 'notes', n.id), { read: true }).catch(() => {});
    });
  }, [allNotes, currentNick]);

  const unreadNoteCount = allNotes.filter(n => n.toUser === currentNick && !n.read).length;

  // Today's accepted dates missing diaries
  const todayStr = new Date().toISOString().split('T')[0];
  const pastAccepted = allRequests.filter(r => (r.status === '수락' || r.status === 'accepted') && r.date <= todayStr).sort((a, b) => b.date.localeCompare(a.date));
  const noDiary = pastAccepted.filter(r => !allDiaries.some(d => d.reqId === r.id || d.date === r.date));

  if (authState === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
        <div style={{ fontSize: '32px' }}>💕</div>
      </div>
    );
  }

  if (authState === 'login') {
    return <AuthScreen onAuthSuccess={() => {}} />;
  }

  if (authState === 'couple') {
    if (!currentUser) return <AuthScreen onAuthSuccess={() => {}} />;
    return (
      <CoupleSetup
        currentUser={{ uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName, photoURL: currentUser.photoURL }}
        onEnterApp={(nick, code) => { enterApp(currentUser, nick, code); }}
        showToast={showToast}
      />
    );
  }

  // App state
  if (!currentUser) return null;

  return (
    <>
      <AppBar currentNick={currentNick} onLogout={handleLogout} />
      <main>
        {activePage === 'home' && (
          <Home
            currentNick={currentNick}
            allRequests={allRequests}
            allDiaries={allDiaries}
            allNotes={allNotes}
            onNavigate={page => {
              setActivePage(page);
            }}
            onOpenDiaryShortcut={() => {
              setDiaryShortcutCustomDate(todayStr);
              setDiaryShortcutOpen(true);
            }}
            showToast={showToast}
            showConfirm={showConfirm}
            onSwitchMyTab={tab => { setActiveMyTab(tab); setActivePage('my'); }}
          />
        )}
        {activePage === 'apply' && (
          <Apply
            currentNick={currentNick}
            currentCoupleCode={currentCoupleCode}
            members={members}
            showToast={showToast}
            onSubmitted={() => setActivePage('home')}
          />
        )}
        {activePage === 'calendar' && (
          <CalendarPage
            currentNick={currentNick}
            currentCoupleCode={currentCoupleCode}
            allRequests={allRequests}
            allDiaries={allDiaries}
            allAnniversaries={allAnniversaries}
            allSchedules={allSchedules}
            showToast={showToast}
            onOpenDiary={handleOpenDiary}
          />
        )}
        {activePage === 'map' && (
          <MapPage
            currentNick={currentNick}
            currentCoupleCode={currentCoupleCode}
            allPlaces={allPlaces}
            allBucketlist={allBucketlist}
            allRequests={allRequests}
            allAnniversaries={allAnniversaries}
            allDiaries={allDiaries}
            showToast={showToast}
            showConfirm={showConfirm}
          />
        )}
        {activePage === 'my' && (
          <MyPage
            currentUser={{ uid: currentUser.uid, email: currentUser.email, photoURL: currentUser.photoURL }}
            currentNick={currentNick}
            currentCoupleCode={currentCoupleCode}
            allRequests={allRequests}
            allDiaries={allDiaries}
            allNotes={allNotes}
            allPlaces={allPlaces}
            activeMyTab={activeMyTab}
            onChangeNick={newNick => setCurrentNick(newNick)}
            onSwitchRoom={handleSwitchRoom}
            showToast={showToast}
            showConfirm={showConfirm}
            onOpenDiary={handleOpenDiary}
            onOpenNoteModal={() => setNoteModalOpen(true)}
            onMarkNotesRead={handleMarkNotesRead}
          />
        )}
      </main>
      <BottomNav
        activePage={activePage}
        onNavigate={page => {
          setActivePage(page);
          if (page !== 'my') setActiveMyTab('received');
        }}
        unreadNoteCount={unreadNoteCount}
      />

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
              {[1, 2, 3, 4, 5].map(n => (
                <span key={n} onClick={() => setDiaryStar(n)} style={{ color: n <= diaryStar ? '#F4A300' : '#ccc' }}>{n <= diaryStar ? '★' : '☆'}</span>
              ))}
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
                <div
                  key={r.id}
                  className="card"
                  style={{ marginBottom: '8px', cursor: 'pointer', borderLeft: `3px solid ${written ? '#DCEDC8' : 'var(--rose)'}` }}
                  onClick={() => { setDiaryShortcutOpen(false); handleOpenDiary(r.id, r.date); }}
                >
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
              setDiaryShortcutOpen(false);
              handleOpenDiary(req ? req.id : '', diaryShortcutCustomDate);
            }}>이 날짜로 일기 쓰기</button>
          </div>
          <button className="btn btn-outline btn-full" onClick={() => setDiaryShortcutOpen(false)}>취소</button>
        </div>
      </div>

      {/* Note Modal */}
      <div className={'modal-bg' + (noteModalOpen ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) setNoteModalOpen(false); }}>
        <div className="modal">
          <div className="modal-bar" />
          <div className="modal-title">쪽지 보내기 💌</div>
          <div className="form-group">
            <label className="form-label">내용 (최대 100자)</label>
            <textarea className="form-input" placeholder="하고 싶은 말을 적어봐요..." maxLength={100} style={{ minHeight: '80px' }} value={noteContent} onChange={e => setNoteContent(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline btn-full" onClick={() => setNoteModalOpen(false)}>취소</button>
            <button className="btn btn-rose btn-full" onClick={handleSendNote}>보내기 💕</button>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmOpen}
        message={confirmMsg}
        onOk={() => { setConfirmOpen(false); confirmCbRef.current?.(); }}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Toast */}
      <Toast message={toast.message} isError={toast.isError} visible={toast.visible} />
    </>
  );
}
