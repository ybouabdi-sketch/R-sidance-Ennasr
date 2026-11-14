import React from 'react';
import { motion } from 'motion/react';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}

interface BottomNavProps {
  items: NavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-footer-bg border-t border-card-border px-4 py-2 flex justify-around items-center z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] print:hidden">
      {items.map((item, index) => (
        <button
          key={index}
          onClick={item.onClick}
          className="flex flex-col items-center gap-1 p-2 transition-colors relative"
        >
          <span className={`transition-colors ${item.isActive ? 'text-footer-selected' : 'text-footer-icon'}`}>
            {item.icon}
          </span>
          <span className={`text-[10px] font-medium transition-colors ${item.isActive ? 'text-footer-selected' : 'text-footer-text'}`}>
            {item.label}
          </span>
          {item.isActive && (
            <motion.div
              layoutId="bottom-nav-indicator"
              className="absolute -top-2 w-8 h-1 bg-footer-selected rounded-full"
            />
          )}
        </button>
      ))}
    </nav>
  );
}
