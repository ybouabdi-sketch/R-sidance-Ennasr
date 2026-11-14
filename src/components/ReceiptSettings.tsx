import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from './ui/Input';
import { Settings, Type, Image, Stamp, Palette, Maximize } from 'lucide-react';

interface ReceiptSettingsProps {
  styles: {
    textColor: string;
    backgroundColor: string;
    fontWeight: string;
    fontSize: string;
    stampSize: string;
    logoSize: string;
    logoPosition: 'left' | 'right' | 'center';
    receiptTitleBgColor?: string;
    detailsTitleBgColor?: string;
  };
  onChange: (styles: any) => void;
}

export const ReceiptSettings: React.FC<ReceiptSettingsProps> = ({ styles, onChange }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 space-y-6 no-print w-full animate-in fade-in slide-in-from-top-4 duration-300 max-h-[85vh] overflow-y-auto scrollbar-hide">
      <div className="flex items-center justify-between border-b pb-4 border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base">
              {t('Print Settings')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('Customize your document appearance')}
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {/* Font Size */}
        <div className="group">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <Type className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
              {t('Font Size')}
            </label>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase">
              {styles.fontSize}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="range"
              min="8"
              max="24"
              value={parseInt(styles.fontSize)}
              onChange={(e) => onChange({ ...styles, fontSize: `${e.target.value}px` })}
              className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <Input 
              type="number" 
              value={parseInt(styles.fontSize)}
              onChange={(e) => onChange({ ...styles, fontSize: `${e.target.value}px` })}
              className="w-16 h-9 text-center text-sm font-medium"
            />
          </div>
        </div>

        {/* Font Weight */}
        <div className="group">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            <Maximize className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            {t('Font Weight')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['normal', 'medium', 'bold', '900'].map((weight) => (
              <button
                key={weight}
                onClick={() => onChange({ ...styles, fontWeight: weight })}
                className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all ${
                  styles.fontWeight === weight
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300'
                }`}
              >
                {weight === '900' ? t('Extra Bold') : t(weight.charAt(0).toUpperCase() + weight.slice(1))}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Logo Size */}
          <div className="group">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <Image className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
              {t('Logo Size')}
            </label>
            <div className="relative">
              <Input 
                type="number" 
                value={parseInt(styles.logoSize)}
                onChange={(e) => onChange({ ...styles, logoSize: `${e.target.value}px` })}
                className="h-10 pl-3 pr-8 text-sm font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase">px</span>
            </div>
          </div>

          {/* Stamp Size */}
          <div className="group">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <Stamp className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
              {t('Stamp Size')}
            </label>
            <div className="relative">
              <Input 
                type="number" 
                value={parseInt(styles.stampSize)}
                onChange={(e) => onChange({ ...styles, stampSize: `${e.target.value}px` })}
                className="h-10 pl-3 pr-8 text-sm font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase">px</span>
            </div>
          </div>
        </div>

        {/* Banner Color */}
        <div className="group bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <Palette className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
              {t('Banner Color')}
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-500 uppercase">{styles.receiptTitleBgColor || '#06338F'}</span>
              <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-white dark:border-gray-700 shadow-sm">
                <input 
                  type="color" 
                  value={styles.receiptTitleBgColor || '#06338F'}
                  onChange={(e) => onChange({ ...styles, receiptTitleBgColor: e.target.value, detailsTitleBgColor: e.target.value })}
                  className="absolute -inset-2 w-[150%] h-[150%] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
