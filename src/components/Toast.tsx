'use client';
import { useCallback, useState } from 'react';

export interface ToastItemData {
  id: number;
  message: string;
}

export default function ToastContainer({ toasts }: { toasts: ToastItemData[] }) {
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: ToastItemData }) {
  return (
    <div
      className="toast-enter bg-white text-[#121213] font-bold text-sm px-4 py-2 rounded shadow-lg whitespace-nowrap"
    >
      {toast.message}
    </div>
  );
}

// Hook to manage toasts
export function useToasts() {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);

  const addToast = useCallback((message: string, duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return { toasts, addToast };
}
