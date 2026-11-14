import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  contentClassName?: string;
  titleClassName?: string;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = 'max-w-md', 
  contentClassName = 'bg-card-bg',
  titleClassName = 'text-app-text'
}: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            role="dialog"
            className={`fixed left-[50%] top-[50%] z-50 w-full ${maxWidth} translate-x-[-50%] translate-y-[-50%] rounded-3xl ${contentClassName} text-app-text p-6 md:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-gray-100 overflow-y-auto max-h-[90vh] scrollbar-hide`}
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100/80">
              <h2 className={`text-xl font-bold tracking-tight ${titleClassName}`}>{title}</h2>
              <button
                onClick={onClose}
                className="rounded-full p-2 bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
