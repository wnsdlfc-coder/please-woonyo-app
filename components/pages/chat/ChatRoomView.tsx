'use client';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { formatTime } from '@/lib/utils';
import type { ChatRoom, Message } from './types';

interface ChatRoomViewProps {
  room: ChatRoom;
  currentNick: string;
  allMessages: Message[];
  onSendMessage: (text: string, selfDestruct: boolean, roomId: string) => void;
  onBack: () => void;
}

export default function ChatRoomView({ room, currentNick, allMessages, onSendMessage, onBack }: ChatRoomViewProps) {
  const [chatInput, setChatInput] = useState('');
  const [selfDestructMode, setSelfDestructMode] = useState(false);
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  const timerRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  const roomMessages = allMessages.filter(m => m.chatRoomId === room.id);

  // 읽음 처리
  useEffect(() => {
    roomMessages.filter(m => m.fromUser !== currentNick && !m.readAt).forEach(m => {
      updateDoc(doc(db, 'notes', m.id), { readAt: serverTimestamp() }).catch(() => {});
    });
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMessages, currentNick]);

  // 자동삭제 타이머
  useEffect(() => {
    roomMessages
      .filter(m => m.selfDestruct && m.fromUser !== currentNick && m.readAt && !timerRefs.current[m.id])
      .forEach(m => {
        const readSec = (m.readAt as { seconds?: number })?.seconds;
        const readTime = readSec ? readSec * 1000 : Date.now();
        const remaining = Math.max(0, 10000 - (Date.now() - readTime));
        if (remaining <= 0) { deleteDoc(doc(db, 'notes', m.id)).catch(() => {}); return; }
        setCountdowns(prev => ({ ...prev, [m.id]: Math.ceil(remaining / 1000) }));
        timerRefs.current[m.id] = setInterval(() => {
          setCountdowns(prev => {
            const next = (prev[m.id] || 1) - 1;
            if (next <= 0) {
              clearInterval(timerRefs.current[m.id]);
              delete timerRefs.current[m.id];
              deleteDoc(doc(db, 'notes', m.id)).catch(() => {});
              const u = { ...prev }; delete u[m.id]; return u;
            }
            return { ...prev, [m.id]: next };
          });
        }, 1000);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMessages, currentNick]);

  useEffect(() => () => { Object.values(timerRefs.current).forEach(clearInterval); }, []);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim(), selfDestructMode, room.id);
    setChatInput('');
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  return (
    <div className="page active" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text2)', padding: '0', lineHeight: 1, flexShrink: 0 }}
        >←</button>
        <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {room.title}
        </div>
      </div>

      {/* 메시지 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '8px' }}>
        {roomMessages.length === 0 && (
          <div className="empty-state">아직 대화가 없어요<br />먼저 말을 걸어봐요 💬</div>
        )}
        {roomMessages.map(m => {
          const isMine = m.fromUser === currentNick;
          const countdown = countdowns[m.id];
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
              <div className={`chat-bubble ${isMine ? 'mine' : 'theirs'}`}>
                {m.selfDestruct && (
                  <div className="chat-destruct-label">
                    💣 {countdown ? `${countdown}초 후 삭제` : m.readAt ? '곧 삭제...' : '읽으면 10초 후 삭제'}
                  </div>
                )}
                {m.text}
              </div>
              <div className={`chat-time ${isMine ? 'mine' : 'theirs'}`}>
                {formatTime(m.createdAt as Parameters<typeof formatTime>[0])}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* 입력 */}
      <div style={{ flexShrink: 0, paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setSelfDestructMode(v => !v)}
          style={{
            padding: '4px 12px', borderRadius: '20px', marginBottom: '8px',
            border: '1.5px solid ' + (selfDestructMode ? 'var(--rose)' : 'var(--border)'),
            background: selfDestructMode ? 'var(--rose4)' : 'transparent',
            color: selfDestructMode ? 'var(--rose)' : 'var(--text3)',
            fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {selfDestructMode ? '💣 자동삭제 ON · 읽고 10초 후 삭제' : '💣 자동삭제'}
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="메시지를 입력해요..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            style={{ flex: 1, borderRadius: '24px', padding: '10px 16px' }}
          />
          <button
            onClick={handleSend}
            style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: 'var(--rose)', border: 'none', color: 'white',
              fontSize: '18px', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >↑</button>
        </div>
      </div>
    </div>
  );
}
