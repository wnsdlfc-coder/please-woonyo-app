'use client';
import { useState } from 'react';
import ChatRoomList from './chat/ChatRoomList';
import ChatRoomView from './chat/ChatRoomView';
import type { ChatRoom, Message } from './chat/types';

export interface ChatPageProps {
  currentNick: string;
  currentCoupleCode: string;
  allChatRooms: ChatRoom[];
  allMessages: Message[];
  onSendMessage: (text: string, selfDestruct: boolean, roomId: string) => void;
  showToast: (msg: string, isErr?: boolean) => void;
}

export default function ChatPage({
  currentNick, currentCoupleCode, allChatRooms, allMessages, onSendMessage, showToast,
}: ChatPageProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const selectedRoom = selectedRoomId
    ? allChatRooms.find(r => r.id === selectedRoomId) ?? null
    : null;

  // 방이 삭제된 경우 목록으로 복귀
  if (selectedRoomId && !selectedRoom) {
    setSelectedRoomId(null);
    return null;
  }

  if (selectedRoom) {
    return (
      <ChatRoomView
        room={selectedRoom}
        currentNick={currentNick}
        allMessages={allMessages}
        onSendMessage={onSendMessage}
        onBack={() => setSelectedRoomId(null)}
      />
    );
  }

  return (
    <ChatRoomList
      currentNick={currentNick}
      currentCoupleCode={currentCoupleCode}
      allChatRooms={allChatRooms}
      allMessages={allMessages}
      onSelectRoom={room => setSelectedRoomId(room.id)}
      showToast={showToast}
    />
  );
}
