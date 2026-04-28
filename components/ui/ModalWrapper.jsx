'use client';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

export default function ModalWrapper({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // prevent background scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      {children}
    </div>,
    document.body
  );
}