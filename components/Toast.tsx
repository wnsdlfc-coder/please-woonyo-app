'use client';
import { useEffect, useRef } from 'react';

interface ToastProps {
  message: string;
  isError?: boolean;
  visible: boolean;
}

export default function Toast({ message, isError, visible }: ToastProps) {
  return (
    <div
      className={'toast' + (visible ? ' show' : '')}
      style={{ background: isError ? '#C0392B' : 'rgba(26,26,26,0.9)' }}
    >
      {message}
    </div>
  );
}

// Global toast helper hook
import { useState, useCallback } from 'react';

export function useToast() {
  const [toast, setToast] = useState({ message: '', isError: false, visible: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, isErr = false) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message: msg, isError: isErr, visible: true });
    timerRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2800);
  }, []);

  return { toast, showToast };
}
