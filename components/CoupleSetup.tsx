'use client';
import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, doc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { arrayUnion } from 'firebase/firestore';

type CoupleView = 'choice' | 'create' | 'join';

interface CoupleSetupProps {
  currentUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null };
  onEnterApp: (nick: string, coupleCode: string) => void;
  showToast: (msg: string, isErr?: boolean) => void;
}

export default function CoupleSetup({ currentUser, onEnterApp, showToast }: CoupleSetupProps) {
  const [view, setView] = useState<CoupleView>('choice');
  const [pendingCode, setPendingCode] = useState('');
  const [createNick, setCreateNick] = useState(currentUser.displayName || '');
  const [joinCode, setJoinCode] = useState('');
  const [joinMembers, setJoinMembers] = useState<string[]>([]);
  const [joinStep, setJoinStep] = useState<'verify' | 'select'>('verify');
  const [joinSelectedNick, setJoinSelectedNick] = useState('');
  const [joinNewNick, setJoinNewNick] = useState('');
  const [joinCodeErr, setJoinCodeErr] = useState(false);
  const [loading, setLoading] = useState(false);

  const saveCoupleCode = async (code: string, nick: string, isCreator = false) => {
    try {
      const email = currentUser.email || '';
      const photoURL = currentUser.photoURL || '';

      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid, nickname: nick, coupleCode: code,
        email, photoURL, updatedAt: serverTimestamp(), kicked: false,
      }, { merge: true });

      await setDoc(doc(db, 'users', nick), {
        uid: currentUser.uid, nickname: nick, coupleCode: code, email, photoURL, kicked: false,
      }, { merge: true });

      if (isCreator) {
        await setDoc(doc(db, 'rooms', code), {
          ownerId: currentUser.uid,
          members: [currentUser.uid],
        }, { merge: true });
      } else {
        await setDoc(doc(db, 'rooms', code), {
          members: arrayUnion(currentUser.uid),
        }, { merge: true });
      }

      localStorage.setItem('nick_' + currentUser.uid, nick);
      localStorage.setItem('couple_' + currentUser.uid, code);
      onEnterApp(nick, code);
    } catch (e: unknown) {
      const err = e as { message?: string };
      showToast('입장 실패: ' + (err.message || ''), true);
    }
  };

  const handleCreateRoom = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setPendingCode(code);
    setView('create');
  };

  const handleEnterCreate = () => {
    if (!createNick.trim()) { showToast('이름을 입력해주세요', true); return; }
    saveCoupleCode(pendingCode, createNick.trim(), true);
  };

  const handleJoinVerify = async () => {
    if (joinCode.length !== 6) { showToast('6자리 코드를 입력해주세요', true); return; }
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('coupleCode', '==', joinCode)));
      if (snap.empty) {
        setJoinCodeErr(true);
        setLoading(false);
        return;
      }
      setJoinCodeErr(false);
      const seen = new Set<string>();
      const members = snap.docs
        .map(d => d.data().nickname || d.id)
        .filter(n => { if (seen.has(n)) return false; seen.add(n); return true; });
      setJoinMembers(members);
      setJoinStep('select');
    } catch (e: unknown) {
      const err = e as { message?: string };
      showToast('오류: ' + (err.message || ''), true);
    } finally {
      setLoading(false);
    }
  };

  const handleEnterJoin = async () => {
    if (joinStep === 'verify') { handleJoinVerify(); return; }
    let nick = joinSelectedNick;
    if (nick === '__new__') nick = joinNewNick.trim();
    if (!nick) { showToast('이름을 선택하거나 입력해주세요', true); return; }
    await saveCoupleCode(joinCode, nick);
  };

  return (
    <div className="screen" style={{ display: 'flex' }}>
      <div className="auth-card">
        <div className="auth-logo" style={{ fontSize: '62px', lineHeight: '1.1' }}>👩🧑</div>
        <div className="auth-title" style={{ fontSize: '36px' }}>우뇨의 방</div>
        <div className="auth-sub">둘만의 공간을 만들거나<br />상대방의 방에 입장하세요 🔑</div>

        {view === 'choice' && (
          <>
            <button className="couple-choice-card create-card" onClick={handleCreateRoom}>
              <div className="choice-icon-wrap create-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div className="choice-title">새로운 방 만들기</div>
                <div className="choice-desc">커플 코드 자동 생성</div>
              </div>
              <svg className="choice-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <button className="couple-choice-card join-card" onClick={() => setView('join')}>
              <div className="choice-icon-wrap join-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div className="choice-title">기존 방 입장하기</div>
                <div className="choice-desc">커플 코드로 방에 입장</div>
              </div>
              <svg className="choice-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </>
        )}

        {view === 'create' && (
          <>
            <div className="couple-code-box">
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text3)', marginBottom: '8px', letterSpacing: '1px' }}>YOUR COUPLE CODE</div>
              <div style={{ fontFamily: "'Nanum Myeongjo', serif", fontSize: '36px', fontWeight: 800, color: 'var(--rose)', letterSpacing: '6px' }}>{pendingCode}</div>
              <button
                className="btn btn-outline btn-sm"
                style={{ marginTop: '12px' }}
                onClick={() => {
                  navigator.clipboard.writeText(pendingCode)
                    .then(() => showToast('코드를 복사했어요! 📋'))
                    .catch(() => showToast(pendingCode));
                }}
              >복사하기 📋</button>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '16px', lineHeight: '1.7' }}>
              이 코드를 상대방에게 알려주세요<br />상대방이 동일한 코드로 입장하면 연결돼요 💕
            </div>
            <div className="form-group" style={{ textAlign: 'left', marginBottom: '16px' }}>
              <label className="form-label">내 이름</label>
              <input
                type="text"
                className="form-input"
                placeholder="예) 우뇨, 올드맨..."
                maxLength={10}
                value={createNick}
                onChange={e => setCreateNick(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleEnterCreate(); }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-outline btn-full" onClick={() => setView('choice')}>← 뒤로</button>
              <button className="btn btn-rose btn-full" onClick={handleEnterCreate}>입장하기 💕</button>
            </div>
          </>
        )}

        {view === 'join' && (
          <>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">커플 코드 6자리 입력</label>
              <input
                type="text"
                className={'form-input' + (joinCodeErr ? ' input-err' : '')}
                placeholder="숫자 6자리"
                maxLength={6}
                inputMode="numeric"
                style={{ textAlign: 'center', fontSize: '24px', fontFamily: "'Nanum Myeongjo', serif", letterSpacing: '8px', fontWeight: 800 }}
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value); setJoinCodeErr(false); }}
                disabled={joinStep === 'select'}
                onKeyDown={e => { if (e.key === 'Enter') handleJoinVerify(); }}
              />
              {joinCodeErr && <div className="err-hint show">존재하지 않는 커플 코드예요</div>}
            </div>
            {joinStep === 'select' && (
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">나는 누구인가요?</label>
                <select
                  className="form-input"
                  value={joinSelectedNick}
                  onChange={e => setJoinSelectedNick(e.target.value)}
                >
                  <option value="">선택해주세요</option>
                  {joinMembers.map(m => <option key={m} value={m}>{m}</option>)}
                  <option value="__new__">직접 입력...</option>
                </select>
                {joinSelectedNick === '__new__' && (
                  <input
                    type="text"
                    className="form-input"
                    placeholder="이름 입력"
                    maxLength={10}
                    value={joinNewNick}
                    onChange={e => setJoinNewNick(e.target.value)}
                    style={{ marginTop: '8px' }}
                  />
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-outline btn-full" onClick={() => {
                setView('choice');
                setJoinCode('');
                setJoinStep('verify');
                setJoinCodeErr(false);
                setJoinMembers([]);
              }}>← 뒤로</button>
              <button className="btn btn-rose btn-full" onClick={handleEnterJoin} disabled={loading}>
                {joinStep === 'verify' ? '코드 확인' : '입장하기 💕'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
