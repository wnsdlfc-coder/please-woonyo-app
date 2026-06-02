export interface ChatRoom {
  id: string;
  title: string;
  coupleCode: string;
  createdBy: string;
  createdAt: { seconds?: number } | null;
}

export interface Message {
  id: string;
  fromUser: string;
  text: string;
  chatRoomId?: string;
  createdAt: { seconds?: number } | null;
  readAt: { seconds?: number } | null;
  selfDestruct?: boolean;
  chatMode?: boolean;
}
