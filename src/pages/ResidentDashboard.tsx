import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '../components/ui/DashboardLayout';
import { CreditCard, Bell, Mail, FileText, HelpCircle, User, Edit2, Plus, Send, ArrowLeft, BarChart3, Printer, FileDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { SharedNotifications } from '../components/SharedNotifications';
import { formatNumber, formatCurrency } from '../utils/format';
import { ReceiptTemplate } from '../components/ReceiptTemplate';
import { ReceiptSettings } from '../components/ReceiptSettings';
import { DocumentView } from '../components/DocumentView';
import { exportHtmlToPdf } from '../utils/pdfExport';

export default function ResidentDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [prevTab, setPrevTab] = useState<string | null>(null);
  const [resident, setResident] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [automaticReminders, setAutomaticReminders] = useState<any[]>([]);
  const [syndicProfile, setSyndicProfile] = useState<any>(null);
  const [directPrintPayment, setDirectPrintPayment] = useState<any>(null);
  const [printingType, setPrintingType] = useState<'payment' | 'project_payment'>('payment');
  const [paymentYearFilter, setPaymentYearFilter] = useState('');
  const [paymentMonthFilter, setPaymentMonthFilter] = useState('');
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const residentId = localStorage.getItem('userId');

  const fetchData = async () => {
    if (!residentId) return;
    
    try {
      const profileRes = await fetch(`/api/resident/profile/${residentId}`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setResident(profileData);
        
        const syndicRes = await fetch(`/api/syndic/profile/${profileData.syndic_id}`);
        if (syndicRes.ok) {
          setSyndicProfile(await syndicRes.json());
        }
        
        const [contribRes, annRes, compRes, remindersRes] = await Promise.all([
          fetch(`/api/resident/payments/${residentId}`),
          fetch(`/api/syndic/announcements/${profileData.syndic_id}`),
          fetch(`/api/resident/complaints/${residentId}`),
          fetch(`/api/resident/automatic-reminders/${residentId}`)
        ]);

        if (contribRes.ok) {
          const data = await contribRes.json();
          setPayments(Array.isArray(data) ? data : []);
        }
        if (annRes.ok) {
          const data = await annRes.json();
          setAnnouncements(Array.isArray(data) ? data : []);
        }
        if (compRes.ok) {
          const data = await compRes.json();
          setComplaints(Array.isArray(data) ? data : []);
        }
        if (remindersRes.ok) {
          const data = await remindersRes.json();
          setAutomaticReminders(Array.isArray(data) ? data : []);
        }
      } else {
        setError(t('Failed to load profile. Please try logging in again.'));
        setTimeout(() => navigate('/login'), 3000);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    if (!residentId) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [residentId]);

  const handleAddComplaint = async (subject: string, description: string) => {
    await fetch('/api/resident/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ residentId: resident.id, syndicId: resident.syndic_id, subject, description })
    });
    fetchData();
  };

  const handleDeleteComplaint = (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: t('Delete'),
      message: t('Are you sure?'),
      onConfirm: async () => {
        const res = await fetch(`/api/complaints/${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchData();
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };
  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('syndicAuth');
    window.dispatchEvent(new Event('authChanged'));
    navigate('/');
  };

  useEffect(() => {
    if (directPrintPayment) {
      setTimeout(() => {
        handlePrint('hidden-receipt-template');
        setDirectPrintPayment(null);
      }, 100);
    }
  }, [directPrintPayment]);

  const getPrintTemplate = (title: string, content: string, filters: { label: string, value: string | number }[] = [], extraStyles: string = '') => {
    const activeFilters = filters.filter(f => f.value && f.value !== 'all' && f.value !== '');
    
    return `
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page {
              margin: 1cm !important;
              size: auto;
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              padding: 0; 
              margin: 0;
              direction: ${isRtl ? 'rtl' : 'ltr'}; 
              color: #333;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              counter-reset: page;
            }
            .print-container {
              padding: 0 10px;
              padding-bottom: 100px;
              width: 100%;
              box-sizing: border-box;
            }
            table { 
              width: 100%; 
              max-width: 100%;
              border-collapse: collapse; 
              margin-top: 20px; 
              background: white;
              table-layout: auto;
            }
            th, td { 
              border: 1px solid #e2e8f0; 
              padding: 12px 10px; 
              text-align: ${isRtl ? 'right' : 'left'}; 
              font-size: 12px;
              word-break: break-word;
            }
            th { 
              background-color: #f8fafc !important; 
              color: #1e293b;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.025em;
              white-space: nowrap;
            }
            tr:nth-child(even) {
              background-color: #fcfcfc !important;
            }
            h1 { 
              text-align: center; 
              color: #1e3a8a; 
              margin: 0; 
              font-size: 28px;
              font-weight: 900;
            }
            .print-header { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              margin-bottom: 40px; 
              border-bottom: 4px solid #1e3a8a; 
              padding-bottom: 20px; 
            }
            .header-top { 
              display: flex; 
              align-items: center; 
              justify-content: space-between; 
              width: 100%; 
              margin-bottom: 15px;
            }
            .syndic-logo { 
              max-height: 100px; 
              max-width: 200px; 
              object-fit: contain;
            }
            .header-info { 
              flex: 1;
              text-align: center; 
            }
            .residence-name { 
              font-size: 18px; 
              color: #475569; 
              margin-top: 6px;
              font-weight: 600;
            }
            .filter-settings { 
              font-size: 12px; 
              color: #64748b; 
              margin-top: 15px; 
              font-style: italic; 
              display: flex; 
              gap: 20px; 
              flex-wrap: wrap; 
              justify-content: center;
              background: #f1f5f9 !important;
              padding: 10px 15px;
              border-radius: 8px;
              width: 100%;
            }
            .print-footer { 
              position: fixed; 
              bottom: 0; 
              left: 0; 
              right: 0; 
              height: 60px; 
              border-top: 2px solid #e2e8f0; 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              font-size: 12px; 
              color: #64748b; 
              padding: 0 50px; 
              background: white; 
              z-index: 1000;
            }
            .footer-contact {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .phone-number {
              direction: ltr;
              display: inline-block;
              unicode-bidi: embed;
            }
            .page-counter {
              font-weight: 600;
            }
            .page-number:after {
              counter-increment: page;
              content: counter(page);
            }
            @media print {
              .print-footer { 
                position: fixed; 
                bottom: 0; 
              }
              body { margin: 0; }
              .print-container { padding: 0; padding-bottom: 80px; }
              .no-print { display: none; }
            }
            ${extraStyles}
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="print-header">
              <div class="header-top">
                <div style="width: 200px; display: flex; justify-content: flex-start;">
                  ${syndicProfile?.profile_picture ? `<img src="${syndicProfile.profile_picture}" class="syndic-logo" />` : ''}
                </div>
                <div class="header-info">
                  <h1>${title}</h1>
                  <p class="residence-name">${syndicProfile?.residence_address || ''}</p>
                </div>
                <div style="width: 200px;"></div>
              </div>
              ${activeFilters.length > 0 ? `
              <div class="filter-settings">
                ${activeFilters.map(f => `<span><strong>${f.label}:</strong> ${f.value}</span>`).join(' | ')}
              </div>
              ` : ''}
            </div>
            ${content}
          </div>
          <div class="print-footer">
            <div class="footer-contact">
              <span class="phone-number">${syndicProfile?.phone || ''}</span>
              <span>${syndicProfile?.email || ''}</span>
            </div>
            <div class="page-counter">
              ${t('Page')} <span class="page-number"></span>
            </div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `;
  };

  const processPrintContent = (elementId: string, printContent: HTMLElement) => {
    const contentClone = printContent.cloneNode(true) as HTMLElement;
    const printHeader = contentClone.querySelector('.print-header-hidden');
    if (printHeader) printHeader.remove();
    
    const hiddenTitle = contentClone.querySelector('.hidden.print\\:block');
    if (hiddenTitle) hiddenTitle.remove();

    if (elementId.includes('payments')) {
      const thead = contentClone.querySelector('thead tr');
      if (thead) {
        const ths = Array.from(thead.children);
        const actionsIndex = ths.findIndex(th => th.textContent?.includes(t('Actions')) || th.textContent?.includes('الإجراء'));
        if (actionsIndex !== -1) {
          ths[actionsIndex].remove();
          const trs = contentClone.querySelectorAll('tbody tr');
          trs.forEach(tr => {
            if (tr.children[actionsIndex]) {
              tr.children[actionsIndex].remove();
            }
          });
        }

        const nameTh = document.createElement('th');
        nameTh.className = "px-6 py-4 text-base font-black text-gray-500 uppercase";
        nameTh.textContent = t('Full Name');
        
        const aptTh = document.createElement('th');
        aptTh.className = "px-6 py-4 text-base font-black text-gray-500 uppercase";
        aptTh.textContent = t('Apartment');

        thead.insertBefore(aptTh, thead.firstChild);
        thead.insertBefore(nameTh, thead.firstChild);

        const trs = contentClone.querySelectorAll('tbody tr');
        trs.forEach(tr => {
          const nameTd = document.createElement('td');
          nameTd.className = "px-6 py-4 text-sm text-gray-900 font-bold";
          nameTd.textContent = resident?.full_name || '';

          const aptTd = document.createElement('td');
          aptTd.className = "px-6 py-4 text-sm text-gray-900";
          aptTd.textContent = resident?.apartment || '';

          tr.insertBefore(aptTd, tr.firstChild);
          tr.insertBefore(nameTd, tr.firstChild);
        });
      }
    }
    return contentClone;
  };

  const handlePrint = (elementId: string) => {
    const printContent = document.getElementById(elementId);
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    if (elementId === 'hidden-receipt-template') {
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => el.outerHTML)
        .join('\n');

      printWindow.document.write(`
        <html>
          <head>
            <title>${t('Receipt')}</title>
            ${styles}
            <style>
              @page { size: A4; margin: 1cm !important; }
              body { margin: 0; padding: 0; background: white; }
              .receipt-container { max-width: 100% !important; width: 100% !important; margin: 0 !important; box-shadow: none !important; break-after: page; }
              .receipt-container:last-child { break-after: auto; }
            </style>
          </head>
          <body dir="${isRtl ? 'rtl' : 'ltr'}">
            ${printContent.innerHTML}
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  setTimeout(() => window.close(), 500);
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      return;
    }

    const title = elementId === 'payments-table-container' ? t('Payment History') : t('Payment Status');
    const filters = elementId === 'payments-table-container' ? [
      { label: t('Year'), value: paymentYearFilter },
      { label: t('Month'), value: paymentMonthFilter }
    ] : [
      { label: t('Year'), value: reportYear },
      { label: t('Month'), value: displayMonths[reportMonth - 1] }
    ];

    const contentClone = processPrintContent(elementId, printContent);

    const html = getPrintTemplate(title, contentClone.innerHTML, filters);

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportPDF = async (elementId: string) => {
    const printContent = document.getElementById(elementId);
    if (!printContent) return;

    const title = elementId.includes('payments') ? t('Payment History') : t('Payment Status');
    const filters = elementId.includes('payments') ? [
      { label: t('Year'), value: paymentYearFilter },
      { label: t('Month'), value: paymentMonthFilter }
    ] : [
      { label: t('Year'), value: reportYear },
      { label: t('Month'), value: displayMonths[reportMonth - 1] }
    ];

    const contentClone = processPrintContent(elementId, printContent);

    const html = getPrintTemplate(title, contentClone.innerHTML, filters);
    const filename = `${title}-${resident?.full_name || 'Resident'}-${new Date().toLocaleDateString()}.pdf`;
    
    try {
      await exportHtmlToPdf(html, filename);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      // Fallback to print if export fails
      handlePrint(elementId);
    }
  };

  const calculateBalanceAtDate = (dateStr: string) => {
    if (!resident) return 0;
    
    const targetDate = new Date(dateStr);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth() + 1;
    
    const certYear = resident.certified_year || new Date().getFullYear();
    const certMonth = resident.certified_month || 1;
    const monthlyFee = resident.membership_fee ?? 0;

    // Total paid up to the target date
    const paidUpToDate = Number(resident.current_balance || 0) + payments
      .filter(p => new Date(p.date) <= targetDate)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // Total months from certification to target date
    let totalMonths = 0;
    if (targetYear > certYear) {
      totalMonths = (targetYear - certYear) * 12 + (targetMonth - certMonth + 1);
    } else if (targetYear === certYear) {
      totalMonths = Math.max(0, targetMonth - certMonth + 1);
    }
    
    const requiredUpToDate = totalMonths * monthlyFee;
    return paidUpToDate - requiredUpToDate;
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword'),
      profilePicture: resident.profile_picture
    };

    if (data.newPassword && data.newPassword !== formData.get('confirmPassword')) {
      alert(t('Passwords do not match'));
      return;
    }

    const res = await fetch(`/api/resident/profile/${residentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      fetchData();
      alert(t('Profile updated successfully'));
    } else {
      const err = await res.json();
      console.error('Error:', err.error);
      alert(t('Error') + ': ' + (err.error === 'Email already exists' ? t('Resident already exists (Building/Apartment or Email)') : (err.error === 'Incorrect current password' ? t('Incorrect current password') : err.error)));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setResident({ ...resident, profile_picture: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const sidebarItems = [
    { icon: <User className="w-4 h-4" strokeWidth={1.5} />, label: t('Resident Dashboard'), onClick: () => setActiveTab('dashboard'), isActive: activeTab === 'dashboard' },
    { icon: <CreditCard className="w-4 h-4" strokeWidth={1.5} />, label: t('My Payments'), onClick: () => setActiveTab('payments'), isActive: activeTab === 'payments' },
    { icon: <Bell className="w-4 h-4" strokeWidth={1.5} />, label: t('Announcements and Complaints'), onClick: () => setActiveTab('notifications'), isActive: activeTab === 'notifications' },
    { icon: <User className="w-4 h-4" strokeWidth={1.5} />, label: t('My Account'), onClick: () => setActiveTab('profile'), isActive: activeTab === 'profile' },
  ];

  const getActiveTitle = () => {
    switch (activeTab) {
      case 'dashboard': return t('Resident Dashboard');
      case 'payments': return t('My Payments');
      case 'payment_status': return t('Payment Status');
      case 'notifications': return t('Announcements and Complaints');
      case 'profile': return t('My Account');
      default: return t('Resident Dashboard');
    }
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <div className="text-red-500 font-bold">{t(error)}</div>
      <Button onClick={() => navigate('/login')}>{t('Go to Login')}</Button>
    </div>
  );
  if (!resident) return <div className="flex items-center justify-center h-screen">{t('Loading...')}</div>;

  const handleBack = () => {
    if (prevTab) {
      setActiveTab(prevTab);
      setPrevTab(null);
    } else {
      setActiveTab('dashboard');
    }
  };

  const isRtl = false;
  const monthsFr = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const displayMonths = monthsFr;

  return (
    <>
      <DashboardLayout 
        onLogoClick={() => setActiveTab('profile')}
        onProfileClick={() => setActiveTab('profile')}
        onNotificationClick={() => setActiveTab('notifications')}
        title={
          <div className="flex items-center gap-4">
            {activeTab !== 'dashboard' && (
              <button 
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                title={t('Back')}
              >
                <ArrowLeft className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
            )}
            <span>{getActiveTitle()}</span>
          </div>
        } 
        sidebarItems={sidebarItems.map(item => ({
          ...item,
          onClick: () => {
            if (item.onClick && typeof item.onClick === 'function') {
              setPrevTab(activeTab);
              item.onClick();
            }
          }
        }))}
      >
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {(() => {
            const monthlyFee = resident.membership_fee ?? 0;
            
            const certYear = resident.certified_year || new Date().getFullYear();
            const certMonth = resident.certified_month || 1;

            const totalPaid = Number(resident.current_balance || 0) + payments.reduce((sum, c) => sum + Number(c.amount || 0), 0);

            let totalMonthsUntilSelectedMonth = 0;
            if (reportYear > certYear) {
              totalMonthsUntilSelectedMonth = (reportYear - certYear) * 12 + (reportMonth - certMonth + 1);
            } else if (reportYear === certYear) {
              totalMonthsUntilSelectedMonth = Math.max(0, reportMonth - certMonth + 1);
            }
            
            const totalRequiredUntilSelectedMonth = totalMonthsUntilSelectedMonth * monthlyFee;
            const balanceAtSelectedMonth = totalPaid - totalRequiredUntilSelectedMonth;

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h4 className="text-sm font-medium text-gray-500">{t('Balance')}</h4>
                  <p className={`text-3xl font-bold mt-2 ${balanceAtSelectedMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {balanceAtSelectedMonth > 0 ? '+' : ''}{formatCurrency(balanceAtSelectedMonth, resident.currency)}
                  </p>
                </div>
              </div>
            );
          })()}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-blue-900 mb-6">{t('Latest Announcements')}</h3>
            <div className="space-y-4">
              {announcements.length > 0 ? (
                <div className="p-4 border border-gray-100 rounded-xl">
                  <p className="text-sm font-bold text-gray-900">{announcements[0].title}</p>
                  <p className="text-xs text-gray-700 mt-1">{announcements[0].message}</p>
                  <span className="text-xs text-gray-400 mt-2 block">{new Date(announcements[0].created_at).toLocaleDateString()}</span>
                </div>
              ) : (
                <div className="p-4 border border-gray-100 rounded-xl text-center text-gray-500">
                  {t('No announcements yet')}
                </div>
              )}
            </div>
          </div>

          {/* Payment Status section duplicated to Dashboard */}
          <div className="space-y-6 mt-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <p className="text-sm text-gray-500">{t('Monthly Fee')}</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatCurrency(resident.membership_fee ?? 0, resident.currency)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <select
                    className="w-20 md:w-24 px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm border border-gray-200 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    value={reportYear}
                    onChange={(e) => setReportYear(Number(e.target.value))}
                  >
                    {Array.from(new Set([
                      new Date().getFullYear(),
                      ...payments.map(c => Number(c.year || new Date(c.date).getFullYear()))
                    ])).sort((a, b) => b - a).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <select
                    className="w-20 md:w-24 px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm border border-gray-200 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    value={reportMonth}
                    onChange={(e) => setReportMonth(Number(e.target.value))}
                  >
                    {displayMonths.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={() => handlePrint('dashboard-payment-status')}
                  variant="outline"
                  className="hidden md:flex items-center gap-2 no-print"
                >
                  <Printer className="w-4 h-4" />
                  {t('Print Status')}
                </Button>
                <Button
                  onClick={() => handleExportPDF('dashboard-payment-status')}
                  variant="outline"
                  className="flex md:hidden items-center justify-center p-2 no-print"
                >
                  <FileDown className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div id="dashboard-payment-status" className="bg-sky-50 dark:bg-sky-900/10 rounded-2xl shadow-sm border border-sky-100 dark:border-sky-900/30 overflow-x-auto print-section">
              <div className="hidden print:block text-center p-8">
                <h1 className="text-2xl font-bold mb-6">{t('Payment Status')} - {resident.full_name} ({reportYear})</h1>
              </div>
              <table className={`w-full ${isRtl ? 'text-right' : 'text-left'}`}>
                <thead className="bg-sky-100 dark:bg-sky-900/50 text-gray-900 dark:text-white text-base font-black uppercase tracking-wider">
                  <tr>
                    <th className="p-3 border-b border-sky-200 dark:border-sky-800 font-bold">{t('Full Name')}</th>
                    <th className="p-3 border-b border-sky-200 dark:border-sky-800 font-bold">{t('Apartment')}</th>
                    {displayMonths.slice(0, reportMonth).map(m => (
                      <th key={m} className="p-3 border-b border-sky-200 dark:border-sky-800 border-x border-sky-100 dark:border-sky-900/30 text-center min-w-[60px] font-bold">{m}</th>
                    ))}
                    <th className="p-3 border-b border-sky-200 dark:border-sky-800 font-bold">{t('Balance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100 dark:divide-sky-900/20">
                  {(() => {
                    const monthlyFee = resident.membership_fee ?? 0;
                    const certYear = resident.certified_year || new Date().getFullYear();
                    const certMonth = resident.certified_month || 1;

                    const totalPaid = Number(resident.current_balance || 0) + payments.reduce((sum, c) => sum + Number(c.amount || 0), 0);

                    const monthsCovered = monthlyFee > 0 ? Math.floor(totalPaid / monthlyFee) : 0;
                    
                    let totalMonthsUntilSelectedMonth = 0;
                    if (reportYear > certYear) {
                      totalMonthsUntilSelectedMonth = (reportYear - certYear) * 12 + (reportMonth - certMonth + 1);
                    } else if (reportYear === certYear) {
                      totalMonthsUntilSelectedMonth = Math.max(0, reportMonth - certMonth + 1);
                    }
                    
                    const totalRequiredUntilSelectedMonth = totalMonthsUntilSelectedMonth * monthlyFee;
                    const balanceAtSelectedMonth = totalPaid - totalRequiredUntilSelectedMonth;

                    return (
                      <tr className="hover:bg-sky-100/50 dark:hover:bg-sky-900/30 even:bg-sky-50/50 dark:even:bg-sky-900/10 transition-colors text-sm">
                        <td className="p-3 font-bold border-b border-sky-100 dark:border-sky-900/30">{resident.full_name}</td>
                        <td className="p-3 border-b border-sky-100 dark:border-sky-900/30 font-bold">{resident.apartment}</td>
                        {displayMonths.slice(0, reportMonth).map((_, i) => {
                          const m = i + 1;
                          const isBeforeCertified = reportYear < certYear || (reportYear === certYear && m < certMonth);
                          
                          if (isBeforeCertified) {
                            return <td key={i} className="p-3 border-b border-sky-100 dark:border-sky-900/30 border-x border-sky-100 dark:border-sky-900/30 text-center text-gray-300">-</td>;
                          }

                          const monthIndexFromStart = (reportYear - certYear) * 12 + (m - certMonth);
                          const isPaid = monthIndexFromStart < monthsCovered;

                          return (
                            <td key={i} className={`p-3 border-b border-sky-100 dark:border-sky-900/30 border-x border-sky-100 dark:border-sky-900/30 text-center font-bold ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                              {isPaid ? t('Paid') : t('Unpaid')}
                            </td>
                          );
                        })}
                        <td className="p-3 border-b border-sky-100 dark:border-sky-900/30 font-mono text-center font-bold">
                          <span className={balanceAtSelectedMonth >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {balanceAtSelectedMonth > 0 ? '+' : ''}{formatNumber(balanceAtSelectedMonth)}
                          </span>
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="max-w-6xl mx-auto">
          <SharedNotifications 
            userRole="resident"
            announcements={announcements}
            complaints={complaints}
            automaticReminders={automaticReminders}
            onAddAnnouncement={() => {}}
            onAddComplaint={handleAddComplaint}
            onUpdateComplaintStatus={() => {}}
            onUpdateComplaintAnswer={() => {}}
            onDeleteComplaint={handleDeleteComplaint}
            onRefresh={fetchData}
          />
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2 md:gap-4">
              <select
                className="w-24 md:w-auto px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm border border-gray-200 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={paymentYearFilter}
                onChange={(e) => setPaymentYearFilter(e.target.value)}
              >
                <option value="">{t('All Years')}</option>
                {Array.from(new Set(payments.map(c => String(c.year || new Date(c.date).getFullYear())))).sort().reverse().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                className="w-24 md:w-auto px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm border border-gray-200 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={paymentMonthFilter}
                onChange={(e) => setPaymentMonthFilter(e.target.value)}
              >
                <option value="">{t('All Months')}</option>
                {displayMonths.map((month, index) => (
                  <option key={index} value={month}>{month}</option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => handlePrint('payments-table-container')}
              variant="outline"
              className="hidden md:flex items-center gap-2 no-print"
            >
              <Printer className="w-4 h-4" />
              {t('Print History')}
            </Button>
            <Button
              onClick={() => handleExportPDF('payments-table-container')}
              variant="outline"
              className="flex md:hidden items-center justify-center p-2 no-print"
            >
              <FileDown className="w-4 h-4" />
            </Button>
          </div>
          <div id="payments-table-container" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print-section">
            <div className="hidden print:block text-center p-8">
              <h1 className="text-2xl font-bold mb-6">{t('Payment History')} - {resident.full_name}</h1>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-gray-50 border-bottom border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-base font-black text-gray-500 uppercase">{t('Date')}</th>
                    <th className="px-6 py-4 text-base font-black text-gray-500 uppercase">{t('Amount')}</th>
                    <th className="px-6 py-4 text-base font-black text-gray-500 uppercase">{t('Payment Nature')}</th>
                    <th className="px-6 py-4 text-base font-black text-gray-500 uppercase">{t('Period')}</th>
                    <th className="px-6 py-4 text-base font-black text-gray-500 uppercase">{t('Payment Type')}</th>
                    <th className="px-6 py-4 text-base font-black text-gray-500 uppercase">{t('Receipt')}</th>
                    <th className="px-6 py-4 text-base font-black text-gray-500 uppercase">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.filter(c => {
                    const cYear = String(c.year || new Date(c.date).getFullYear());
                    const matchesYear = !paymentYearFilter || cYear === paymentYearFilter;
                    
                    const matchesMonth = !paymentMonthFilter || (() => {
                      if (!c.months && !c.month) return true;
                      if (!c.months) return String(c.month) === paymentMonthFilter;
                      try {
                        const parsed = JSON.parse(c.months);
                        return Array.isArray(parsed) ? parsed.includes(paymentMonthFilter) : c.months.includes(paymentMonthFilter);
                      } catch (e) {
                        return c.months.includes(paymentMonthFilter);
                      }
                    })();
                    
                    return matchesYear && matchesMonth;
                  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((c) => (
                    <tr key={`${c.type}-${c.id}`}>
                      <td className="px-6 py-4 text-sm text-gray-900">{c.date}</td>
                      <td className="px-6 py-4 text-sm font-bold text-blue-600">{formatCurrency(c.amount, resident.currency)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {c.type === 'project' ? (
                          <span className="flex flex-col">
                            <span className="font-bold text-blue-700">{t('Project Payment')}</span>
                            <span className="text-xs text-gray-400">{c.project_name}</span>
                          </span>
                        ) : (
                          <span className="font-bold text-green-700">{t('Normal Payment')}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {c.type === 'project' ? '-' : (() => {
                          if (!c.months) return `${c.month || ''}/${c.year || ''}`;
                          try {
                            const parsed = JSON.parse(c.months);
                            return Array.isArray(parsed) ? parsed.join(', ') : c.months;
                          } catch (e) {
                            return c.months;
                          }
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {t(c.payment_type || 'cash')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">#{c.receipt_number}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <button
                          onClick={() => {
                            setPrintingType(c.type === 'project' ? 'project_payment' : 'payment');
                            setDirectPrintPayment(c);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                          title={t('Print')}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {payments.filter(c => {
              const cYear = String(c.year || new Date(c.date).getFullYear());
              const matchesYear = !paymentYearFilter || cYear === paymentYearFilter;
              
              const matchesMonth = !paymentMonthFilter || (() => {
                if (!c.months) return String(c.month) === paymentMonthFilter;
                try {
                  const parsed = JSON.parse(c.months);
                  return Array.isArray(parsed) ? parsed.includes(paymentMonthFilter) : c.months.includes(paymentMonthFilter);
                } catch (e) {
                  return c.months.includes(paymentMonthFilter);
                }
              })();
              
              return matchesYear && matchesMonth;
            }).length === 0 && (
              <div className="p-12 text-center text-gray-500">
                {t('No payments found.')}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'payment_status' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">{t('Monthly Fee')}</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(resident.membership_fee ?? 0, resident.currency)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <select
                  className="w-24 p-1.5 border border-blue-100 dark:border-slate-700 rounded-lg text-xs bg-blue-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 dark:focus:bg-slate-700 h-10 text-center placeholder-blue-400 dark:placeholder-slate-400 text-blue-900 dark:text-white"
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                >
                  {Array.from(new Set([
                    new Date().getFullYear(),
                    ...payments.map(c => Number(c.year || new Date(c.date).getFullYear()))
                  ])).sort((a, b) => b - a).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <select
                  className="w-24 p-1.5 border border-blue-100 dark:border-slate-700 rounded-lg text-xs bg-blue-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 dark:focus:bg-slate-700 h-10 text-center placeholder-blue-400 dark:placeholder-slate-400 text-blue-900 dark:text-white"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Number(e.target.value))}
                >
                  {displayMonths.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <Button
                onClick={() => handlePrint('payment-status-container')}
                variant="outline"
                className="flex items-center gap-2 no-print"
              >
                <Printer className="w-4 h-4" />
                {t('Print Status')}
              </Button>
            </div>
          </div>

          <div id="payment-status-container" className="bg-sky-50 dark:bg-sky-900/10 rounded-2xl shadow-sm border border-sky-100 dark:border-sky-900/30 overflow-x-auto print-section">
            <div className="hidden print:block text-center p-8">
              <h1 className="text-2xl font-bold mb-6">{t('Payment Status')} - {resident.full_name} ({reportYear})</h1>
            </div>
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'}`}>
              <thead className="bg-sky-100 dark:bg-sky-900/50 text-gray-900 dark:text-white text-base font-black uppercase tracking-wider">
                <tr>
                  <th className="p-3 border-b border-sky-200 dark:border-sky-800 font-bold">{t('Full Name')}</th>
                  <th className="p-3 border-b border-sky-200 dark:border-sky-800 font-bold">{t('Apartment')}</th>
                  {displayMonths.slice(0, reportMonth).map(m => (
                    <th key={m} className="p-3 border-b border-sky-200 dark:border-sky-800 border-x border-sky-100 dark:border-sky-900/30 text-center min-w-[60px] font-bold">{m}</th>
                  ))}
                  <th className="p-3 border-b border-sky-200 dark:border-sky-800 font-bold">{t('Balance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 dark:divide-sky-900/20">
                {(() => {
                  const monthlyFee = resident.membership_fee ?? 0;
                  const certYear = resident.certified_year || new Date().getFullYear();
                  const certMonth = resident.certified_month || 1;

                  const totalPaid = Number(resident.current_balance || 0) + payments.reduce((sum, c) => sum + Number(c.amount || 0), 0);

                  const monthsCovered = monthlyFee > 0 ? Math.floor(totalPaid / monthlyFee) : 0;
                  
                  let totalMonthsUntilSelectedMonth = 0;
                  if (reportYear > certYear) {
                    totalMonthsUntilSelectedMonth = (reportYear - certYear) * 12 + (reportMonth - certMonth + 1);
                  } else if (reportYear === certYear) {
                    totalMonthsUntilSelectedMonth = Math.max(0, reportMonth - certMonth + 1);
                  }
                  
                  const totalRequiredUntilSelectedMonth = totalMonthsUntilSelectedMonth * monthlyFee;
                  const balanceAtSelectedMonth = totalPaid - totalRequiredUntilSelectedMonth;

                  return (
                    <tr className="hover:bg-sky-100/50 dark:hover:bg-sky-900/30 even:bg-sky-50/50 dark:even:bg-sky-900/10 transition-colors text-sm">
                      <td className="p-3 font-bold border-b border-sky-100 dark:border-sky-900/30">{resident.full_name}</td>
                      <td className="p-3 border-b border-sky-100 dark:border-sky-900/30 font-bold">{resident.apartment}</td>
                      {displayMonths.slice(0, reportMonth).map((_, i) => {
                        const m = i + 1;
                        const isBeforeCertified = reportYear < certYear || (reportYear === certYear && m < certMonth);
                        
                        if (isBeforeCertified) {
                          return <td key={i} className="p-3 border-b border-sky-100 dark:border-sky-900/30 border-x border-sky-100 dark:border-sky-900/30 text-center text-gray-300">-</td>;
                        }

                        const monthIndexFromStart = (reportYear - certYear) * 12 + (m - certMonth);
                        const isPaid = monthIndexFromStart < monthsCovered;

                        return (
                          <td key={i} className={`p-3 border-b border-sky-100 dark:border-sky-900/30 border-x border-sky-100 dark:border-sky-900/30 text-center font-bold ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                            {isPaid ? t('Paid') : t('Unpaid')}
                          </td>
                        );
                      })}
                      <td className="p-3 border-b border-sky-100 dark:border-sky-900/30 font-mono text-center font-bold">
                        <span className={balanceAtSelectedMonth >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {balanceAtSelectedMonth > 0 ? '+' : ''}{formatNumber(balanceAtSelectedMonth)}
                        </span>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'profile' && resident && (
        <div className="max-w-2xl bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="flex justify-center mb-8">
              <div className="relative">
                <img 
                  src={resident.profile_picture || 'https://picsum.photos/200'} 
                  className="w-32 h-32 rounded-full object-cover border-4 border-blue-50"
                  alt="Profile"
                />
                <label htmlFor="profile-upload" className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition-colors">
                  <Edit2 className="w-4 h-4" />
                  <input 
                    id="profile-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">{t('Full Name')}</label>
                <Input name="fullName" defaultValue={resident.full_name} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Email')}</label>
                <Input name="email" type="email" defaultValue={resident.email} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Phone')}</label>
                <Input name="phone" defaultValue={resident.phone} required dir="ltr" />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-lg font-semibold mb-4">{t('Change Password')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Current Password')}</label>
                  <Input name="currentPassword" type="password" placeholder={t('Leave blank to keep current')} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('New Password')}</label>
                  <Input name="newPassword" type="password" placeholder={t('New Password')} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Confirm New Password')}</label>
                  <Input name="confirmPassword" type="password" placeholder={t('Confirm New Password')} />
                </div>
              </div>
            </div>

            <Button variant="dark" type="submit" className="w-full">
              {t('Save Profile')}
            </Button>
          </form>
        </div>
      )}
    </DashboardLayout>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
      />

      <div style={{ display: 'none' }}>
        <div id="hidden-receipt-template">
          {directPrintPayment && (
            <ReceiptTemplate 
              profile={syndicProfile} 
              payment={{
                ...directPrintPayment,
                full_name: resident.full_name,
                building: resident.building,
                apartment: resident.apartment,
                current_balance: calculateBalanceAtDate(directPrintPayment.date),
                property_type: resident.status
              }} 
              type={printingType as any} 
              projectName={directPrintPayment?.project_name}
              customStyles={syndicProfile?.receipt_settings ? JSON.parse(syndicProfile.receipt_settings) : undefined}
            />
          )}
        </div>
      </div>

    </>
  );
}
