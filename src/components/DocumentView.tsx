import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { Printer, X, Settings } from 'lucide-react';
import { ReceiptSettings } from './ReceiptSettings';
import { ReceiptTemplate } from './ReceiptTemplate';

interface DocumentViewProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  payment: any;
  type: 'payment' | 'project_payment' | 'other_income';
  projectName?: string;
  onPrint: (id: string) => void;
  userRole?: string;
  onStylesChange?: (styles: any) => void;
}

export const DocumentView: React.FC<DocumentViewProps> = ({
  isOpen,
  onClose,
  profile,
  payment,
  type,
  projectName,
  onPrint,
  userRole = 'resident',
  onStylesChange
}) => {
  const { t, i18n } = useTranslation();
  
  // Initialize styles from profile if available
  const initialStyles = React.useMemo(() => {
    if (profile?.receipt_settings) {
      try {
        return typeof profile.receipt_settings === 'string' 
          ? JSON.parse(profile.receipt_settings) 
          : profile.receipt_settings;
      } catch (e) {
        console.error('Error parsing receipt settings:', e);
      }
    }
    return {
      textColor: '#1f2937',
      backgroundColor: '#ffffff',
      fontWeight: 'normal',
      fontSize: '16px',
      stampSize: '200px',
      logoSize: '128px',
      logoPosition: 'center' as const
    };
  }, [profile?.receipt_settings]);

  const [receiptStyles, setReceiptStyles] = useState(initialStyles);
  const [showSettings, setShowSettings] = useState(false);

  // Update styles when profile changes (e.g. when loaded)
  React.useEffect(() => {
    setReceiptStyles(initialStyles);
  }, [initialStyles]);

  const handleStylesChange = (newStyles: any) => {
    setReceiptStyles(newStyles);
    if (onStylesChange) {
      onStylesChange(newStyles);
    }
  };

  if (!isOpen || !payment) return null;

  const isSyndic = userRole === 'syndic';

  return (
    <div className="fixed inset-0 z-[100] bg-gray-200 flex flex-col no-print ltr" dir="ltr">
      {/* Toolbar */}
      <div className="h-16 bg-white border-b border-gray-300 flex items-center justify-between px-6 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={onClose}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <X className="w-4 h-4" />
            {t('Close')}
          </Button>
          <div className="h-6 w-px bg-gray-300 mx-2"></div>
          <h2 className="font-semibold text-gray-700">{t('Receipt Preview')}</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 ${showSettings ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}`}
            >
              <Settings className={`w-4 h-4 ${showSettings ? 'animate-spin-slow' : ''}`} />
              {t('Settings')}
            </Button>
            
            {showSettings && (
              <div className="absolute top-full mt-2 z-20 right-0">
                <ReceiptSettings styles={receiptStyles} onChange={handleStylesChange} />
              </div>
            )}
          </div>

          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => onPrint('printable-document-content')}
            className="flex items-center gap-2 shadow-md shadow-blue-200"
          >
            <Printer className="w-4 h-4" />
            {t('Print')}
          </Button>
        </div>
      </div>

      {/* Document Area */}
      <div className="flex-1 overflow-auto p-8 flex justify-center bg-gray-200/50 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent">
        <div 
          id="printable-document-content"
          className="bg-white shadow-[0_0_50px_rgba(0,0,0,0.1)] min-h-[297mm] w-[210mm] p-[20mm] origin-top transition-all duration-300"
        >
          <ReceiptTemplate 
            profile={profile} 
            payment={payment} 
            type={type} 
            projectName={projectName}
            customStyles={receiptStyles}
          />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        @media print {
          @page { margin: 1cm !important; }
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            border-color: inherit !important;
          }
          .border-b, .border-t, .border-l, .border-r, .border, .border-2, .border-b-2, .border-e-2 {
            border-style: solid !important;
            border-color: #6D6D6E !important;
          }
          .border-2 {
            border-width: 2px !important;
          }
          .border-b-2 {
            border-bottom-width: 2px !important;
          }
          .border-e-2 {
            border-inline-end-width: 2px !important;
          }
          #printable-document-content {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }
        }
      `}} />
    </div>
  );
};
