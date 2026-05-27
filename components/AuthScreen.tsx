'use client';
import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AUTH_ERR } from '@/lib/utils';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [nick, setNick] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [errColor, setErrColor] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setErrMsg('');
    setErrColor('');
  };

  const handleSubmit = async () => {
    setErrMsg('');
    setErrColor('');
    if (!email || !password) {
      setErrMsg('이메일과 비밀번호를 입력해주세요');
      return;
    }
    if (authMode === 'register') {
      if (!nick) { setErrMsg('닉네임을 입력해주세요'); return; }
      if (password !== password2) { setErrMsg('비밀번호가 일치하지 않아요'); return; }
      if (password.length < 6) { setErrMsg('비밀번호는 6자 이상이어야 해요'); return; }
    }
    setLoading(true);
    try {
      if (authMode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: nick });
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid, nickname: nick, email,
          coupleCode: '', kicked: false,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      setErrMsg(AUTH_ERR[err.code || ''] || '오류: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPw = async () => {
    setErrMsg('');
    setErrColor('');
    if (!email) { setErrMsg('위에 이메일을 먼저 입력해주세요'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setErrColor('#27ae60');
      setErrMsg('재설정 링크를 이메일로 보냈어요 ✓');
    } catch (e: unknown) {
      const err = e as { code?: string };
      setErrMsg(AUTH_ERR[err.code || ''] || '이메일을 확인해주세요');
    }
  };

  return (
    <div className="screen">
      <div className="auth-card">
        <div className="auth-logo">💕</div>
        <div className="auth-title">Please Woonyo</div>
        <div className="auth-sub">우뇨야, 데이트를 받아줘<br />우리만의 공간이에요 🌸</div>
        <div className="auth-tab-row">
          <button
            className={'auth-tab' + (authMode === 'login' ? ' active' : '')}
            onClick={() => switchMode('login')}
          >로그인</button>
          <button
            className={'auth-tab' + (authMode === 'register' ? ' active' : '')}
            onClick={() => switchMode('register')}
          >회원가입</button>
        </div>
        <input
          type="email"
          className="form-input"
          placeholder="이메일"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ marginBottom: '10px' }}
        />
        <input
          type="password"
          className="form-input"
          placeholder="비밀번호"
          autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && authMode === 'login') handleSubmit(); }}
          style={{ marginBottom: '10px' }}
        />
        {authMode === 'register' && (
          <>
            <input
              type="password"
              className="form-input"
              placeholder="비밀번호 확인"
              autoComplete="new-password"
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              style={{ marginBottom: '10px' }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="닉네임 (앱에서 사용할 이름)"
              maxLength={10}
              value={nick}
              onChange={e => setNick(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              style={{ marginBottom: '10px' }}
            />
          </>
        )}
        <button
          className="btn btn-rose btn-full"
          onClick={handleSubmit}
          disabled={loading}
          style={{ marginBottom: '8px' }}
        >
          {loading ? '처리 중...' : authMode === 'login' ? '로그인' : '회원가입'}
        </button>
        {authMode === 'login' && (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleForgotPw}
              style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--text3)', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: '4px 0' }}
            >비밀번호를 잊으셨나요?</button>
          </div>
        )}
        <div className="err-msg" style={{ color: errColor || 'var(--rose)' }}>{errMsg}</div>
        <div className="auth-note">커플 전용 데이트 앱 💌</div>
      </div>
    </div>
  );
}
