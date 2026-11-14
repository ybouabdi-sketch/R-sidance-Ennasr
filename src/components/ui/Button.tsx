import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'dark' | 'lightBlue' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-xl cursor-pointer";
    
    const variants = {
      primary: "bg-btn-primary text-white hover:opacity-90 focus:ring-btn-primary",
      secondary: "bg-btn-secondary text-btn-secondary-text hover:opacity-90 focus:ring-btn-secondary",
      success: "bg-btn-success text-white hover:opacity-90 focus:ring-btn-success",
      dark: "bg-black text-white hover:bg-gray-800 focus:ring-gray-900 dark:bg-gray-600 dark:hover:bg-gray-500",
      lightBlue: "bg-blue-300 text-blue-900 hover:bg-blue-400 focus:ring-blue-400 dark:bg-blue-900/50 dark:text-blue-100 dark:hover:bg-blue-800/50",
      danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700",
      outline: "border border-gray-200 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-200 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
    };

    const sizes = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-6 py-3 text-sm",
      lg: "px-8 py-4 text-lg"
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
