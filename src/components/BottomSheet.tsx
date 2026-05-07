import React from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  height?: 'half' | 'full';
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  height = 'half',
}) => {
  if (!isOpen) return null;

  const heightClass = height === 'half' ? 'h-[50vh]' : 'h-[90vh]';

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative z-50 w-full ${heightClass} bg-surface-1 border-t border-border rounded-t-2xl flex flex-col animate-in slide-in-from-bottom`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <h2 className="text-base font-serif-sc text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-2 rounded-lg transition-colors text-muted-foreground"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
};
