'use client';

type PageId = 'home' | 'apply' | 'chat' | 'calendar' | 'map' | 'my';

interface BottomNavProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  unreadMsgCount: number;
}

export default function BottomNav({ activePage, onNavigate, unreadMsgCount }: BottomNavProps) {
  const item = (page: PageId, label: string, icon: React.ReactNode, badge?: boolean) => (
    <button
      className={'nav-item' + (activePage === page ? ' active' : '')}
      onClick={() => onNavigate(page)}
      style={{ position: 'relative' }}
    >
      {icon}
      <span className="nav-label">{label}</span>
      {badge && unreadMsgCount > 0 && <span className="nav-badge">{unreadMsgCount}</span>}
    </button>
  );

  return (
    <div className="bottom-nav">
      {item('home', '홈',
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><polyline points="9 21 9 13 15 13 15 21"/>
        </svg>
      )}
      {item('apply', '신청',
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      )}
      {item('chat', '채팅',
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>,
        true
      )}
      {item('calendar', '달력',
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      )}
      {item('map', '지도',
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      )}
      {item('my', '마이',
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      )}
    </div>
  );
}
