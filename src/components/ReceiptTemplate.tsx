import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/format';

interface ReceiptTemplateProps {
  profile: any;
  payment: any;
  type: 'payment' | 'project_payment' | 'other_income';
  projectName?: string;
  customStyles?: {
    textColor?: string;
    backgroundColor?: string;
    fontWeight?: string;
    fontSize?: string;
    stampSize?: string;
    logoSize?: string;
    logoPosition?: 'left' | 'right' | 'center';
    receiptTitleBgColor?: string;
    detailsTitleBgColor?: string;
  };
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ 
  profile, 
  payment, 
  type, 
  projectName,
  customStyles 
}) => {
  const { t } = useTranslation();
  const isRtl = false;

  const styles: React.CSSProperties = {
    color: customStyles?.textColor || 'inherit',
    backgroundColor: 'white',
    fontWeight: customStyles?.fontWeight || 'normal',
    fontSize: customStyles?.fontSize || 'inherit',
    fontFamily: isRtl ? "'Cairo', 'Tajawal', sans-serif" : "'Outfit', 'Inter', sans-serif",
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  } as any;

  const logoPos = customStyles?.logoPosition || 'center';
  const logoMarginClass = logoPos === 'center' ? 'mb-4' : 'mb-2';

  const getMonthNumber = (monthName: string) => {
    const monthsAr = ["يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو", "يوليوز", "غشت", "شتنبر", "أكتوبر", "نونبر", "دجنبر"];
    const monthsFr = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const monthsFrShort = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const cleanName = monthName.trim().toLowerCase();
    
    let index = monthsAr.findIndex(m => m === monthName.trim());
    if (index === -1) index = monthsFr.findIndex(m => m.toLowerCase() === cleanName);
    if (index === -1) index = monthsFrShort.findIndex(m => m.toLowerCase() === cleanName);
    if (index === -1) index = monthsEn.findIndex(m => m.toLowerCase() === cleanName);
    
    if (index !== -1) {
      return (index + 1).toString().padStart(2, '0');
    }
    return '';
  };

  let paymentNature = '';
  let periodOrProject: React.ReactNode = '';
  let nameValue = '';
  let building = '';
  let apartment = '';
  let propertyType = '';
  let receiptTitle = '';
  
  let rows: { period: React.ReactNode, description: string, dueAmount: number, paidAmount: number }[] = [];

  if (type === 'payment') {
    paymentNature = t('Syndic Fee');
    receiptTitle = t('Monthly Payment Receipt');
    
    // Check if resident has a negative balance
    if (payment.current_balance !== undefined && payment.current_balance < 0) {
      periodOrProject = (
        <span className="text-red-600 font-bold">
          {t('Remaining balance until payment date')}
        </span>
      );
      rows.push({
        period: periodOrProject,
        description: paymentNature,
        dueAmount: payment.amount,
        paidAmount: payment.amount
      });
    } else {
      const monthsSource = payment.months || payment.monthsText;
      periodOrProject = `${monthsSource ? monthsSource + ' ' : ''}${payment.year || ''}`;
      
      let monthsArray: string[] = [];
      if (monthsSource) {
        try {
          // Try to parse if it's a JSON string
          const parsed = typeof monthsSource === 'string' && monthsSource.startsWith('[') 
            ? JSON.parse(monthsSource) 
            : monthsSource;
            
          if (Array.isArray(parsed)) {
            monthsArray = parsed;
          } else if (typeof monthsSource === 'string') {
            monthsArray = monthsSource.split(/[,،]\s*/).filter(Boolean);
          }
        } catch (e) {
          // If not JSON, split by comma
          if (typeof monthsSource === 'string') {
            monthsArray = monthsSource.split(/[,،]\s*/).filter(Boolean);
          }
        }
      }
      
      if (monthsArray.length > 0) {
        const amountPerMonth = payment.amount / monthsArray.length;
        
        // Calculate years for each month by working backwards from payment.year
        let currentYear = parseInt(payment.year) || new Date().getFullYear();
        const tempRows: { period: React.ReactNode, description: string, dueAmount: number, paidAmount: number }[] = [];
        
        for (let i = monthsArray.length - 1; i >= 0; i--) {
          const month = monthsArray[i];
          const monthNum = getMonthNumber(month);
          
          if (i < monthsArray.length - 1) {
            const nextMonth = monthsArray[i+1];
            const nextMonthNum = getMonthNumber(nextMonth);
            const thisMonthNum = getMonthNumber(month);
            
            // If we move from January (next) back to December (this), decrement year
            if (thisMonthNum === '12' && nextMonthNum === '01') {
              currentYear--;
            }
          }
          
          const desc = monthNum ? `${t('Monthly Fee')} - ${currentYear}-${monthNum}` : paymentNature;
          tempRows.push({
            period: `${month} ${currentYear}`,
            description: desc,
            dueAmount: amountPerMonth,
            paidAmount: amountPerMonth
          });
        }
        
        // Reverse back to original order
        rows.push(...tempRows.reverse());
      } else {
        rows.push({
          period: payment.year ? payment.year.toString() : '-',
          description: paymentNature,
          dueAmount: payment.amount,
          paidAmount: payment.amount
        });
      }
    }
    
    nameValue = payment.full_name;
    building = payment.building;
    apartment = payment.apartment;
    propertyType = payment.property_type || '';
  } else if (type === 'project_payment') {
    paymentNature = t('Project Payment');
    receiptTitle = t('Project Payment Receipt');
    periodOrProject = projectName || payment.project_name || '';
    rows.push({
      period: periodOrProject,
      description: paymentNature,
      dueAmount: payment.amount,
      paidAmount: payment.amount
    });
    nameValue = payment.full_name;
    building = payment.building;
    apartment = payment.apartment;
    propertyType = payment.property_type || '';
  } else if (type === 'other_income') {
    if (payment.income_type === 'rental' || payment.tenant_name) {
      paymentNature = t('Rental Income');
      receiptTitle = t('Rental Payment Receipt');
      nameValue = payment.contributor_name || payment.tenant_name;
      propertyType = payment.property_type || '';
      if (payment.monthsText) {
        periodOrProject = payment.monthsText;
        let monthsArray = payment.monthsText.split(/[,،]\s*/).filter(Boolean);
        if (monthsArray.length > 0) {
          const amountPerMonth = payment.amount / monthsArray.length;
          monthsArray.forEach((month: string) => {
            rows.push({
              period: month,
              description: paymentNature,
              dueAmount: amountPerMonth,
              paidAmount: amountPerMonth
            });
          });
        } else {
          rows.push({
            period: periodOrProject,
            description: paymentNature,
            dueAmount: payment.amount,
            paidAmount: payment.amount
          });
        }
      } else {
        rows.push({
          period: '-',
          description: paymentNature,
          dueAmount: payment.amount,
          paidAmount: payment.amount
        });
      }
    } else {
      paymentNature = t('Exceptional Income');
      receiptTitle = t('Payment Receipt');
      nameValue = payment.contributor_name;
      periodOrProject = t(payment.income_type);
      propertyType = payment.property_type || '';
      rows.push({
        period: periodOrProject,
        description: paymentNature,
        dueAmount: payment.amount,
        paidAmount: payment.amount
      });
    }
  }

  const chunkRows = (arr: any[], size: number) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const rowChunks = chunkRows(rows, 12);

  return (
    <div className="receipt-print-wrapper">
      {rowChunks.map((chunk, pageIndex) => (
        <div 
          key={pageIndex}
          className={`receipt-container bg-white text-gray-800 font-sans flex flex-col p-8 print:p-0 ${isRtl ? 'text-right' : 'text-left'} ${pageIndex < rowChunks.length - 1 ? 'print:break-after-page' : ''}`} 
          dir={isRtl ? 'rtl' : 'ltr'}
          style={styles}
        >
          {/* Header */}
          <div className="mb-4 print:mb-2">
            <div className={`flex items-start justify-between mb-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              {profile?.profile_picture && (
                <div 
                  className="flex-shrink-0 bg-white rounded-full p-1 shadow-md border border-gray-100 z-10"
                  style={{ width: customStyles?.logoSize || '90px', height: customStyles?.logoSize || '90px', marginTop: '-10px' }}
                >
                  <img src={profile.profile_picture} alt="Logo" className="w-full h-full object-contain rounded-full" />
                </div>
              )}
              <div className={`flex-1 flex flex-col ${isRtl ? 'mr-4 text-right' : 'ml-4 text-left'}`}>
                <h1 className="text-2xl font-black text-blue-900 uppercase tracking-tight mb-1 leading-tight">
                  {t('Residence')} — {profile?.residence_name || ''}
                </h1>
                <div 
                  className="w-full text-white px-6 py-2 font-bold shadow-sm rounded-sm text-sm text-center" 
                  style={{ 
                    backgroundColor: customStyles?.receiptTitleBgColor || '#06338F',
                    WebkitPrintColorAdjust: 'exact', 
                    printColorAdjust: 'exact',
                  }}
                >
                  {profile?.residence_address || ''}
                </div>
              </div>
            </div>
          </div>
          
          {/* Date and Receipt Number */}
          <div className={`flex justify-between items-center bg-gray-50 p-3 border-solid mb-4 ${isRtl ? 'border-r-4 border-teal-600' : 'border-l-4 border-teal-600'}`}>
            <div className={isRtl ? 'text-right' : 'text-left'}>
              <div className="text-gray-500 text-xs">{t('Date')}</div>
              <div className="font-bold text-base">{payment.date}</div>
            </div>
            <div className="flex-1 flex items-center justify-center px-4">
              <h2 className="text-xl font-bold text-gray-800 text-center">{receiptTitle}</h2>
            </div>
            <div className={isRtl ? 'text-left' : 'text-right'}>
              <div className="text-gray-500 text-xs">{t('Receipt Number')}</div>
              <div className="font-bold text-base">{payment.receipt_number || payment.id}</div>
            </div>
          </div>

          {/* Two Columns Info */}
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            {/* Payer Info */}
            <div>
              <h3 className="text-blue-900 font-bold border-b border-solid border-gray-200 pb-1 mb-2">{t('Payer Information')}</h3>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">{t('Full Name')}:</span>
                <span className="font-medium">{nameValue}</span>
              </div>
              {propertyType && (
                <div className="flex justify-between mb-1">
                  <span className="text-gray-600">{t('Property Type')}:</span>
                  <span className="font-medium">{t(propertyType)}</span>
                </div>
              )}
              {payment.property_address && (
                <div className="flex justify-between mb-1">
                  <span className="text-gray-600">{t('Property Address')}:</span>
                  <span className="font-medium">{payment.property_address}</span>
                </div>
              )}
              {apartment && (
                <div className="flex justify-between mb-1">
                  <span className="text-gray-600">{t('Apartment')}:</span>
                  <span className="font-medium">{apartment}</span>
                </div>
              )}
              {building && (
                <div className="flex justify-between mb-1">
                  <span className="text-gray-600">{t('Building')}:</span>
                  <span className="font-medium">{building}</span>
                </div>
              )}
            </div>
            
            {/* Syndic Info */}
            <div>
              <h3 className="text-blue-900 font-bold border-b border-solid border-gray-200 pb-1 mb-2">{t('Syndicate Information')}</h3>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">{t('Residence Name')}:</span>
                <span className="font-medium">{profile?.residence_name}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">{t('Address')}:</span>
                <span className="font-medium">{profile?.residence_address}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">{t('Syndic Name')}:</span>
                <span className="font-medium">{profile?.full_name}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">{t('Phone')}:</span>
                <span className="font-medium" dir="ltr">{profile?.phone}</span>
              </div>
            </div>
          </div>

          {/* Amount Box - Only on first page */}
          {pageIndex === 0 && (
            <div className="border-2 border-solid border-emerald-500 bg-emerald-50 rounded-lg p-3 text-center mb-4">
              <div className="text-2xl font-black text-emerald-800">
                {formatCurrency(payment.amount, profile?.currency || 'DH')}
              </div>
            </div>
          )}

          {/* Payment Details - Only on first page */}
          {pageIndex === 0 && (
            <div className="mb-4 text-sm">
              <h3 className="text-blue-900 font-bold border-b border-solid border-gray-200 pb-1 mb-2">{t('Payment Details')}</h3>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('Payment Method')}:</span>
                <span className="font-medium">{t(payment.payment_type || 'cash')}</span>
              </div>
            </div>
          )}

          {/* Paid Dues Table */}
          <div className="mb-4 flex-grow">
            <h3 className="text-blue-900 font-bold mb-2 text-sm">{t('Paid Dues')}</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-blue-900 text-white" style={{ backgroundColor: customStyles?.receiptTitleBgColor || '#1e3a8a', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  <th className="p-2 text-start font-bold border border-solid border-blue-800">{t('Period')}</th>
                  <th className="p-2 text-start font-bold border border-solid border-blue-800">{t('Description')}</th>
                  <th className="p-2 text-end font-bold border border-solid border-blue-800">{t('Due Amount')}</th>
                  <th className="p-2 text-end font-bold border border-solid border-blue-800">{t('Paid Amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-solid divide-gray-200">
                {chunk.map((row, idx) => (
                  <tr key={idx}>
                    <td className="p-2 border border-solid border-gray-200">{row.period}</td>
                    <td className="p-2 border border-solid border-gray-200">{row.description}</td>
                    <td className="p-2 text-end border border-solid border-gray-200">{formatCurrency(row.dueAmount, profile?.currency || 'DH')}</td>
                    <td className="p-2 text-end border border-solid border-gray-200">{formatCurrency(row.paidAmount, profile?.currency || 'DH')}</td>
                  </tr>
                ))}
              </tbody>
              {pageIndex === rowChunks.length - 1 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold border-t-2 border-solid border-blue-900">
                    <td colSpan={3} className="p-2 text-end border border-solid border-gray-200">{t('Total')}:</td>
                    <td className="p-2 text-end border border-solid border-gray-200">{formatCurrency(payment.amount, profile?.currency || 'DH')}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Signature Section */}
          <div className="flex justify-end mt-auto pt-4 print:pt-2">
            <div className="w-64 text-center">
              <div className="font-bold text-blue-900 mb-1 text-sm">{t('Stamp and Signature')}</div>
              <div className="h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center relative bg-gray-50">
                {profile?.stamp_signature ? (
                  <img 
                    src={profile.stamp_signature} 
                    alt="Signature" 
                    className="max-h-full max-w-full object-contain mix-blend-multiply p-1" 
                  />
                ) : null}
              </div>
            </div>
          </div>

          {/* Footer */}
        </div>
      ))}
    </div>
  );
};

