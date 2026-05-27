'use client';
import { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  open: boolean;
  message: string;
  onOk: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ open, message, onOk, onCancel }: ConfirmModalProps) {
  return (
    <div className={'modal-bg' + (open ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal modal-center" style={{ padding: '28px 24px 28px' }}>
        <div className="modal-title" style={{ fontSize: '16px', textAlign: 'center', marginBottom: '20px' }}>{message}</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline btn-full" onClick={onCancel}>취소</button>
          <button className="btn btn-rose btn-full" onClick={onOk}>확인</button>
        </div>
      </div>
    </div>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  return (
    <div className={'modal-bg' + (open ? ' open' : '')} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-bar" />
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}
