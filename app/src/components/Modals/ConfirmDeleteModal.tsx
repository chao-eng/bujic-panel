'use client';

import React, { useTransition } from 'react';
import { useTranslation } from '../I18nProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
}: ConfirmDeleteModalProps) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      await onConfirm();
      onClose();
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] bg-[#12131a]/95 border border-white/5 text-white/90 rounded-2xl backdrop-blur-xl">
        <DialogHeader className="flex flex-col items-center text-center pt-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-2">
            <AlertTriangle size={24} />
          </div>
          <DialogTitle className="font-heading text-lg font-bold text-white">
            {title || t.deleteBookmark}
          </DialogTitle>
          <DialogDescription className="text-xs text-white/40 mt-1 max-w-[280px]">
            {description || t.confirmDelete}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="grid grid-cols-2 gap-2 mt-5 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="w-full px-4 py-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 active:scale-95 transition text-xs font-medium text-white/70 cursor-pointer disabled:opacity-40"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 active:scale-95 text-red-400 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-40"
          >
            {isPending && <Loader2 size={13} className="animate-spin" />}
            <span>{t.delete}</span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
