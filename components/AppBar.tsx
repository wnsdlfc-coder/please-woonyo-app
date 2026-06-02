'use client';
import { useState, useEffect } from 'react';

interface AppBarProps {
  currentNick: string;
  onLogout: () => void;
  roomTitle?: string;
}

export default function AppBar({ currentNick, onLogout, roomTitle }: AppBarProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme') === 'dark';
    setIsDark(saved);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  };

  return (
    <div className="top-nav">
      <div className="app-logo" style={{ gap: '10px' }}>
        <img
          src="/logo.png"
          alt="Please Woonyo"
          width={30}
          height={30}
          style={{ objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.5px', lineHeight: 1 }}>
            PLEASE WOONYO
          </div>
          {roomTitle && (
            <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--rose)', letterSpacing: '-0.5px', lineHeight: 1.2, marginTop: '1px' }}>
              {roomTitle}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={toggleTheme}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px 6px', lineHeight: 1 }}
          aria-label="다크모드 토글"
        >
          {isDark ? '☀️' : '🌙'}
        </button>
        <div className="user-chip">
          <div className="user-dot" />
          <div className="user-chip-name">{currentNick || '-'}</div>
        </div>
        <button className="logout-btn" onClick={onLogout}>나가기</button>
      </div>
    </div>
  );
}
