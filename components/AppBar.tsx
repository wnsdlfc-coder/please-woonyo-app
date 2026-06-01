'use client';
import { useState, useEffect } from 'react';

interface AppBarProps {
  currentNick: string;
  onLogout: () => void;
}

export default function AppBar({ currentNick, onLogout }: AppBarProps) {
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
      <div className="app-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--rose)">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
        <div className="app-title">Please Woonyo</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={toggleTheme}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px 6px', lineHeight: 1 }}
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
