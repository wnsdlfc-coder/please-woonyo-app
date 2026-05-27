'use client';

interface AppBarProps {
  currentNick: string;
  onLogout: () => void;
}

export default function AppBar({ currentNick, onLogout }: AppBarProps) {
  return (
    <div className="top-nav">
      <div className="app-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--rose)" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
        <div className="app-title">Please Woonyo</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="user-chip">
          <div className="user-dot" />
          <div className="user-chip-name">{currentNick || '-'}</div>
        </div>
        <button className="logout-btn" onClick={onLogout}>나가기</button>
      </div>
    </div>
  );
}
