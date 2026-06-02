'use client';
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { formatTime } from '@/lib/utils';
import type { ChatRoom, Message } from './types';

interface ChatRoomListProps {
  currentNick: string;
  currentCoupleCode: string;
  allChatRooms: ChatRoom[];
  allMessages: Message[];
  onSelectRoom: (room: ChatRoom) => void;
  showToast: (msg: string, isErr?: boolean) => void;
}

const ROOM_EMOJIS = ['💬', '💕', '⚡', '🗺️', '🎉', '🌙', '✏️', '🔥'];

export default function ChatRoomList({
  currentNick, currentCoupleCode, allChatRooms, allMessages, onSelectRoom, showToast,
}: ChatRoomListProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [menuRoomId, setMenuRoomId] = useState<string | null>(null);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const getLastMsg = (roomId: string) => {
    const msgs = allMessages.filter(m => m.chatRoomId === roomId);
    return msgs[msgs.length - 1] ?? null;
  };

  const getUnread = (roomId: string) =>
    allMessages.filter(m => m.chatRoomId === roomId && m.fromUser !== currentNick && !m.readAt).length;

  const sorted = [...allChatRooms].sort((a, b) => {
    const aT = (getLastMsg(a.id)?.createdAt as { seconds?: number })?.seconds ?? (a.createdAt as { seconds?: number })?.seconds ?? 0;
    const bT = (getLastMsg(b.id)?.createdAt as { seconds?: number })?.seconds ?? (b.createdAt as { seconds?: number })?.seconds ?? 0;
    return bT - aT;
  });

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    await addDoc(collection(db, 'chatRooms'), {
      title, coupleCode: currentCoupleCode, createdBy: currentNick, createdAt: serverTimestamp(),
    });
    setNewTitle(''); setCreateOpen(false);
    showToast('채팅방이 만들어졌어요! 💬');
  };

  const handleRename = async (id: string) => {
    const title = editTitle.trim();
    if (!title) return;
    await updateDoc(doc(db, 'chatRooms', id), { title });
    setEditRoomId(null);
    showToast('이름이 바뀌었어요');
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'chatRooms', id));
    setMenuRoomId(null);
    showToast('채팅방이 삭제됐어요');
  };

  return (
    <div className="page active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div className="page-title" style={{ margin: 0 }}>채팅</div>
        <button className="btn btn-rose btn-sm" onClick={() => setCreateOpen(true)}>+ 새 채팅방</button>
      </div>

      {sorted.length === 0 && (
        <div className="empty-state" style={{ marginTop: '48px' }}>
          아직 채팅방이 없어요<br />
          <span style={{ fontSize: '12px', marginTop: '6px', display: 'block', color: 'var(--text3)' }}>
            + 새 채팅방을 만들어보세요
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sorted.map(room => {
          const last = getLastMsg(room.id);
          const unread = getUnread(room.id);
          const emoji = ROOM_EMOJIS[room.id.charCodeAt(0) % ROOM_EMOJIS.length];
          const isEditing = editRoomId === room.id;

          return (
            <div
              key={room.id}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px 14px' }}
              onClick={() => { if (!isEditing && menuRoomId !== room.id) onSelectRoom(room); }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: '14px', flexShrink: 0,
                background: 'linear-gradient(135deg,var(--rose3),var(--rose4))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
              }}>{emoji}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  {isEditing ? (
                    <input
                      autoFocus
                      className="form-input"
                      style={{ fontSize: '13px', padding: '3px 8px', height: '28px', flex: 1 }}
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(room.id);
                        if (e.key === 'Escape') setEditRoomId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {room.title}
                    </div>
                  )}
                  {unread > 0 && !isEditing && (
                    <div style={{ background: 'var(--rose)', color: 'white', fontSize: '10px', fontWeight: 800, borderRadius: '10px', padding: '1px 6px', flexShrink: 0 }}>
                      {unread}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {last
                    ? (last.fromUser === currentNick ? '나: ' : '') + (last.selfDestruct ? '💣 자동삭제 메시지' : last.text)
                    : '아직 대화가 없어요'}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                {last && (
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>
                    {formatTime(last.createdAt as Parameters<typeof formatTime>[0])}
                  </div>
                )}
                <button
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text3)', padding: '2px 4px', lineHeight: 1 }}
                  onClick={e => { e.stopPropagation(); setMenuRoomId(menuRoomId === room.id ? null : room.id); }}
                >⋯</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ⋯ 드롭다운 메뉴 */}
      {menuRoomId && (
        <>
          <div onClick={() => setMenuRoomId(null)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
          <div style={{
            position: 'fixed', bottom: 84, left: '50%', transform: 'translateX(-50%)',
            background: '#FFFDF9', borderRadius: '16px', padding: '6px', zIndex: 200,
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)', minWidth: '180px',
          }}>
            <button
              style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', borderRadius: '10px' }}
              onClick={() => {
                const room = allChatRooms.find(r => r.id === menuRoomId);
                if (room) { setEditTitle(room.title); setEditRoomId(room.id); }
                setMenuRoomId(null);
              }}
            >✏️ 이름 바꾸기</button>
            <button
              style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--rose)', borderRadius: '10px' }}
              onClick={() => handleDelete(menuRoomId)}
            >🗑️ 채팅방 삭제</button>
          </div>
        </>
      )}

      {/* 새 채팅방 모달 */}
      <div className={'modal-bg' + (createOpen ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) setCreateOpen(false); }}>
        <div className="modal">
          <div className="modal-bar" />
          <div className="modal-title">새 채팅방 만들기 💬</div>
          <div className="form-group">
            <label className="form-label">채팅방 이름</label>
            <input
              autoFocus
              type="text"
              className="form-input"
              placeholder="예) 데이트 코스 짜기, 싸우는 방..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline btn-full" onClick={() => { setCreateOpen(false); setNewTitle(''); }}>취소</button>
            <button className="btn btn-rose btn-full" onClick={handleCreate}>만들기</button>
          </div>
        </div>
      </div>
    </div>
  );
}
