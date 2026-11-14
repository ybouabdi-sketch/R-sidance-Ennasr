import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '../components/ui/DashboardLayout';
import { Spreadsheet } from '../components/Spreadsheet';
import { 
  Users, FileText, DollarSign, Settings, Plus, Download, Upload, Trash2, 
  Edit2, Building2, UserCheck, BarChart3, Landmark, UserCircle, UserPlus,
  Printer, Clock, Bell, Send, Check, Inbox, Wallet, ArrowLeft, LayoutDashboard, TrendingUp, TrendingDown, Mail, MessageSquare, PieChart as PieChartIcon,
  Save, CheckCircle2, XCircle, MoreVertical, AlertCircle, Briefcase, Target, History, FileSignature, Info, FileDown
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, LineChart, Line
} from 'recharts';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Input } from '../components/ui/Input';
import { SharedNotifications } from '../components/SharedNotifications';
import { ReceiptTemplate } from '../components/ReceiptTemplate';
import { ReceiptSettings } from '../components/ReceiptSettings';
import { DocumentView } from '../components/DocumentView';
import { formatNumber, formatCurrency } from '../utils/format';
import { exportHtmlToPdf } from '../utils/pdfExport';
import clsx from 'clsx';

type Resident = {
  id: number;
  full_name: string;
  building: string;
  apartment: string;
  phone: string;
  email?: string;
  password?: string;
  occupancy_type?: 'owner' | 'tenant';
  status: 'resident' | 'porter';
  is_active: number;
  current_balance: number;
  joining_date?: string;
  property_number?: string;
};

type Payment = {
  id: number;
  resident_id: number;
  full_name: string;
  building: string;
  apartment: string;
  amount: number;
  remaining_balance: number;
  total_paid: number;
  date: string;
  receipt_number: string;
  payment_type?: string;
  months?: string;
  year?: string;
  current_balance?: number;
  property_type?: string;
};

type Expense = {
  id: number;
  expense_type: string;
  spender: string;
  amount: number;
  receipt_number: string;
  notes?: string;
  date?: string;
  payment_type?: string;
};

type BankOp = {
  id: number;
  operation_type: 'withdrawal' | 'deposit';
  amount: number;
  name: string;
  date: string;
  description: string;
  building?: string;
  apartment?: string;
};

type RentalIncome = {
  id: number;
  property_type: string;
  tenant_name: string;
  phone: string;
  rental_price: number;
  receipt_number: string;
  months_paid: string;
  months_unpaid: string;
  year: number;
  date: string;
  total_paid?: number;
  status?: 'active' | 'ended';
  end_date?: string;
  property_address?: string;
};

type OtherIncome = {
  id: number;
  income_type: string;
  contributor_name: string;
  amount: number;
  date: string;
  receipt_number: string;
  notes?: string;
  payment_type?: string;
  property_address?: string;
  property_type?: string;
};

type Project = {
  id: number;
  name: string;
  description: string;
  target_amount: number;
  individual_payment: number;
  total_paid: number;
  remaining_amount: number;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  end_date?: string;
};

type ProjectPayment = {
  id: number;
  project_id: number;
  project_name?: string;
  full_name: string;
  building: string;
  apartment: string;
  amount: number;
  date: string;
  resident_id?: number;
  remaining_balance: number;
  receipt_number: string;
  payment_type?: string;
  property_type?: string;
};

type Complaint = {
  id: number;
  resident_id: number;
  syndic_id: number;
  subject: string;
  description: string;
  status: 'pending' | 'in_progress' | 'resolved';
  created_at: string;
  resident_name?: string;
  building?: string;
  apartment?: string;
  phone?: string;
  email?: string;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const TabButton = ({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode 
}) => (
  <button
    onClick={onClick}
    className={`pb-4 px-6 text-sm font-bold transition-all relative whitespace-nowrap ${
      active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
    }`}
  >
    {children}
    {active && (
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
    )}
  </button>
);

export default function SyndicDashboard() {
  const { t } = useTranslation();
  const isRtl = false;

  const formatOperationName = (name: string) => {
    if (!name) return '-';
    
    // Structured format
    if (name.startsWith('RENTAL_INCOME|')) {
      const parts = name.split('|');
      return `${t('Rental Income')} - ${t(parts[1])} - ${parts[2]}`;
    }
    if (name.startsWith('OTHER_INCOME|')) {
      const parts = name.split('|');
      return `${t('Other Incomes')} - ${parts[2]} (${t(parts[1])})`;
    }
    if (name.startsWith('EXPENSE|')) {
      const parts = name.split('|');
      return `${t('Expense')}: ${t(parts[1])} (${parts[2]})`;
    }
    
    // Legacy Arabic format
    if (name.startsWith('مداخيل كرائية:')) {
      const tenantName = name.split(':')[1]?.trim() || '';
      return `${t('Rental Income')} - ${tenantName}`;
    }
    if (name.startsWith('مداخيل أخرى:')) {
      const match = name.match(/مداخيل أخرى: (.*?) \((.*?)\)/);
      if (match) {
        return `${t('Other Incomes')} - ${match[1]} (${t(match[2])})`;
      }
      const rest = name.split(':')[1]?.trim() || '';
      return `${t('Other Incomes')} - ${rest}`;
    }
    if (name.startsWith('نفقة:')) {
      const match = name.match(/نفقة: (.*?) \((.*?)\)/);
      if (match) {
        return `${t('Expense')}: ${t(match[1])} (${match[2]})`;
      }
      const rest = name.split(':')[1]?.trim() || '';
      return `${t('Expense')}: ${rest}`;
    }
    
    return name;
  };

  const formatOperationDescription = (description: string) => {
    if (!description) return '-';
    
    // Structured format: RECEIPT|RN|EXTRA
    if (description.startsWith('RECEIPT|')) {
      const parts = description.split('|');
      return parts[1] || '-';
    }
    
    // Handle the user's specific cases: "رقم التوصيل P2026/001" and "الدفعة-11"
    let result = description;
    
    // Remove common labels (Arabic and English)
    const labelsToRemove = [
      'رقم التوصيل',
      'Receipt Number',
      'Numéro de Reçu',
      'وصل رقم:',
      'وصل رقم'
    ];
    
    for (const label of labelsToRemove) {
      if (result.includes(label)) {
        result = result.replace(label, '').trim();
      }
    }
    
    // Remove unwanted phrases mentioned by the user
    const unwantedPatterns = [
      /الدفعة[-\s]*\d+/g,
      /Project Payment[-\s]*\d+\s*\d*/g,
      /Payment[-\s]*\d+/g,
      /الدفعة/g,
      /Project Payment/g,
      /Payment/g
    ];
    
    for (const pattern of unwantedPatterns) {
      result = result.replace(pattern, '').trim();
    }
    
    // Clean up any leading/trailing colons or dashes
    result = result.replace(/^[:\-\s]+|[:\-\s]+$/g, '').trim();
    
    // If we have multiple words, try to find the one that looks like a receipt number
    if (result.includes(' ')) {
      const words = result.split(/\s+/);
      for (const word of words) {
        // Match patterns like P2026/001, R2026/001, or 123/456
        if (word.match(/[PR]?\d{4}\/\d{3}/) || word.match(/\d+\/\d+/)) {
          return word;
        }
      }
      // If no match found, take the first word if it starts with P, R or a digit
      if (words[0].match(/^[PR\d]/)) {
        return words[0];
      }
    }
    
    // Legacy Rental Income description format: "PropertyType - ReceiptNumber"
    if (result.includes('-')) {
      const parts = result.split('-');
      if (parts.length === 2) {
        const rn = parts[1].trim();
        if (rn.startsWith('R') || rn.startsWith('P') || rn.match(/\d/)) {
          return rn;
        }
      }
    }
    
    return result || '-';
  };

  const navigate = useNavigate();
  const [syndicId, setSyndicId] = useState<string | null>(() => {
    const storedAuth = localStorage.getItem('syndicAuth');
    const storedRole = localStorage.getItem('userRole');
    const storedId = localStorage.getItem('userId');
    if (storedAuth === '1' && storedRole === 'syndic' && storedId && storedId !== 'undefined' && storedId !== 'null') {
      return storedId;
    }
    return null;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewingResident, setViewingResident] = useState<Resident | null>(null);
  const [prevTab, setPrevTab] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [dashboardMonthFilter, setDashboardMonthFilter] = useState('');
  const [dashboardYearFilter, setDashboardYearFilter] = useState(new Date().getFullYear().toString());
  const [isPaymentsMenuOpen, setIsPaymentsMenuOpen] = useState(false);
  const [isOtherIncomesMenuOpen, setIsOtherIncomesMenuOpen] = useState(false);
  const [paymentSubTab, setPaymentSubTab] = useState<'residents' | null>('residents');
  const [residents, setResidents] = useState<Resident[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankOps, setBankOps] = useState<BankOp[]>([]);
  const [cashBoxOps, setCashBoxOps] = useState<BankOp[]>([]);
  const [rentalIncomes, setRentalIncomes] = useState<RentalIncome[]>([]);
  const [otherIncomes, setOtherIncomes] = useState<OtherIncome[]>([]);
  // const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [otherIncomeSubTab, setOtherIncomeSubTab] = useState<'rental' | 'other'>('rental');
  const [financialSubTab, setFinancialSubTab] = useState<'bank' | 'cashbox'>('bank');
  const [notificationsSubTab, setNotificationsSubTab] = useState<'announcements' | 'complaints' | 'reminders' | 'notifications'>('announcements');
  const [profile, setProfile] = useState<any>(null);

  const [buildingFilter, setBuildingFilter] = useState('');
  const [apartmentFilter, setApartmentFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [bankOpTypeFilter, setBankOpTypeFilter] = useState('');
  const [bankNameFilter, setBankNameFilter] = useState('');
  const [bankMonthFilter, setBankMonthFilter] = useState('');
  const [bankYearFilter, setBankYearFilter] = useState('');
  const [incomeTypeFilter, setIncomeTypeFilter] = useState('');
  const [contributorNameFilter, setContributorNameFilter] = useState('');
  const [expenseTypeFilter, setExpenseTypeFilter] = useState('');
  const [expenseSpenderFilter, setExpenseSpenderFilter] = useState('');
  const [expenseMonthFilter, setExpenseMonthFilter] = useState('');
  const [expenseYearFilter, setExpenseYearFilter] = useState('');
  const [otherIncomeMonthFilter, setOtherIncomeMonthFilter] = useState('');
  const [otherIncomeYearFilter, setOtherIncomeYearFilter] = useState('');
  const [projectSearchFilter, setProjectSearchFilter] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('');
  const [projectPaymentSearchFilter, setProjectPaymentSearchFilter] = useState('');
  const [projectPaymentTypeFilter, setProjectPaymentTypeFilter] = useState<'resident' | 'external'>('resident');
  const [projectPaymentApartmentFilter, setProjectPaymentApartmentFilter] = useState('');
  const [projectPaymentResidentId, setProjectPaymentResidentId] = useState<string>('');
  const [projectPaymentListTypeFilter, setProjectPaymentListTypeFilter] = useState<string>('all');
  const [projectPaymentListBuildingFilter, setProjectPaymentListBuildingFilter] = useState<string>('');
  const [projectPaymentListStatusFilter, setProjectPaymentListStatusFilter] = useState<string>('all');

  const [projectPaymentAmount, setProjectPaymentAmount] = useState<string>('');
  const [projectPaymentRemaining, setProjectPaymentRemaining] = useState<string>('');
  const [projectPaymentMethod, setProjectPaymentMethod] = useState<string>('cash');

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectPayments, setProjectPayments] = useState<ProjectPayment[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isProjectPaymentModalOpen, setIsProjectPaymentModalOpen] = useState(false);
  const [isAddingFromTable, setIsAddingFromTable] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingProjectPayment, setEditingProjectPayment] = useState<ProjectPayment | null>(null);

  const combinedOps = useMemo(() => {
    const ops = (financialSubTab === 'bank' ? bankOps : cashBoxOps) || [];
    const mappedPayments = (payments || [])
      .filter(c => financialSubTab === 'bank' ? c.payment_type === 'bank' : c.payment_type === 'cash')
      .map(c => ({
        id: `payment-${c.id}`,
        operation_type: 'deposit',
        name: c.full_name,
        building: c.building,
        apartment: c.apartment,
        date: c.date,
        description: `RECEIPT|${c.receipt_number}|${t('Payment')} - ${c.building} ${c.apartment}`,
        amount: c.amount,
        isPayment: true
      }));
    
    const mappedProjectPayments = (projectPayments || [])
      .filter(c => financialSubTab === 'bank' ? c.payment_type === 'bank' : c.payment_type === 'cash')
      .map(c => {
        const project = projects.find(p => p.id === c.project_id);
        const projectName = project ? project.name : '';
        return {
          id: `project-payment-${c.id}`,
          operation_type: 'deposit',
          name: projectName ? `${c.full_name} - ${projectName}` : c.full_name,
          building: c.building,
          apartment: c.apartment,
          date: c.date,
          description: `RECEIPT|${c.receipt_number}|${t('Project Payment')}${projectName ? ` (${projectName})` : ''} - ${c.building} ${c.apartment}`,
          amount: c.amount,
          isPayment: true
        };
      });
    
    return [...ops, ...mappedPayments, ...mappedProjectPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bankOps, cashBoxOps, payments, projectPayments, projects, financialSubTab, t]);

  const filteredProjectPaymentsData = useMemo(() => {
    if (!selectedProject) return [];
    
    const projectPaymentsForThisProject = projectPayments.filter(pp => pp.project_id === selectedProject.id);
    
    const residentData = residents.filter(r => {
      const typeMatch = projectPaymentListTypeFilter === 'all' || r.status === projectPaymentListTypeFilter;
      const buildingMatch = !projectPaymentListBuildingFilter || (r.building && r.building.toLowerCase().includes(projectPaymentListBuildingFilter.toLowerCase()));
      return typeMatch && buildingMatch;
    }).map(resident => {
      const payment = projectPaymentsForThisProject.find(pp => pp.full_name === resident.full_name && pp.building === resident.building && pp.apartment === resident.apartment);
      return { resident, payment };
    });

    // Find external payments (payments that don't match any resident)
    const externalPayments = projectPaymentsForThisProject.filter(pp => {
      return !residents.some(r => r.full_name === pp.full_name && r.building === pp.building && r.apartment === pp.apartment);
    }).filter(pp => {
      const typeMatch = projectPaymentListTypeFilter === 'all' || projectPaymentListTypeFilter === 'external';
      const buildingMatch = !projectPaymentListBuildingFilter || (pp.building && pp.building.toLowerCase().includes(projectPaymentListBuildingFilter.toLowerCase()));
      return typeMatch && buildingMatch;
    }).map(payment => {
      return {
        resident: {
          id: `ext-${payment.id}`,
          full_name: payment.full_name,
          building: payment.building || '',
          apartment: payment.apartment || '',
          status: 'external'
        } as any,
        payment
      };
    });

    const combinedData = [...residentData, ...externalPayments];

    return combinedData.filter(item => {
      if (projectPaymentListStatusFilter === 'all') return true;
      if (projectPaymentListStatusFilter === 'paid') return !!item.payment && item.payment.amount > 0;
      if (projectPaymentListStatusFilter === 'unpaid') return !item.payment || item.payment.amount === 0;
      return true;
    });
  }, [selectedProject, residents, projectPayments, projectPaymentListTypeFilter, projectPaymentListBuildingFilter, projectPaymentListStatusFilter]);

  const projectStats = useMemo(() => {
    if (!selectedProject) return null;
    const projectPaymentsForThisProject = projectPayments.filter(pp => pp.project_id === selectedProject.id);
    const totalPaid = projectPaymentsForThisProject.reduce((sum, pp) => sum + pp.amount, 0);
    
    // Total expected is individual_payment * number of residents who should pay
    const totalExpected = (selectedProject.individual_payment || 0) * residents.length;
    const totalRemaining = totalExpected - totalPaid;
    
    return {
      totalPaid,
      totalRemaining,
      targetAmount: selectedProject.target_amount
    };
  }, [selectedProject, projectPayments, residents]);

  const updateProfileFieldDirectly = async (field: string, value: any) => {
    if (!profile) return;
    const numValue = field === 'currency' ? 0 : Number(value);
    
    const data = {
      fullName: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      profilePicture: profile.profile_picture,
      monthlyFee: profile.monthly_fee,
      currency: field === 'currency' ? value : profile.currency,
      residentMonthlyFee: profile.resident_monthly_fee,
      membershipFee: field === 'membershipFee' ? numValue : profile.membership_fee,
      certifiedYear: field === 'certifiedYear' ? numValue : profile.certified_year,
      certifiedMonth: field === 'certifiedMonth' ? numValue : profile.certified_month,
      initialBankBalance: field === 'bank' ? numValue : (profile.initial_bank_balance || 0),
      initialCashboxBalance: field === 'cashbox' ? numValue : (profile.initial_cashbox_balance || 0),
      initialUncollectedBalance: field === 'uncollected' ? numValue : (profile.initial_uncollected_balance || 0),
      initialUnpaidBalance: field === 'unpaid' ? numValue : (profile.initial_unpaid_balance || 0),
      showApartments: field === 'showApartments' ? value : (profile.show_apartments === 1)
    };

    const res = await fetch(`/api/syndic/profile/${syndicId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      await fetchProfile();
      fetchData();
    } else {
      alert(t('Error updating profile'));
    }
  };

  const handleUpdateInitialBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    const data = {
      fullName: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      profilePicture: profile.profile_picture,
      monthlyFee: profile.monthly_fee,
      currency: profile.currency,
      residentMonthlyFee: profile.resident_monthly_fee,
      membershipFee: profile.membership_fee,
      certifiedYear: profile.certified_year,
      certifiedMonth: profile.certified_month,
      initialBankBalance: initialBalanceType === 'bank' ? Number(initialBalanceValue) : (profile.initial_bank_balance || 0),
      initialCashboxBalance: initialBalanceType === 'cashbox' ? Number(initialBalanceValue) : (profile.initial_cashbox_balance || 0),
      initialUncollectedBalance: initialBalanceType === 'uncollected' ? Number(initialBalanceValue) : (profile.initial_uncollected_balance || 0),
      initialUnpaidBalance: initialBalanceType === 'unpaid' ? Number(initialBalanceValue) : (profile.initial_unpaid_balance || 0)
    };

    const res = await fetch(`/api/syndic/profile/${syndicId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      setIsInitialBalanceModalOpen(false);
      // Optimistic update
      setProfile((prev: any) => ({
        ...prev,
        initial_bank_balance: initialBalanceType === 'bank' ? Number(initialBalanceValue) : prev.initial_bank_balance,
        initial_cashbox_balance: initialBalanceType === 'cashbox' ? Number(initialBalanceValue) : prev.initial_cashbox_balance,
        initial_uncollected_balance: initialBalanceType === 'uncollected' ? Number(initialBalanceValue) : prev.initial_uncollected_balance,
        initial_unpaid_balance: initialBalanceType === 'unpaid' ? Number(initialBalanceValue) : prev.initial_unpaid_balance
      }));
      await fetchProfile();
      fetchData();
    } else {
      alert(t('Error updating initial balance'));
    }
  };


  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesType = !expenseTypeFilter || (e.expense_type && e.expense_type.toLowerCase().includes(expenseTypeFilter.toLowerCase()));
      const matchesSpender = !expenseSpenderFilter || (e.spender && e.spender.toLowerCase().includes(expenseSpenderFilter.toLowerCase()));
      const matchesMonth = !expenseMonthFilter || (e.date && e.date.split('-')[1] === expenseMonthFilter);
      const matchesYear = !expenseYearFilter || (e.date && e.date.split('-')[0] === expenseYearFilter);
      return matchesType && matchesSpender && matchesMonth && matchesYear;
    });
  }, [expenses, expenseTypeFilter, expenseSpenderFilter, expenseMonthFilter, expenseYearFilter]);

  const filteredOtherIncomes = useMemo(() => {
    return otherIncomes.filter(oi => {
      const matchesType = !incomeTypeFilter || (oi.income_type && oi.income_type.toLowerCase().includes(incomeTypeFilter.toLowerCase()));
      const matchesContributor = !contributorNameFilter || (oi.contributor_name && oi.contributor_name.toLowerCase().includes(contributorNameFilter.toLowerCase()));
      const matchesMonth = !otherIncomeMonthFilter || (oi.date && oi.date.split('-')[1] === otherIncomeMonthFilter);
      const matchesYear = !otherIncomeYearFilter || (oi.date && oi.date.split('-')[0] === otherIncomeYearFilter);
      return matchesType && matchesContributor && matchesMonth && matchesYear;
    });
  }, [otherIncomes, incomeTypeFilter, contributorNameFilter, otherIncomeMonthFilter, otherIncomeYearFilter]);

  const totalOtherIncome = useMemo(() => {
    return filteredOtherIncomes.reduce((sum, oi) => sum + Number(oi.amount || 0), 0);
  }, [filteredOtherIncomes]);

  const displayRentalIncomes = useMemo(() => {
    const allRecords = Array.isArray(rentalIncomes) ? rentalIncomes : [];
    
    // Group by tenant (name + property)
    const tenantMap = new Map<string, RentalIncome[]>();
    allRecords.forEach(ri => {
      const key = `${ri.tenant_name || ''}-${ri.property_type || ''}`;
      if (!tenantMap.has(key)) tenantMap.set(key, []);
      tenantMap.get(key)!.push(ri);
    });

    const targetYear = parseInt(yearFilter) || new Date().getFullYear();
    
    const result: any[] = [];
    tenantMap.forEach((records) => {
      const earliestRecord = [...records].sort((a, b) => a.year - b.year)[0];
      if (earliestRecord.year > targetYear) return;

      const yearRecord = records.find(r => r.year === targetYear);
      const latestRecord = [...records].sort((a, b) => b.year - a.year)[0];
      
      const baseRecord = yearRecord || {
        ...latestRecord,
        id: -latestRecord.id,
        year: targetYear,
        total_paid: 0,
        months_paid: '',
        months_unpaid: ''
      };

      const cumulativeTotalPaid = records.reduce((sum, r) => sum + (r.total_paid || 0), 0);
      
      result.push({
        ...baseRecord,
        cumulativeTotalPaid,
        firstDate: earliestRecord.date
      });
    });

    return result.filter(ri => {
      const matchesName = !buildingFilter || (ri.tenant_name && ri.tenant_name.toLowerCase().includes(buildingFilter.toLowerCase()));
      return matchesName;
    });
  }, [rentalIncomes, yearFilter, buildingFilter]);

  const residentPropertyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    residents.forEach(r => {
      const key = r.full_name; 
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [residents]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nextReceiptNumber, setNextReceiptNumber] = useState<number | string>('');
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBalanceInfoModalOpen, setIsBalanceInfoModalOpen] = useState(false);
  const [residentError, setResidentError] = useState<string | null>(null);
  const [monthlyFeeModalType, setMonthlyFeeModalType] = useState<'resident' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [directPrintPayment, setDirectPrintPayment] = useState<Payment | null>(null);
  const [directPrintProjectPayment, setDirectPrintProjectPayment] = useState<ProjectPayment | null>(null);
  const [directPrintOtherIncome, setDirectPrintOtherIncome] = useState<any>(null);
  const [directPrintRentalPayment, setDirectPrintRentalPayment] = useState<any>(null);
  const [payingRental, setPayingRental] = useState<any>(null);
  const [viewingRentalHistory, setViewingRentalHistory] = useState<any>(null);
  const [rentalPayments, setRentalPayments] = useState<any[]>([]);
  const [rentalPaymentAmount, setRentalPaymentAmount] = useState<string>('');
  const [rentalPaymentType, setRentalPaymentType] = useState<string>('cash');
  const [rentalPaymentDate, setRentalPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [editingRentalPayment, setEditingRentalPayment] = useState<any>(null);
  const [editingOtherIncome, setEditingOtherIncome] = useState<any>(null);
  const [selectedRentalYear, setSelectedRentalYear] = useState<string>('all');
  const [rentalHistoryView, setRentalHistoryView] = useState<any>(null);

  
  const [selectedResidentId, setSelectedResidentId] = useState<string>('');
  const [modalApartmentFilter, setModalApartmentFilter] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentType, setPaymentType] = useState<string>('cash');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [autoMonths, setAutoMonths] = useState<string>('');
  const [autoYear, setAutoYear] = useState<string>('');
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
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [automaticReminders, setAutomaticReminders] = useState<any[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [residentAddSuccess, setResidentAddSuccess] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    successCount: number;
    failCount: number;
    reasons: string[];
  } | null>(null);
  const [paymentAddSuccess, setPaymentAddSuccess] = useState(false);
  const [isInitialBalanceModalOpen, setIsInitialBalanceModalOpen] = useState(false);
  const [initialBalanceType, setInitialBalanceType] = useState<'bank' | 'cashbox' | 'uncollected' | 'unpaid'>('bank');
  const [initialBalanceValue, setInitialBalanceValue] = useState<string>('');
  const [localBankBalance, setLocalBankBalance] = useState<string>('');
  const [localCashboxBalance, setLocalCashboxBalance] = useState<string>('');
  const [localUncollectedBalance, setLocalUncollectedBalance] = useState<string>('');
  const [localUnpaidBalance, setLocalUnpaidBalance] = useState<string>('');
  const [localMembershipFee, setLocalMembershipFee] = useState<string>('');
  const [localCertifiedMonth, setLocalCertifiedMonth] = useState<string>('');
  const [localCertifiedYear, setLocalCertifiedYear] = useState<string>('');
  const [localCurrency, setLocalCurrency] = useState<string>('DH');
  const [localShowApartments, setLocalShowApartments] = useState<boolean>(true);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const monthsFr = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const displayMonths = monthsFr;

  useEffect(() => {
    if (!syndicId) {
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
      localStorage.removeItem('syndicAuth');
      window.dispatchEvent(new Event('authChanged'));
      navigate('/');
      return;
    }
    setBuildingFilter('');
    setApartmentFilter('');
    setYearFilter('');
    fetchData();
    fetchProfile();
  }, [syndicId, activeTab, paymentSubTab, selectedReport, otherIncomeSubTab, financialSubTab, dashboardMonthFilter, dashboardYearFilter, viewingResident]);

  useEffect(() => {
    if (activeTab === 'reports') {
      if (selectedReport === 'residents' && !localShowApartments) {
        setSelectedReport(null);
      }
    }
  }, [localShowApartments, activeTab, selectedReport]);

  useEffect(() => {
    if (activeTab === 'payments' && isModalOpen) {
      if (editingItem) {
        setSelectedResidentId(String(editingItem.resident_id || ''));
        setPaymentAmount(String(editingItem.amount || ''));
        setPaymentDate(editingItem.date || new Date().toISOString().split('T')[0]);
        setPaymentType(editingItem.payment_type || 'cash');
        setAutoMonths(editingItem.months || '');
        setAutoYear(editingItem.year || '');
      } else {
        setSelectedResidentId('');
        setPaymentAmount('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setAutoMonths('');
        setAutoYear(String(profile?.certified_year || new Date().getFullYear()));
        setModalApartmentFilter('');
      }
    }
  }, [isModalOpen, editingItem, activeTab, profile]);

  useEffect(() => {
    if (activeTab === 'payments' && isModalOpen && !editingItem) {
      const amount = Number(paymentAmount);
      const resId = Number(selectedResidentId);
      
      if (resId && amount && profile) {
        const resident = residents.find(r => r.id === resId);
        if (resident) {
          const monthlyFee = profile.membership_fee || 0;
          
          if (monthlyFee > 0) {
            const residentPayments = payments.filter(c => Number(c.resident_id) === resId);
            const totalPreviouslyPaid = Number(resident.current_balance || 0) + residentPayments.reduce((sum, c) => sum + Number(c.amount || 0), 0);
            
            const certYear = profile.certified_year || new Date().getFullYear();
            const certMonth = profile.certified_month || 1;
            
            const monthsAlreadyPaid = Math.floor(totalPreviouslyPaid / monthlyFee);
            const monthsToPay = Math.floor(amount / monthlyFee);
            
            if (monthsToPay > 0) {
              const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

              const coveredMonths = [];
              let lastYear = certYear;
              
              for (let i = 0; i < monthsToPay; i++) {
                const totalMonthsSinceStart = monthsAlreadyPaid + i;
                const currentMonthIndex = (certMonth - 1 + totalMonthsSinceStart) % 12;
                const currentYear = certYear + Math.floor((certMonth - 1 + totalMonthsSinceStart) / 12);
                
                coveredMonths.push(monthNames[currentMonthIndex]);
                lastYear = currentYear;
              }

              setAutoMonths(coveredMonths.join(', '));
              setAutoYear(String(lastYear));
            } else {
              setAutoMonths('');
              setAutoYear(String(certYear));
            }
          }
        }
      }
    }
  }, [selectedResidentId, paymentAmount, residents, payments, profile, isRtl, activeTab, isModalOpen, editingItem]);

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

  const handleDeleteAutomaticReminder = async (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: t('Delete Notification'),
      message: t('Are you sure you want to delete this notification?'),
      onConfirm: async () => {
        await fetch(`/api/syndic/automatic-reminders/${id}`, { method: 'DELETE' });
        fetchData();
      }
    });
  };

  const handleClearAllAutomaticReminders = async () => {
    if (!syndicId) return;
    setConfirmConfig({
      isOpen: true,
      title: t('Clear Notifications'),
      message: t('Are you sure you want to clear all notifications?'),
      onConfirm: async () => {
        await fetch(`/api/syndic/automatic-reminders/clear-all/${syndicId}`, { method: 'DELETE' });
        fetchData();
      }
    });
  };

  const fetchProfile = async () => {
    if (!syndicId) return;
    const res = await fetch(`/api/syndic/profile/${syndicId}`);
    if (res.ok) {
      const data = await res.json();
      setProfile(data);
      setLocalBankBalance(data.initial_bank_balance?.toString() || '0');
      setLocalCashboxBalance(data.initial_cashbox_balance?.toString() || '0');
      setLocalUncollectedBalance(data.initial_uncollected_balance?.toString() || '0');
      setLocalUnpaidBalance(data.initial_unpaid_balance?.toString() || '0');
      setLocalMembershipFee(data.membership_fee?.toString() || '0');
      setLocalCertifiedMonth(data.certified_month?.toString() || '1');
      setLocalCertifiedYear(data.certified_year?.toString() || new Date().getFullYear().toString());
      setLocalCurrency(data.currency || 'DH');
      setLocalShowApartments(data.show_apartments === 1);
    } else if (res.status === 404) {
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
      localStorage.removeItem('syndicAuth');
      window.dispatchEvent(new Event('authChanged'));
      setSyndicId(null);
      navigate('/');
    }
  };

  const [residentDetailsTab, setResidentDetailsTab] = useState<'general' | 'payments' | 'status' | 'projects'>('general');
  const [residentStatusYearFilter, setResidentStatusYearFilter] = useState<string>('');
  const [residentStatusMonthFilter, setResidentStatusMonthFilter] = useState<string>('');
  const [residentPaymentsYearFilter, setResidentPaymentsYearFilter] = useState<string>('');
  const [residentPaymentsMonthFilter, setResidentPaymentsMonthFilter] = useState<string>('');
  const [residentProjectsYearFilter, setResidentProjectsYearFilter] = useState<string>('');
  const [residentProjectsMonthFilter, setResidentProjectsMonthFilter] = useState<string>('');
  const [printingCertificate, setPrintingCertificate] = useState<Resident | null>(null);

  useEffect(() => {
    if (printingCertificate) {
      const timer = setTimeout(() => {
        const printContent = document.getElementById('certificate-print-template');
        if (printContent) {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(`
              <html>
                <head>
                  <title>${t('Certificate of No Dues')}</title>
                  <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                    body { font-family: 'Inter', sans-serif; padding: 0; margin: 0; line-height: 1.3; color: #1f2937; background: #f3f4f6; }
                    .page { background: white; width: 210mm; height: 297mm; margin: 0 auto; padding: 20px 40px; box-sizing: border-box; position: relative; overflow: hidden; display: flex; flex-direction: column; }
                    
                    .header { display: flex; align-items: center; gap: 20px; margin-bottom: 8px; padding-top: 5px; }
                    .logo-container { width: 100px; height: 100px; flex-shrink: 0; }
                    .logo { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; border: 1px solid #e5e7eb; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
                    .residence-header-info { flex: 1; display: flex; flex-direction: column; gap: 6px; }
                    .residence-name-row { font-size: 28px; font-weight: 900; color: #1e3a8a; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
                    .address-bar { background: #1e3a8a; color: white; padding: 6px 15px; border-radius: 6px; font-size: 15px; font-weight: bold; text-align: center; width: 100%; }

                    .title-gray-section { background: #f8fafc; padding: 12px 25px; margin: 5px 0 15px 0; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; }
                    .title-content { flex: 1; text-align: center; }
                    .main-title { font-size: 32px; font-weight: 900; color: #1e3a8a; margin: 0; }
                    .sub-title { font-size: 16px; color: #1e3a8a; margin-top: 4px; font-weight: 500; }
                    .date-section { border-right: 5px solid #10b981; padding-right: 12px; text-align: right; min-width: 120px; }
                    .date-label { font-size: 11px; color: #64748b; margin-bottom: 2px; }
                    .date-value { font-weight: 900; font-size: 16px; color: #0f172a; }

                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin: 15px 0; }
                    .info-column h3 { color: #1e3a8a; border-bottom: 3px solid #3b82f6; padding-bottom: 5px; margin-bottom: 12px; font-size: 17px; font-weight: 900; }
                    .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 15px; }
                    .info-label { color: #475569; font-weight: 600; }
                    .info-value { font-weight: 900; color: #0f172a; }

                    .declaration-box { border: 3px solid #10b981; border-radius: 14px; padding: 15px; margin: 15px 0; background: #f0fdf4; }
                    .declaration-title { color: #10b981; font-weight: 900; font-size: 18px; margin-bottom: 8px; text-align: right; }
                    .declaration-text { text-align: justify; font-size: 15px; color: #065f46; line-height: 1.5; font-weight: 500; }

                    .financial-section { margin: 15px 0; }
                    .section-title { color: #1e3a8a; font-weight: 900; font-size: 17px; margin-bottom: 10px; text-align: right; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }
                    .financial-card { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 14px; padding: 15px; display: flex; flex-direction: column; gap: 12px; }
                    .financial-row { display: flex; justify-content: space-between; align-items: center; }
                    .financial-label { color: #64748b; font-size: 15px; font-weight: 600; }
                    .financial-value { font-size: 20px; font-weight: 900; color: #10b981; }
                    .credit-badge { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 900; }

                    .validity-box { background: #fffbeb; border: 2px solid #fef3c7; border-radius: 10px; padding: 12px; margin: 15px 0; }
                    .validity-title { color: #92400e; font-weight: 900; font-size: 15px; margin-bottom: 4px; text-align: right; }
                    .validity-text { color: #b45309; font-size: 13px; text-align: right; font-weight: 500; line-height: 1.4; }

                    .signature-section { margin-top: auto; padding-bottom: 15px; text-align: center; }
                    .signature-title { color: #1e3a8a; font-weight: 900; font-size: 18px; margin-bottom: 12px; }
                    .signature-area { border: 3px dashed #cbd5e1; border-radius: 14px; height: 110px; width: 300px; margin: 0 auto; position: relative; background: #f8fafc; }
                    .stamp-img { max-height: 90px; max-width: 240px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }

                    @media print { 
                      body { background: white; padding: 0; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                      .page { box-shadow: none; margin: 0; width: 100%; height: auto; padding: 0; border: none; }
                      @page { size: A4; margin: 1cm !important; }
                    }
                    .declaration-text { font-size: 14px; }
                    .info-row { font-size: 14px; }
                    .main-title { font-size: 28px; }
                    body { direction: ltr; }
                  </style>
                </head>
                <body>
                  <div class="page">
                    ${printContent.innerHTML}
                  </div>
                  <script>
                    window.onload = () => {
                      window.print();
                      window.close();
                    };
                  </script>
                </body>
              </html>
            `);
            printWindow.document.close();
          }
        }
      setPrintingCertificate(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [printingCertificate, t, isRtl]);

  const fetchData = async () => {
    if (!syndicId) return;
    
    if (activeTab === 'dashboard') {
      try {
        const queryParams = new URLSearchParams();
        if (dashboardMonthFilter) queryParams.append('month', dashboardMonthFilter);
        if (dashboardYearFilter) queryParams.append('year', dashboardYearFilter);
        
        const [statsRes, projectsRes, projectPaymentsRes, residentsRes] = await Promise.all([
          fetch(`/api/syndic/dashboard-stats/${syndicId}?${queryParams.toString()}`),
          fetch(`/api/syndic/projects?syndicId=${syndicId}`),
          fetch(`/api/syndic/project-payments?syndicId=${syndicId}`),
          fetch(`/api/syndic/residents?syndicId=${syndicId}`)
        ]);

        if (statsRes.ok) {
          const data = await statsRes.json();
          setDashboardStats(data);
        }
        if (projectsRes.ok) {
          const data = await projectsRes.json();
          setProjects(Array.isArray(data) ? data : []);
        }
        if (projectPaymentsRes.ok) {
          const data = await projectPaymentsRes.json();
          setProjectPayments(Array.isArray(data) ? data : []);
        }
        if (residentsRes.ok) {
          const data = await residentsRes.json();
          setResidents(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    }

    if (activeTab === 'residents' || activeTab === 'payments' || activeTab === 'reports' || viewingResident) {
      const fetchType = 'resident';

      const res = await fetch(`/api/syndic/residents?syndicId=${syndicId}&type=${fetchType}`);
      if (res.ok) {
        const residentsData = await res.json();
        setResidents(Array.isArray(residentsData) ? residentsData : []);
      }
      
      if (activeTab === 'payments' || activeTab === 'reports' || viewingResident) {
        const cRes = await fetch(`/api/syndic/payments?syndicId=${syndicId}&type=${fetchType}`);
        if (cRes.ok) {
          const paymentsData = await cRes.json();
          setPayments(Array.isArray(paymentsData) ? paymentsData : []);
        }
      }

      if (viewingResident) {
        const ppRes = await fetch(`/api/syndic/project-payments?syndicId=${syndicId}`);
        if (ppRes.ok) {
          const ppData = await ppRes.json();
          setProjectPayments(Array.isArray(ppData) ? ppData : []);
        }
      }
    } else if (activeTab === 'expenses') {
      const res = await fetch(`/api/syndic/expenses?syndicId=${syndicId}`);
      if (res.ok) {
        const expensesData = await res.json();
        setExpenses(Array.isArray(expensesData) ? expensesData : []);
      }
    } else if (activeTab === 'financial') {
      try {
        const [bankRes, cashboxRes, paymentsRes, projectPaymentsRes, projectsRes] = await Promise.all([
          fetch(`/api/syndic/bank?syndicId=${syndicId}`),
          fetch(`/api/syndic/cashbox?syndicId=${syndicId}`),
          fetch(`/api/syndic/payments?syndicId=${syndicId}`),
          fetch(`/api/syndic/project-payments?syndicId=${syndicId}`),
          fetch(`/api/syndic/projects?syndicId=${syndicId}`)
        ]);
        if (bankRes.ok) {
          const bankData = await bankRes.json();
          setBankOps(Array.isArray(bankData) ? bankData : []);
        }
        if (cashboxRes.ok) {
          const cashboxData = await cashboxRes.json();
          setCashBoxOps(Array.isArray(cashboxData) ? cashboxData : []);
        }
        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          setPayments(Array.isArray(paymentsData) ? paymentsData : []);
        }
        if (projectPaymentsRes.ok) {
          const projectPaymentsData = await projectPaymentsRes.json();
          setProjectPayments(Array.isArray(projectPaymentsData) ? projectPaymentsData : []);
        }
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(Array.isArray(projectsData) ? projectsData : []);
        }
      } catch (error) {
        console.error('Error fetching financial data:', error);
      }
    } else if (activeTab === 'other_incomes') {
      if (otherIncomeSubTab === 'rental') {
        const res = await fetch(`/api/syndic/rental-incomes?syndicId=${syndicId}`);
        if (res.ok) {
          const data = await res.json();
          setRentalIncomes(Array.isArray(data) ? data : []);
        }
      } else {
        const res = await fetch(`/api/syndic/other-incomes?syndicId=${syndicId}`);
        if (res.ok) {
          const data = await res.json();
          setOtherIncomes(Array.isArray(data) ? data : []);
        }
      }
    } else if (activeTab === 'notifications_center') {
      const [annRes, compRes, remindersRes] = await Promise.all([
        fetch(`/api/syndic/announcements/${syndicId}`),
        fetch(`/api/syndic/complaints/${syndicId}`),
        fetch(`/api/syndic/automatic-reminders/${syndicId}`)
      ]);
      if (annRes.ok) setAnnouncements(await annRes.json());
      if (compRes.ok) setComplaints(await compRes.json());
      if (remindersRes.ok) setAutomaticReminders(await remindersRes.json());
    } else if (activeTab === 'projects') {
      const [projectsRes, paymentsRes, residentsRes] = await Promise.all([
        fetch(`/api/syndic/projects?syndicId=${syndicId}`),
        fetch(`/api/syndic/project-payments?syndicId=${syndicId}`),
        fetch(`/api/syndic/residents?syndicId=${syndicId}`)
      ]);
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(Array.isArray(data) ? data : []);
      }
      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        setProjectPayments(Array.isArray(data) ? data : []);
      }
      if (residentsRes.ok) {
        const data = await residentsRes.json();
        setResidents(Array.isArray(data) ? data : []);
      }
    }
  };

  const handleAddAnnouncement = async (title: string, message: string) => {
    await fetch('/api/syndic/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syndicId, title, message })
    });
    fetchData();
  };

  const handleAddComplaint = async (subject: string, description: string) => {
    // Syndic can't add complaints
  };

  const handleUpdateComplaintStatus = async (id: number, status: 'pending' | 'in_progress') => {
    await fetch(`/api/complaints/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchData();
  };

  const handleUpdateComplaintAnswer = async (id: number, answer: string) => {
    await fetch(`/api/complaints/${id}/answer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer })
    });
    fetchData();
  };

  const handleDeleteAnnouncement = (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: t('Delete'),
      message: t('Are you sure?'),
      onConfirm: async () => {
        const res = await fetch(`/api/syndic/announcements/${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchData();
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting to add resident...');
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      syndicId,
      fullName: formData.get('fullName'),
      building: String(formData.get('building') || ''),
      apartment: formData.get('apartment'),
      phone: String(formData.get('phone') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      password: formData.get('password'),
      occupancyType: formData.get('occupancyType'),
      status: 'resident',
      currentBalance: Math.round(Number(formData.get('currentBalance') || 0) * 100) / 100,
      propertyNumber: formData.get('propertyNumber'),
      joiningDate: formData.get('joiningDate')
    };

    const normalizedBuilding = String(data.building || '').trim().toLowerCase();
    const normalizedApartment = String(data.apartment || '').trim().toLowerCase();
    const normalizedEmail = String(data.email || '').trim().toLowerCase();

    // Duplicate check
    const duplicateUnit = (Array.isArray(residents) ? residents : []).find(r => {
      const rApartment = String(r.apartment || '').trim().toLowerCase();
      if (!normalizedBuilding) return rApartment === normalizedApartment;
      const rBuilding = String(r.building || '').trim().toLowerCase();
      return rBuilding === normalizedBuilding && rApartment === normalizedApartment;
    });

    if (duplicateUnit) {
      setResidentError(t('This apartment already exists in this building'));
      return;
    }

    const duplicateEmail = (Array.isArray(residents) ? residents : []).find(r => {
      const rEmail = String(r.email || '').trim().toLowerCase();
      return normalizedEmail && rEmail === normalizedEmail;
    });

    if (duplicateEmail) {
      setResidentError(t('Email already exists'));
      return;
    }

    console.log('Sending data:', data);

    try {
      setResidentError(null);
      const res = await fetch('/api/syndic/residents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        console.log('Resident added successfully');
        setIsModalOpen(false);
        setResidentAddSuccess(true);
        setTimeout(() => setResidentAddSuccess(false), 3000);
        fetchData();
      } else {
        const err = await res.json();
        console.error('Error adding resident:', err);
        setResidentError(t('Error') + ': ' + t(err.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setResidentError(t('Error'));
    }
  };

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
              /* Hide elements that shouldn't be printed if any */
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
                  ${profile?.profile_picture ? `<img src="${profile.profile_picture}" class="syndic-logo" />` : ''}
                </div>
                <div class="header-info">
                  <h1>${title}</h1>
                  <p class="residence-name">${profile?.residence_address || ''}</p>
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
              <span class="phone-number">${profile?.phone || ''}</span>
              <span>${profile?.email || ''}</span>
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

  const calculateBalanceAtDate = (residentId: number, dateStr: string) => {
    const resident = residents.find(r => r.id === residentId);
    if (!resident) return 0;
    
    const targetDate = new Date(dateStr);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth() + 1;
    
    const certYear = profile?.certified_year || new Date().getFullYear();
    const certMonth = profile?.certified_month || 1;
    const monthlyFee = profile?.membership_fee ?? 0;

    // Total paid up to the target date
    const residentPayments = payments.filter(p => Number(p.resident_id) === residentId);
    const paidUpToDate = Number(resident.current_balance || 0) + residentPayments
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

  const handleReceiptStylesChange = async (newStyles: any) => {
    if (!syndicId || !profile) return;
    try {
      const res = await fetch(`/api/syndic/profile/${syndicId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          receiptSettings: newStyles
        })
      });
      if (res.ok) {
        await fetchProfile();
      }
    } catch (error) {
      console.error('Error saving receipt styles:', error);
    }
  };

  useEffect(() => {
    if (directPrintPayment || directPrintProjectPayment || directPrintOtherIncome || directPrintRentalPayment) {
      setTimeout(() => {
        handlePrintReceipt('hidden-receipt-template');
        setDirectPrintPayment(null);
        setDirectPrintProjectPayment(null);
        setDirectPrintOtherIncome(null);
        setDirectPrintRentalPayment(null);
      }, 100);
    }
  }, [directPrintPayment, directPrintProjectPayment, directPrintOtherIncome, directPrintRentalPayment]);

  const handlePrintInterface = async (elementId?: string, filename?: string) => {
    if (window.innerWidth <= 768) {
      const element = elementId ? document.getElementById(elementId) : document.getElementById('main-content-to-print');
      if (!element) return;
      
      const title = filename || `syndic_${activeTab}_${new Date().getTime()}`;
      const contentClone = element.cloneNode(true) as HTMLElement;
      const html = getPrintTemplate(title, contentClone.innerHTML, []);

      try {
        await exportHtmlToPdf(html, `${title}.pdf`);
      } catch (error) {
        console.error('Error exporting PDF:', error);
        window.print();
      }
    } else {
      window.print();
    }
  };

  const handlePrintReceipt = async (elementId: string) => {
    const printContent = document.getElementById(elementId);
    if (!printContent) return;

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');

    if (window.innerWidth <= 768) {
      const title = t('Receipt');
      const html = `
        <html>
          <head>
            <title>${title}</title>
            ${styles}
            <style>
              @page { size: A4; margin: 10mm; }
              body { padding: 0; background: white; font-family: 'Inter', 'Cairo', sans-serif; }
              .receipt-container { max-width: 100% !important; width: 100% !important; margin: 0 !important; box-shadow: none !important; break-after: page; }
              .receipt-container:last-child { break-after: auto; }
            </style>
          </head>
          <body dir="${isRtl ? 'rtl' : 'ltr'}">
            ${printContent.innerHTML}
          </body>
        </html>
      `;
      try {
        await exportHtmlToPdf(html, `${title}_${new Date().getTime()}.pdf`);
      } catch (error) {
        console.error('Error exporting PDF:', error);
      }
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${t('Receipt')}</title>
          ${styles}
          <style>
            @media print {
              @page { size: A4; margin: 10mm; }
              body { padding: 0; background: white; }
              .receipt-container { max-width: 100% !important; width: 100% !important; margin: 0 !important; box-shadow: none !important; break-after: page; }
              .receipt-container:last-child { break-after: auto; }
            }
            body { font-family: 'Inter', 'Cairo', sans-serif; padding: 20px; background: white; }
            .receipt-container { max-width: 800px; margin: 0 auto; }
          </style>
        </head>
        <body dir="${isRtl ? 'rtl' : 'ltr'}">
          ${printContent.innerHTML}
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                setTimeout(() => window.close(), 500);
              }, 500); // Give styles time to load
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintResidents = async () => {
    const filteredResidents = (Array.isArray(residents) ? residents : [])
      .filter(r => {
        const matchesBuilding = !buildingFilter || (r.building && r.building.trim().toLowerCase() === buildingFilter.trim().toLowerCase());
        const matchesApartment = !apartmentFilter || (r.apartment && r.apartment.trim().toLowerCase() === apartmentFilter.trim().toLowerCase());
        return matchesBuilding && matchesApartment;
      });

    const title = t('Apartments');
    const apartmentLabel = t('Apartment');

    const content = `
      <table>
        <thead>
          <tr>
            <th>${t('Full Name')}</th>
            <th>${apartmentLabel}</th>
            <th>${t('Phone')}</th>
            <th>${t('Email')}</th>
            <th>${t('Status')}</th>
          </tr>
        </thead>
        <tbody>
          ${filteredResidents.map(r => `
            <tr>
              <td>${r.full_name}</td>
              <td>${r.apartment}</td>
              <td dir="ltr" style="text-align: ${isRtl ? 'right' : 'left'};">${r.phone}</td>
              <td>${r.email || ''}</td>
              <td>${r.occupancy_type === 'owner' ? t('Owner') : t('Tenant')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const filters = [
      { label: t('Building'), value: buildingFilter },
      { label: t('Apartment'), value: apartmentFilter }
    ];

    const html = getPrintTemplate(title, content, filters);

    if (window.innerWidth <= 768) {
      try {
        await exportHtmlToPdf(html, `${title}.pdf`);
      } catch (error) {
        console.error('Error exporting PDF:', error);
      }
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handlePrintProjectPayments = async () => {
    const title = `${selectedProject?.name} - ${t('Payments')}`;
    const extraStyles = `
      .stats { display: flex; justify-content: space-between; margin-bottom: 20px; background: #f8fafc; padding: 15px; border-radius: 8px; }
      .stat-item { text-align: center; }
      .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
      .stat-value { font-size: 18px; font-weight: bold; color: #0f172a; }
      .text-green { color: #10b981; font-weight: bold; }
      .text-red { color: #e11d48; font-weight: bold; }
    `;

    const content = `
      ${projectStats ? `
      <div class="stats">
        <div class="stat-item">
          <div class="stat-label">${t('Target Amount')}</div>
          <div class="stat-value">${formatCurrency(projectStats.targetAmount, profile?.currency || 'DH')}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">${t('Total Payments')}</div>
          <div class="stat-value">${formatCurrency(projectStats.totalPaid, profile?.currency || 'DH')}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">${t('Total Remaining')}</div>
          <div class="stat-value ${projectStats.totalRemaining <= 0 ? 'text-green' : 'text-red'}">${formatCurrency(-projectStats.totalRemaining, profile?.currency || 'DH')}</div>
        </div>
      </div>
      ` : ''}
      <table>
        <thead>
          <tr>
            <th>${t('Full Name')}</th>
            <th>${t('Apartment')}</th>
            <th>${t('Payment')}</th>
            <th>${t('Date')}</th>
            <th>${t('Payment Method')}</th>
            <th>${t('Remaining')}</th>
            <th>${t('Receipt Number')}</th>
          </tr>
        </thead>
        <tbody>
          ${filteredProjectPaymentsData.map(({ resident, payment }) => `
            <tr>
              <td>${resident.full_name}</td>
              <td>${resident.apartment}</td>
              <td>${payment ? formatCurrency(payment.amount, profile?.currency || 'DH') : '-'}</td>
              <td>${payment?.date || '-'}</td>
              <td>${payment ? t(payment.payment_type || 'cash') : '-'}</td>
              <td class="${payment && payment.remaining_balance <= 0 ? 'text-green' : 'text-red'}">${payment ? formatCurrency(-payment.remaining_balance, profile?.currency || 'DH') : formatCurrency(-(selectedProject?.individual_payment || 0), profile?.currency || 'DH')}</td>
              <td>${payment?.receipt_number || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const html = getPrintTemplate(title, content, [], extraStyles);

    if (window.innerWidth <= 768) {
      try {
        await exportHtmlToPdf(html, `${title}.pdf`);
      } catch (error) {
        console.error('Error exporting PDF:', error);
      }
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile({ ...profile, profile_picture: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile({ ...profile, stamp_signature: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrintPayments = async () => {
    const filteredPayments = (Array.isArray(payments) ? payments : [])
      .filter(c => {
        const matchesBuilding = !buildingFilter || (c.building && c.building.toLowerCase().includes(buildingFilter.toLowerCase()));
        const matchesApartment = !apartmentFilter || (c.apartment && c.apartment.toLowerCase().includes(apartmentFilter.toLowerCase()));
        const matchesYear = !yearFilter || (c.date && new Date(c.date).getFullYear().toString().includes(yearFilter));
        return matchesBuilding && matchesApartment && matchesYear;
      });

    const title = t('Payments');
    const content = `
      <table>
        <thead>
          <tr>
            <th>${t('Full Name')}</th>
            <th>${t('Apartment')}</th>
            <th>${t('Date')}</th>
            <th>${t('Receipt Number')}</th>
            <th>${t('Payment Type')}</th>
            <th>${t('Payment')}</th>
          </tr>
        </thead>
        <tbody>
          ${filteredPayments.map(c => `
            <tr>
              <td>${c.full_name}</td>
              <td>${c.apartment}</td>
              <td>${c.date}</td>
              <td>${c.receipt_number}</td>
              <td>${c.payment_type === 'bank' ? t('bank') : t('cash')}</td>
              <td>${formatCurrency(c.amount, profile?.currency || 'DH')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const filters = [
      { label: t('Building'), value: buildingFilter },
      { label: t('Apartment'), value: apartmentFilter },
      { label: t('Year'), value: yearFilter }
    ];

    const html = getPrintTemplate(title, content, filters);

    if (window.innerWidth <= 768) {
      try {
        await exportHtmlToPdf(html, `${title}.pdf`);
      } catch (error) {
        console.error('Error exporting PDF:', error);
      }
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handlePrintReport = async () => {
    const filteredResidents = (Array.isArray(residents) ? residents : [])
      .filter(r => !buildingFilter || (r.building && r.building.toLowerCase().includes(buildingFilter.toLowerCase())));

    const title = t('Residents Report');
    const extraStyles = `
      .paid { color: green; font-weight: bold; }
      .unpaid { color: red; font-weight: bold; }
      table { font-size: 10px; }
      th, td { padding: 4px; text-align: center; }
    `;

    const content = `
      <table>
        <thead>
          <tr>
            <th>${t('Full Name')}</th>
            <th>${t('Apartment')}</th>
            ${displayMonths.slice(0, reportMonth).map(m => `<th>${m}</th>`).join('')}
            <th>${t('Balance')}</th>
          </tr>
        </thead>
        <tbody>
          ${filteredResidents.map(r => {
            const monthlyFee = profile?.membership_fee ?? 0;
            const certYear = profile?.certified_year || new Date().getFullYear();
            const certMonth = profile?.certified_month || 1;

            const totalPaid = Number(r.current_balance || 0) + (Array.isArray(payments) ? payments : [])
              .filter(c => Number((c as any).resident_id) === Number(r.id))
              .reduce((sum, c) => sum + Number(c.amount || 0), 0);

            const monthsCovered = monthlyFee > 0 ? Math.floor(totalPaid / monthlyFee) : 0;
            
            let totalMonthsUntilSelectedMonth = 0;
            if (reportYear > certYear) {
              totalMonthsUntilSelectedMonth = (reportYear - certYear) * 12 + (reportMonth - certMonth + 1);
            } else if (reportYear === certYear) {
              totalMonthsUntilSelectedMonth = Math.max(0, reportMonth - certMonth + 1);
            }
            
            const totalRequiredUntilSelectedMonth = totalMonthsUntilSelectedMonth * monthlyFee;
            const balanceAtSelectedMonth = totalPaid - totalRequiredUntilSelectedMonth;

            const monthCells = displayMonths.slice(0, reportMonth).map((_, i) => {
              const m = i + 1;
              const isBeforeCertified = reportYear < certYear || (reportYear === certYear && m < certMonth);
              
              if (isBeforeCertified) {
                return '<td>-</td>';
              }

              const monthIndexFromStart = (reportYear - certYear) * 12 + (m - certMonth);
              const isPaid = monthIndexFromStart < monthsCovered;

              return `<td class="${isPaid ? 'paid' : 'unpaid'}">${isPaid ? t('Paid') : t('Unpaid')}</td>`;
            }).join('');

            return `
              <tr>
                <td>${r.full_name}</td>
                <td>${r.apartment}</td>
                ${monthCells}
                <td class="${balanceAtSelectedMonth >= 0 ? 'paid' : 'unpaid'}">${formatCurrency(balanceAtSelectedMonth, profile?.currency || 'DH')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    const filters = [
      { label: t('Year'), value: reportYear },
      { label: t('Month'), value: reportMonth },
      { label: t('Building'), value: buildingFilter }
    ];

    const html = getPrintTemplate(title, content, filters, extraStyles);

    if (window.innerWidth <= 768) {
      try {
        await exportHtmlToPdf(html, `${title}.pdf`);
      } catch (error) {
        console.error('Error exporting PDF:', error);
      }
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handleAddBankOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      syndicId,
      operationType: formData.get('operationType'),
      amount: Math.round(Number(formData.get('amount')) * 100) / 100,
      name: formData.get('name'),
      date: formData.get('date'),
      description: formData.get('description'),
    };

    const endpoint = financialSubTab === 'bank' ? 'bank' : 'cashbox';
    const res = await fetch(`/api/syndic/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      setIsModalOpen(false);
      fetchData();
      setPaymentAddSuccess(true);
      setTimeout(() => setPaymentAddSuccess(false), 3000);
    } else {
      const err = await res.json();
      alert(t('Error') + ': ' + (err.error || 'Unknown error'));
    }
  };

  const handleUpdateBankOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      syndicId,
      operationType: formData.get('operationType'),
      amount: Math.round(Number(formData.get('amount')) * 100) / 100,
      name: formData.get('name'),
      date: formData.get('date'),
      description: formData.get('description'),
    };

    const endpoint = financialSubTab === 'bank' ? 'bank' : 'cashbox';
    const res = await fetch(`/api/syndic/${endpoint}/${editingItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      setIsModalOpen(false);
      setEditingItem(null);
      fetchData();
    } else {
      const err = await res.json();
      alert(t('Error') + ': ' + (err.error || 'Unknown error'));
    }
  };

  const handlePrintBankOps = async () => {
    const filteredBankOps = combinedOps.filter(op => {
      const matchesType = !bankOpTypeFilter || op.operation_type === bankOpTypeFilter;
      const formattedName = formatOperationName(op.name);
      const matchesName = !bankNameFilter || (formattedName && formattedName.toLowerCase().includes(bankNameFilter.toLowerCase()));
      const matchesMonth = !bankMonthFilter || (op.date && op.date.split('-')[1] === bankMonthFilter);
      const matchesYear = !bankYearFilter || (op.date && op.date.split('-')[0] === bankYearFilter);
      return matchesType && matchesName && matchesMonth && matchesYear;
    });

    const title = financialSubTab === 'bank' ? t('Bank Management') : t('Cash Box Management');
    const total = filteredBankOps.reduce((acc, curr) => acc + (curr.operation_type === 'deposit' ? curr.amount : -curr.amount), 0);

    const content = `
      <table>
        <thead>
          <tr>
            <th>${t('Operation Type')}</th>
            <th>${t('Name')}</th>
            <th>${t('Apartment')}</th>
            <th>${t('Date')}</th>
            <th>${t('Description')}</th>
            <th>${t('Amount')}</th>
          </tr>
        </thead>
        <tbody>
          ${filteredBankOps.map(op => `
            <tr>
              <td>${t(op.operation_type === 'deposit' ? 'Deposit' : 'Withdrawal')}</td>
              <td>${formatOperationName(op.name) || '-'}</td>
              <td>${op.apartment || '-'}</td>
              <td>${op.date || '-'}</td>
              <td>${formatOperationDescription(op.description) || '-'}</td>
              <td>${formatCurrency(op.amount, profile?.currency || 'DH')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="total" style="font-weight: bold; margin-top: 20px; text-align: ${isRtl ? 'left' : 'right'}; font-size: 1.2em;">
        ${financialSubTab === 'bank' ? t('Bank Balance') : t('Cash Box Balance')}: ${formatCurrency(total, profile?.currency || 'DH')}
      </div>
    `;

    const filters = [
      { label: t('Type'), value: bankOpTypeFilter ? t(bankOpTypeFilter.charAt(0).toUpperCase() + bankOpTypeFilter.slice(1)) : null },
      { label: t('Name'), value: bankNameFilter },
      { label: t('Month'), value: bankMonthFilter },
      { label: t('Year'), value: bankYearFilter }
    ];

    const html = getPrintTemplate(title, content, filters);

    if (window.innerWidth <= 768) {
      try {
        await exportHtmlToPdf(html, `${title}.pdf`);
      } catch (error) {
        console.error('Error exporting PDF:', error);
      }
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handlePrintOtherIncomes = async () => {
    const title = otherIncomeSubTab === 'rental' ? t('Rental Incomes') : t('Other Incomes');

    const content = `
      <table>
        <thead>
          <tr>
            ${otherIncomeSubTab === 'rental' ? `
              <th>${t('Property Type')}</th>
              <th>${t('Tenant Name')}</th>
              <th>${t('Rental Price')}</th>
              <th>${t('Start Date')}</th>
              <th>${t('End Date')}</th>
              ${displayMonths.map(m => `<th>${m}</th>`).join('')}
              <th>${t('Balance')}</th>
            ` : `
              <th>${t('Income Type')}</th>
              <th>${t('Contributor Name')}</th>
              <th>${t('Date')}</th>
              <th>${t('Receipt Number')}</th>
              <th>${t('Payment Method')}</th>
              <th>${t('Amount')}</th>
              <th>${t('Notes')}</th>
            `}
          </tr>
        </thead>
        <tbody>
          ${otherIncomeSubTab === 'rental' ? 
            displayRentalIncomes.map(ri => {
              const rentalPrice = Number(ri.rental_price || 0);
              const cumulativeTotalPaid = Number(ri.cumulativeTotalPaid || 0);
              const startDate = new Date(ri.firstDate);
              const startMonth = startDate.getMonth() + 1;
              const startYear = startDate.getFullYear();
              const targetYear = Number(ri.year);
              let referenceYear = targetYear;
              let referenceMonth = 12;
              if (ri.end_date) {
                const endDate = new Date(ri.end_date);
                const endM = endDate.getMonth() + 1;
                const endY = endDate.getFullYear();
                if (endY < targetYear) {
                  referenceYear = endY;
                  referenceMonth = endM;
                } else if (endY === targetYear) {
                  referenceMonth = Math.min(12, endM);
                }
              }
              const totalMonthsRequired = Math.max(0, (referenceYear - startYear) * 12 + (referenceMonth - startMonth) + 1);
              const totalAmountRequired = totalMonthsRequired * rentalPrice;
              const balance = cumulativeTotalPaid - totalAmountRequired;
              const monthsCovered = rentalPrice > 0 ? Math.floor(cumulativeTotalPaid / rentalPrice) : 0;

              return `
                <tr>
                  <td>${ri.property_type ? t(ri.property_type) : '-'}</td>
                  <td>${ri.tenant_name}</td>
                  <td>${formatCurrency(ri.rental_price, profile?.currency || 'DH')}</td>
                  <td>${ri.date}</td>
                  <td>${ri.end_date || '-'}</td>
                  ${displayMonths.map((_, i) => {
                    const monthNum = i + 1;
                    const isPaid = monthsCovered >= ((targetYear - startYear) * 12 + (monthNum - startMonth) + 1);
                    return `<td style="text-align: center; font-size: 10px;">${isPaid ? t('Paid') : t('Unpaid')}</td>`;
                  }).join('')}
                  <td>${formatCurrency(balance, profile?.currency || 'DH')}</td>
                </tr>
              `;
            }).join('')
          :
            filteredOtherIncomes.map(oi => `
              <tr>
                <td>${t(oi.income_type)}</td>
                <td>${oi.contributor_name}</td>
                <td>${oi.date}</td>
                <td>${oi.receipt_number}</td>
                <td>${t(oi.payment_type || 'cash')}</td>
                <td>${formatCurrency(oi.amount, profile?.currency || 'DH')}</td>
                <td>${oi.notes || '-'}</td>
              </tr>
            `).join('')
          }
        </tbody>
      </table>
    `;

    const html = getPrintTemplate(title, content);

    if (window.innerWidth <= 768) {
      try {
        await exportHtmlToPdf(html, `${title}.pdf`);
      } catch (error) {
        console.error('Error exporting PDF:', error);
      }
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handlePrintExpenses = async () => {
    const title = t('Expenses');

    const content = `
      <table>
        <thead>
          <tr>
            <th>${t('Expense Type')}</th>
            <th>${t('Spender')}</th>
            <th>${t('Amount')}</th>
            <th>${t('Date')}</th>
            <th>${t('Receipt Number')}</th>
            <th>${t('Notes')}</th>
          </tr>
        </thead>
        <tbody>
          ${filteredExpenses.map(e => `
            <tr>
              <td>${t(e.expense_type)}</td>
              <td>${e.spender}</td>
              <td>${formatCurrency(e.amount, profile?.currency || 'DH')}</td>
              <td>${e.date}</td>
              <td>${e.receipt_number}</td>
              <td>${e.notes || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2"><strong>${t('Total Expenses')}</strong></td>
            <td colspan="4"><strong>${formatCurrency(filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0), profile?.currency || 'DH')}</strong></td>
          </tr>
        </tfoot>
      </table>
    `;

    const filters = [
      { label: t('Type'), value: expenseTypeFilter ? t(expenseTypeFilter.charAt(0).toUpperCase() + expenseTypeFilter.slice(1)) : null },
      { label: t('Spender'), value: expenseSpenderFilter },
      { label: t('Year'), value: expenseYearFilter }
    ];

    const html = getPrintTemplate(title, content, filters);

    if (window.innerWidth <= 768) {
      try {
        await exportHtmlToPdf(html, `${title}.pdf`);
      } catch (error) {
        console.error('Error exporting PDF:', error);
      }
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handleExportProjectPaymentsExcel = () => {
    if (!selectedProject) return;
    
    const dataToExport = filteredProjectPaymentsData.map(({ resident, payment }) => ({
      [t('Full Name')]: resident.full_name,
      [t('Apartment')]: resident.apartment,
      [t('Payment')]: payment ? payment.amount : 0,
      [t('Date')]: payment ? payment.date : '-',
      [t('Remaining')]: payment ? -payment.remaining_balance : -(selectedProject.individual_payment || 0),
      [t('Receipt Number')]: payment ? payment.receipt_number : '-',
      [t('Payment Method')]: payment ? t(payment.payment_type || 'cash') : '-'
    }));

    const fileName = `${selectedProject.name}_Payments_${new Date().toISOString().split('T')[0]}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments");
    XLSX.writeFile(wb, fileName);
  };

  const handleExportExcel = () => {
    let dataToExport: any[] = [];
    let fileName = `${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`;

    if (activeTab === 'residents') {
      dataToExport = (Array.isArray(residents) ? residents : [])
        .filter(r => {
          const matchesBuilding = !buildingFilter || (r.building && r.building.trim().toLowerCase() === buildingFilter.trim().toLowerCase());
          const matchesApartment = !apartmentFilter || (r.apartment && r.apartment.trim().toLowerCase() === apartmentFilter.trim().toLowerCase());
          return matchesBuilding && matchesApartment;
        })
        .map(r => ({
          [t('Full Name')]: r.full_name,
          [t('Apartment')]: r.apartment,
          [t('Phone')]: r.phone,
          [t('Email')]: r.email || '',
          [t('Password')]: r.password || '',
          [t('Starting Balance')]: r.current_balance || 0,
          [t('Status')]: r.occupancy_type === 'owner' ? t('Owner') : t('Tenant')
        }));
    } else if (activeTab === 'payments') {
      dataToExport = (Array.isArray(payments) ? payments : [])
        .filter(c => {
          const matchesBuilding = !buildingFilter || (c.building && c.building.toLowerCase().includes(buildingFilter.toLowerCase()));
          const matchesApartment = !apartmentFilter || (c.apartment && c.apartment.toLowerCase().includes(apartmentFilter.toLowerCase()));
          const matchesMonth = !monthFilter || (c.date && c.date.split('-')[1] === monthFilter);
          const matchesYear = !yearFilter || (c.date && c.date.split('-')[0] === yearFilter);
          return matchesBuilding && matchesApartment && matchesMonth && matchesYear;
        })
        .map(c => ({
          [t('Full Name')]: c.full_name,
          [t('Apartment')]: c.apartment,
          [t('Payment')]: c.amount,
          [t('Date')]: c.date,
          [t('Receipt Number')]: c.receipt_number,
          [t('Payment Method')]: t(c.payment_type || 'cash'),
          [t('Total Payments')]: c.total_paid
        }));
    } else if (activeTab === 'expenses') {
      dataToExport = (Array.isArray(expenses) ? expenses : [])
        .map(e => ({
          [t('Expense Type')]: e.expense_type,
          [t('Spender')]: e.spender,
          [t('Subscription Price')]: e.amount,
          [t('Receipt Number')]: e.receipt_number
        }));
    } else if (activeTab === 'projects') {
      dataToExport = (Array.isArray(projects) ? projects : [])
        .map(p => ({
          [t('Project Name')]: p.name,
          [t('Description')]: p.description,
          [t('Target Amount')]: p.target_amount,
          [t('Individual Payment')]: p.individual_payment,
          [t('Status')]: t(p.status),
          [t('End Date')]: p.end_date,
          [t('Created At')]: p.created_at
        }));
    } else if (activeTab === 'reports') {
      dataToExport = (Array.isArray(residents) ? residents : [])
        .filter(r => !buildingFilter || (r.building && r.building.toLowerCase().includes(buildingFilter.toLowerCase())))
        .map(r => {
          const monthlyFee = profile?.membership_fee ?? 0;
          const certYear = profile?.certified_year || new Date().getFullYear();
          const certMonth = profile?.certified_month || 1;

          const totalPaid = Number(r.current_balance || 0) + (Array.isArray(payments) ? payments : [])
            .filter(c => Number((c as any).resident_id) === Number(r.id))
            .reduce((sum, c) => sum + Number(c.amount || 0), 0);

          const monthsCovered = monthlyFee > 0 ? Math.floor(totalPaid / monthlyFee) : 0;
          
          let totalMonthsUntilSelectedMonth = 0;
          if (reportYear > certYear) {
            totalMonthsUntilSelectedMonth = (reportYear - certYear) * 12 + (reportMonth - certMonth + 1);
          } else if (reportYear === certYear) {
            totalMonthsUntilSelectedMonth = Math.max(0, reportMonth - certMonth + 1);
          }
          
          const totalRequiredUntilSelectedMonth = totalMonthsUntilSelectedMonth * monthlyFee;
          const balanceAtSelectedMonth = totalPaid - totalRequiredUntilSelectedMonth;

          return {
            [t('Full Name')]: r.full_name,
            [t('Apartment')]: r.apartment,
            [t('Balance')]: balanceAtSelectedMonth
          };
        });
    } else if (activeTab === 'bank') {
      dataToExport = (Array.isArray(bankOps) ? bankOps : [])
        .map(op => ({
          [t('Operation Type')]: t(op.operation_type.charAt(0).toUpperCase() + op.operation_type.slice(1)),
          [t('Subscription Price')]: op.amount
        }));
    } else if (activeTab === 'other_incomes') {
      if (otherIncomeSubTab === 'rental') {
        dataToExport = displayRentalIncomes.map(ri => {
          const exportRow: any = {
            [t('Property Type')]: ri.property_type,
            [t('Tenant Name')]: ri.tenant_name,
            [t('Phone')]: ri.phone,
            [t('Rental Price')]: ri.rental_price,
            [t('Receipt Number')]: ri.receipt_number,
            [t('Year')]: ri.year,
            [t('Date')]: ri.date
          };

          const rentalPrice = Number(ri.rental_price || 0);
          const cumulativeTotalPaid = Number(ri.cumulativeTotalPaid || 0);
          
          const startDate = new Date(ri.firstDate);
          const startMonth = startDate.getMonth() + 1;
          const startYear = startDate.getFullYear();
          const targetYear = Number(ri.year);

          displayMonths.forEach((m, i) => {
             const monthIndex = i + 1;
             const monthsSinceStart = (targetYear - startYear) * 12 + (monthIndex - startMonth);
             const monthsCovered = rentalPrice > 0 ? Math.floor(cumulativeTotalPaid / rentalPrice) : 0;
             
             let status = '';
             if (monthsSinceStart < 0) {
                status = '-';
             } else {
                let isEnded = false;
                if (ri.end_date) {
                    const endDate = new Date(ri.end_date);
                    const endMonth = endDate.getMonth() + 1;
                    const endYear = endDate.getFullYear();
                    if (targetYear > endYear || (targetYear === endYear && monthIndex > endMonth)) {
                        isEnded = true;
                    }
                }
                
                if (isEnded) {
                    status = '-';
                } else {
                    const isPaid = monthsSinceStart < monthsCovered;
                    status = isPaid ? t('Paid') : t('Unpaid');
                }
             }
             exportRow[m] = status;
          });

          let referenceYear = targetYear;
          let referenceMonth = 12;

          if (ri.end_date) {
            const endDate = new Date(ri.end_date);
            const endM = endDate.getMonth() + 1;
            const endY = endDate.getFullYear();
            
            if (endY < targetYear) {
              referenceYear = endY;
              referenceMonth = endM;
            } else if (endY === targetYear) {
              referenceMonth = Math.min(12, endM);
            }
          }

          const totalMonthsRequired = Math.max(0, (referenceYear - startYear) * 12 + (referenceMonth - startMonth) + 1);
          const totalAmountRequired = totalMonthsRequired * rentalPrice;
          const balance = cumulativeTotalPaid - totalAmountRequired;

          exportRow[t('Balance')] = balance;

          return exportRow;
        });
      } else {
        dataToExport = otherIncomes.map(oi => ({
          [t('Income Type')]: oi.income_type,
          [t('Contributor Name')]: oi.contributor_name,
          [t('Amount')]: oi.amount,
          [t('Date')]: oi.date,
          [t('Receipt Number')]: oi.receipt_number
        }));
      }
    }

    if (dataToExport.length === 0) {
      alert(t('No data to export'));
      return;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab);
    XLSX.writeFile(wb, fileName);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const cleanExcelValue = (val: any) => {
        if (val === undefined || val === null) return '';
        const str = String(val).trim();
        return str.replace(/(\d+)\.0+$/, '$1');
      };

      let successCount = 0;
      let failCount = 0;
      let reasons: string[] = [];

      for (const row of data) {
        if (activeTab === 'residents') {

          const fullName = cleanExcelValue(row[t('Full Name')] || row['Full Name']);
          if (!fullName) {
            failCount++;
            const reason = t('Missing full name');
            if (!reasons.includes(reason)) reasons.push(reason);
            continue;
          }

          const residentData = {
            syndicId,
            fullName,
            building: cleanExcelValue(row[t('Building')] || row['Building']),
            apartment: cleanExcelValue(row[t('Apartment')] || row['Apartment']),
            phone: cleanExcelValue(row[t('Phone')] || row['Phone']),
            email: row[t('Email')] || row['Email'],
            password: cleanExcelValue(row[t('Password')] || row['Password']),
            occupancyType: (row[t('Status')] || row['Status']) === t('Tenant') ? 'tenant' : 'owner',
            status: 'resident',
            currentBalance: Number(row[t('Starting Balance')] || row['Starting Balance'] || row[t('Current Balance')] || row['Current Balance'] || 0)
          };

          const isDuplicate = (Array.isArray(residents) ? residents : []).some(r => 
            (r.building === residentData.building && r.apartment === residentData.apartment) || 
            (residentData.email && r.email === residentData.email)
          );

          if (isDuplicate) {
            failCount++;
            const reason = t('Duplicate entry (Building/Apartment or Email)');
            if (!reasons.includes(reason)) reasons.push(reason);
            continue;
          }

          const res = await fetch('/api/syndic/residents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(residentData)
          });
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
            const err = await res.json();
            const reason = err.error || t('Server error');
            if (!reasons.includes(reason)) reasons.push(reason);
          }
        } else if (activeTab === 'payments') {
          const fullName = cleanExcelValue(row[t('Full Name')] || row['Full Name']);
          const building = cleanExcelValue(row[t('Building')] || row['Building']);
          const apartment = cleanExcelValue(row[t('Apartment')] || row['Apartment']);
          
          const resident = (Array.isArray(residents) ? residents : []).find(r => 
            r.full_name === fullName && 
            r.building === building && 
            r.apartment === apartment
          );

          if (resident) {
            const paymentData = {
              syndicId,
              residentId: resident.id,
              amount: Number(row[t('Payment')] || row['Payment']),
              date: row[t('Date')] || row['Date'] || new Date().toISOString().split('T')[0],
              receiptNumber: cleanExcelValue(row[t('Receipt Number')] || row['Receipt Number'] || '')
            };

            const res = await fetch('/api/syndic/payments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(paymentData)
            });
            if (res.ok) successCount++;
            else failCount++;
          } else {
            failCount++;
          }
        } else if (activeTab === 'expenses') {
          const expenseData = {
            syndicId,
            expenseType: cleanExcelValue(row[t('Expense Type')] || row['Expense Type']),
            spender: cleanExcelValue(row[t('Spender')] || row['Spender']),
            amount: Number(row[t('Subscription Price')] || row['Subscription Price']),
            receiptNumber: cleanExcelValue(row[t('Receipt Number')] || row['Receipt Number'] || '')
          };

          const res = await fetch('/api/syndic/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expenseData)
          });
          if (res.ok) successCount++;
          else failCount++;
        }
      }

      if (activeTab === 'residents') {
        setImportSummary({ successCount, failCount, reasons });
        setTimeout(() => setImportSummary(null), 10000);
      }

      fetchData();
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleUpdateResident = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      fullName: formData.get('fullName'),
      building: formData.get('building') !== null ? String(formData.get('building') || '') : String(editingItem?.building || ''),
      apartment: formData.get('apartment'),
      phone: String(formData.get('phone') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      password: formData.get('password') || undefined,
      occupancyType: formData.get('occupancyType'),
      status: editingItem.status,
      is_active: formData.get('is_active') === 'on' ? 1 : 0,
      currentBalance: Math.round(Number(formData.get('currentBalance') || 0) * 100) / 100,
      propertyNumber: formData.get('propertyNumber'),
      joiningDate: formData.get('joiningDate')
    };

    const normalizedBuilding = String(data.building || '').trim().toLowerCase();
    const normalizedApartment = String(data.apartment || '').trim().toLowerCase();
    const normalizedEmail = String(data.email || '').trim().toLowerCase();

    // Duplicate check
    const duplicateUnit = (Array.isArray(residents) ? residents : []).find(r => {
      if (Number(r.id) === Number(editingItem.id)) return false;
      const rApartment = String(r.apartment || '').trim().toLowerCase();
      if (!normalizedBuilding) return rApartment === normalizedApartment;
      const rBuilding = String(r.building || '').trim().toLowerCase();
      return rBuilding === normalizedBuilding && rApartment === normalizedApartment;
    });

    if (duplicateUnit) {
      setResidentError(t('This apartment already exists in this building'));
      return;
    }

    const duplicateEmail = (Array.isArray(residents) ? residents : []).find(r => {
      if (Number(r.id) === Number(editingItem.id)) return false;
      const rEmail = String(r.email || '').trim().toLowerCase();
      if (normalizedEmail && rEmail === normalizedEmail) {
        console.log('Duplicate email found:', normalizedEmail, 'for resident:', r.id, 'editingItem.id:', editingItem.id);
        return true;
      }
      return false;
    });

    if (duplicateEmail) {
      setResidentError(t('Email already exists'));
      return;
    }

    try {
      setResidentError(null);
      const res = await fetch(`/api/syndic/residents/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingItem(null);
        fetchData();
      } else {
        const err = await res.json();
        setResidentError(t('Error') + ': ' + t(err.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Update error:', error);
      setResidentError(t('Error'));
    }
  };

  const handleDeleteResident = async (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: t('Delete Item'),
      message: t('Are you sure you want to delete this item?'),
      onConfirm: async () => {
        let endpoint = '';
        if (activeTab === 'payments') endpoint = `/api/syndic/payments/${id}`;
        else if (activeTab === 'expenses') endpoint = `/api/syndic/expenses/${id}`;
        else if (activeTab === 'financial') {
          endpoint = financialSubTab === 'bank' ? `/api/syndic/bank/${id}` : `/api/syndic/cashbox/${id}`;
        } else if (activeTab === 'other_incomes') {
          endpoint = otherIncomeSubTab === 'rental' ? `/api/syndic/rental-incomes/${id}` : `/api/syndic/other-incomes/${id}`;
        } else endpoint = `/api/syndic/residents/${id}`;
        
        await fetch(endpoint, { method: 'DELETE' });
        fetchData();
      }
    });
  };

  const handleDeleteAll = async () => {
    if (!syndicId) return;
    setConfirmConfig({
      isOpen: true,
      title: t('Delete All'),
      message: t('Are you sure you want to delete all items in this category?'),
      onConfirm: async () => {
        let endpoint = '';
        if (activeTab === 'residents') {
          endpoint = `/api/syndic/residents/all/${syndicId}?type=resident`;
        } else if (activeTab === 'payments') {
          endpoint = `/api/syndic/payments/all/${syndicId}`;
        } else if (activeTab === 'expenses') {
          endpoint = `/api/syndic/expenses/all/${syndicId}`;
        } else if (activeTab === 'other_incomes') {
          endpoint = otherIncomeSubTab === 'rental' ? `/api/syndic/rental-incomes/all/${syndicId}` : `/api/syndic/other-incomes/all/${syndicId}`;
        }
        
        if (endpoint) {
          try {
            const res = await fetch(endpoint, { method: 'DELETE' });
            if (res.ok) {
              fetchData();
            }
          } catch (error) {
            console.error('Error deleting all items:', error);
          }
        }
      }
    });
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      residenceName: formData.get('residenceName'),
      residenceAddress: formData.get('residenceAddress'),
      profilePicture: profile.profile_picture,
      stampSignature: profile.stamp_signature,
      // Ensure numerical fields are rounded and use correct keys for API
      monthlyFee: Math.round(Number(profile.monthly_fee || 0) * 100) / 100,
      currency: profile.currency || 'DH',
      residentMonthlyFee: Math.round(Number(profile.resident_monthly_fee || 0) * 100) / 100,
      membershipFee: Math.round(Number(profile.membership_fee || 0) * 100) / 100,
      initialBankBalance: Math.round(Number(profile.initial_bank_balance || 0) * 100) / 100,
      initialCashboxBalance: Math.round(Number(profile.initial_cashbox_balance || 0) * 100) / 100,
      initialUncollectedBalance: Math.round(Number(profile.initial_uncollected_balance || 0) * 100) / 100,
      initialUnpaidBalance: Math.round(Number(profile.initial_unpaid_balance || 0) * 100) / 100,
      certifiedYear: profile.certified_year || new Date().getFullYear(),
      certifiedMonth: profile.certified_month || (new Date().getMonth() + 1),
      showApartments: profile.show_apartments,
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword')
    };

    if (data.newPassword && data.newPassword !== formData.get('confirmPassword')) {
      alert(t('Passwords do not match'));
      return;
    }

    const res = await fetch(`/api/syndic/profile/${syndicId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await fetchProfile();
      fetchData();
      window.dispatchEvent(new Event('profileUpdated'));
    } else {
      const errorData = await res.json();
      alert(errorData.error === 'Incorrect current password' ? t('Incorrect current password') : (errorData.error || t('Error updating profile')));
    }
  };

  const handleUpdateMonthlyFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    const formData = new FormData(e.target as HTMLFormElement);
    const newFee = Math.round(Number(formData.get('monthlyFee')) * 100) / 100;
    const newCurrency = formData.get('currency') as string;
    
    const data = {
      fullName: profile.full_name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      residenceAddress: profile.residence_address || '',
      profilePicture: profile.profile_picture || '',
      monthlyFee: Math.round(Number(profile.monthly_fee || 0) * 100) / 100,
      currency: newCurrency,
      residentMonthlyFee: monthlyFeeModalType === 'resident' ? newFee : Math.round(Number(profile.resident_monthly_fee || 0) * 100) / 100,
      membershipFee: Math.round(Number(profile.membership_fee || 0) * 100) / 100,
      initialBankBalance: Math.round(Number(profile.initial_bank_balance || 0) * 100) / 100,
      initialCashboxBalance: Math.round(Number(profile.initial_cashbox_balance || 0) * 100) / 100,
      initialUncollectedBalance: Math.round(Number(profile.initial_uncollected_balance || 0) * 100) / 100,
      initialUnpaidBalance: Math.round(Number(profile.initial_unpaid_balance || 0) * 100) / 100,
      certifiedYear: profile.certified_year || new Date().getFullYear(),
      certifiedMonth: profile.certified_month || (new Date().getMonth() + 1),
      showApartments: profile.show_apartments
    };

    try {
      const res = await fetch(`/api/syndic/profile/${syndicId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        const result = await res.json();
        if (result.changes === 0) {
          console.warn('No rows updated. User ID might not exist in database.');
        }
        setMonthlyFeeModalType(null);
        // Optimistic update
        setProfile((prev: any) => ({
          ...prev,
          currency: newCurrency,
          resident_monthly_fee: monthlyFeeModalType === 'resident' ? newFee : prev.resident_monthly_fee
        }));
        // Refresh from server to be 100% sure
        await fetchProfile();
        fetchData();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const err = await res.json();
        alert(t('Error') + ': ' + (err.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Update error:', error);
      alert(t('Error'));
    }
  };

  const handleSort = (key: 'building' | 'apartment') => {
    const sorted = [...residents].sort((a, b) => {
      const valA = String(a[key] || '').toLowerCase();
      const valB = String(b[key] || '').toLowerCase();
      return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    });
    setResidents(sorted);
  };

  const fetchNextReceiptNumber = async (type: 'payment' | 'expense' | 'rental' | 'other_income' | 'project_payment') => {
    if (type === 'rental' || type === 'other_income' || type === 'payment' || type === 'project_payment') {
      const currentYear = new Date().getFullYear();
      try {
        const res = await fetch(`/api/syndic/max-receipt-number?syndicId=${syndicId}&year=${currentYear}&type=${type}`);
        const data = await res.json();
        const maxRN = data.maxNum || 0;
        const prefix = (type === 'payment' || type === 'project_payment') ? `P${currentYear}/` : `R${currentYear}/`;
        setNextReceiptNumber(`${prefix}${String(maxRN + 1).padStart(3, '0')}`);
      } catch (error) {
        console.error('Failed to fetch max receipt number', error);
        const prefix = (type === 'payment' || type === 'project_payment') ? `P${currentYear}/` : `R${currentYear}/`;
        setNextReceiptNumber(`${prefix}001`);
      }
      return;
    }

    let endpoint = '';
    if (type === 'expense') endpoint = `/api/syndic/expenses?syndicId=${syndicId}`;
    else if (type === 'project_payment') endpoint = `/api/syndic/project-payments?syndicId=${syndicId}`;
    else endpoint = `/api/syndic/payments?syndicId=${syndicId}`;

    const res = await fetch(endpoint);
    const data = await res.json();
    const maxRN = (Array.isArray(data) ? data : []).reduce((max: number, item: any) => {
      const rn = parseInt(item.receipt_number);
      return isNaN(rn) ? max : Math.max(max, rn);
    }, 0);
    setNextReceiptNumber(maxRN + 1);
  };

  const handleAddRentalIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const data = {
        syndicId,
        propertyType: formData.get('propertyType'),
        propertyAddress: formData.get('propertyAddress'),
        tenantName: formData.get('tenantName'),
        phone: formData.get('phone'),
        rentalPrice: Math.round(Number(formData.get('rentalPrice')) * 100) / 100,
        receiptNumber: formData.get('receiptNumber'),
        year: parseInt(yearFilter) || new Date().getFullYear(),
        date: formData.get('date'),
        endDate: formData.get('endDate'),
        paymentType: formData.get('paymentType')
      };

      const res = await fetch('/api/syndic/rental-incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setPaymentAddSuccess(true);
        setTimeout(() => setPaymentAddSuccess(false), 3000);
        fetchData();
      } else {
        const err = await res.json();
        alert(t('Error') + ': ' + (err.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding rental income:', error);
      alert(t('Error adding income'));
    }
  };

  const handleAddOtherIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const data = {
        syndicId,
        incomeType: formData.get('incomeType'),
        contributorName: formData.get('contributorName'),
        amount: Math.round(Number(formData.get('amount')) * 100) / 100,
        date: formData.get('date'),
        receiptNumber: formData.get('receiptNumber'),
        notes: formData.get('notes'),
        paymentType: formData.get('paymentType')
      };

      const res = await fetch('/api/syndic/other-incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setPaymentAddSuccess(true);
        setTimeout(() => setPaymentAddSuccess(false), 3000);
        fetchData();
      } else {
        const err = await res.json();
        alert(t('Error') + ': ' + (err.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding other income:', error);
      alert(t('Error adding income'));
    }
  };

  const handleUpdateRentalIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const data = {
        propertyType: formData.get('propertyType'),
        propertyAddress: formData.get('propertyAddress'),
        tenantName: formData.get('tenantName'),
        phone: formData.get('phone'),
        rentalPrice: Math.round(Number(formData.get('rentalPrice')) * 100) / 100,
        receiptNumber: formData.get('receiptNumber'),
        year: editingItem.year,
        date: formData.get('date'),
        endDate: formData.get('endDate'),
        totalPaid: editingItem.total_paid,
        status: editingItem.status || 'active',
      };

      const isVirtual = editingItem.id < 0;
      const url = isVirtual ? '/api/syndic/rental-incomes' : `/api/syndic/rental-incomes/${editingItem.id}`;
      const method = isVirtual ? 'POST' : 'PUT';
      const payload = isVirtual ? { ...data, syndicId } : data;

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingItem(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(t('Error') + ': ' + (err.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating rental income:', error);
      alert(t('Error updating income'));
    }
  };

  const handleUpdateOtherIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const data = {
        incomeType: formData.get('incomeType'),
        contributorName: formData.get('contributorName'),
        amount: Math.round(Number(formData.get('amount')) * 100) / 100,
        date: formData.get('date'),
        receiptNumber: formData.get('receiptNumber'),
        notes: formData.get('notes'),
        paymentType: formData.get('paymentType')
      };

      const res = await fetch(`/api/syndic/other-incomes/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingItem(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(t('Error') + ': ' + (err.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating other income:', error);
      alert(t('Error updating income'));
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const data = {
        residentId: selectedResidentId,
        syndicId,
        amount: Math.round(Number(paymentAmount) * 100) / 100,
        date: paymentDate,
        receiptNumber: formData.get('receiptNumber'),
        paymentType,
        months: autoMonths,
        year: autoYear,
        remainingBalance: 0
      };

      const res = await fetch('/api/syndic/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingItem(null);
        setPaymentAmount('');
        setSelectedResidentId('');
        setPaymentAddSuccess(true);
        setTimeout(() => setPaymentAddSuccess(false), 3000);
        fetchData();
      } else {
        const err = await res.json();
        alert(t('Error') + ': ' + (err.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding payment:', error);
      alert(t('Error adding payment'));
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      syndicId,
      expenseType: formData.get('expenseType'),
      spender: formData.get('spender'),
      amount: Math.round(Number(formData.get('amount')) * 100) / 100,
      receiptNumber: formData.get('receiptNumber') || nextReceiptNumber,
      notes: formData.get('notes'),
      date: formData.get('date'),
      paymentType: formData.get('paymentType')
    };

    const res = await fetch('/api/syndic/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      setIsModalOpen(false);
      fetchData();
      setPaymentAddSuccess(true);
      setTimeout(() => setPaymentAddSuccess(false), 3000);
    } else {
      const err = await res.json();
      alert(t('Error') + ': ' + (err.error || 'Unknown error'));
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      syndicId,
      name: formData.get('name'),
      description: formData.get('description'),
      targetAmount: Math.round(Number(formData.get('targetAmount')) * 100) / 100,
      individualPayment: Math.round(Number(formData.get('individualPayment')) * 100) / 100,
      status: formData.get('status') || 'planned',
      endDate: formData.get('endDate') || null,
    };

    try {
      const res = await fetch('/api/syndic/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setIsProjectModalOpen(false);
        fetchData();
      } else {
        const errorData = await res.json();
        console.error('Failed to add project:', errorData);
        alert(t('Failed to add project. Please try again.'));
      }
    } catch (error) {
      console.error('Error adding project:', error);
      alert(t('An error occurred. Please try again.'));
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      name: formData.get('name'),
      description: formData.get('description'),
      targetAmount: Math.round(Number(formData.get('targetAmount')) * 100) / 100,
      individualPayment: Math.round(Number(formData.get('individualPayment')) * 100) / 100,
      status: formData.get('status'),
      endDate: formData.get('endDate') || null,
    };

    try {
      const res = await fetch(`/api/syndic/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setIsProjectModalOpen(false);
        setEditingProject(null);
        if (selectedProject?.id === editingProject.id) {
          setSelectedProject({
            ...selectedProject,
            name: String(data.name),
            description: String(data.description),
            target_amount: data.targetAmount,
            individual_payment: data.individualPayment,
            status: data.status as Project['status'],
            end_date: data.endDate as string | undefined,
          });
        }
        fetchData();
      } else {
        const errorData = await res.json();
        console.error('Failed to update project:', errorData);
        alert(t('Failed to update project. Please try again.'));
      }
    } catch (error) {
      console.error('Error updating project:', error);
      alert(t('An error occurred. Please try again.'));
    }
  };

   const handleDeleteProject = (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: t('Delete Project'),
      message: t('Are you sure you want to delete this project? All associated payments will also be deleted.'),
      onConfirm: async () => {
        const res = await fetch(`/api/syndic/projects/${id}`, { method: 'DELETE' });
        if (res.ok) {
          if (selectedProject?.id === id) setSelectedProject(null);
          fetchData();
        }
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddProjectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    const formData = new FormData(e.target as HTMLFormElement);
    
    const residentId = formData.get('residentId');
    let fullName = formData.get('fullName');
    let building = formData.get('building') || '';
    let apartment = formData.get('apartment');

    if (residentId) {
      const resident = residents.find(r => r.id === Number(residentId));
      if (resident) {
        fullName = resident.full_name;
        building = resident.building;
        apartment = resident.apartment;
      }
    }

    const data = {
      projectId: selectedProject.id,
      residentId: residentId ? Number(residentId) : null,
      syndicId,
      fullName,
      building,
      apartment,
      amount: Math.round(Number(formData.get('amount')) * 100) / 100,
      date: formData.get('date'),
      remainingBalance: -Math.round(Number(formData.get('remainingBalance')) * 100) / 100,
      receiptNumber: formData.get('receiptNumber'),
      paymentType: projectPaymentMethod,
    };

    const res = await fetch('/api/syndic/project-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      setIsProjectPaymentModalOpen(false);
      setProjectPaymentResidentId('');
      setProjectPaymentApartmentFilter('');
      setPaymentAddSuccess(true);
      setTimeout(() => setPaymentAddSuccess(false), 3000);
      fetchData();
    }
  };

  const handleUpdateProjectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectPayment) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      fullName: formData.get('fullName'),
      building: formData.get('building') !== null ? String(formData.get('building') || '') : String(editingProjectPayment.building || ''),
      apartment: formData.get('apartment'),
      amount: Math.round(Number(formData.get('amount')) * 100) / 100,
      date: formData.get('date'),
      remainingBalance: -Math.round(Number(formData.get('remainingBalance')) * 100) / 100,
      receiptNumber: formData.get('receiptNumber'),
      paymentType: projectPaymentMethod,
    };

    const res = await fetch(`/api/syndic/project-payments/${editingProjectPayment.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      setIsProjectPaymentModalOpen(false);
      setEditingProjectPayment(null);
      fetchData();
    }
  };

  const handleDeleteProjectPayment = (id: number) => {
    setConfirmConfig({
      isOpen: true,
      title: t('Delete Payment'),
      message: t('Are you sure you want to delete this payment?'),
      onConfirm: async () => {
        const res = await fetch(`/api/syndic/project-payments/${id}`, { method: 'DELETE' });
        if (res.ok) fetchData();
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

   const handleDeleteAllProjects = () => {
    setConfirmConfig({
      isOpen: true,
      title: t('Delete All Projects'),
      message: t('Are you sure you want to delete all projects? This action cannot be undone.'),
      onConfirm: async () => {
        const res = await fetch(`/api/syndic/projects/all/${syndicId}`, { method: 'DELETE' });
        if (res.ok) {
          setSelectedProject(null);
          fetchData();
        }
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteAllProjectPayments = () => {
    if (!selectedProject) return;
    setConfirmConfig({
      isOpen: true,
      title: t('Delete All Payments'),
      message: t('Are you sure you want to delete all payments for this project?'),
      onConfirm: async () => {
        const res = await fetch(`/api/syndic/project-payments/all/${selectedProject.id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchData();
        }
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handlePrintProjects = async () => {
    const title = t('Projects Report');
    const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(projectSearchFilter.toLowerCase()));

    const content = `
      <table>
        <thead>
          <tr>
            <th>${t('Project Name')}</th>
            <th>${t('Description')}</th>
            <th>${t('Target Amount')}</th>
            <th>${t('Total Payments')}</th>
            <th>${t('Remaining Amount')}</th>
            <th>${t('Status')}</th>
            <th>${t('Creation Date')}</th>
            <th>${t('End Date')}</th>
          </tr>
        </thead>
        <tbody>
          ${filteredProjects.map(p => {
            const projectTotalPaid = projectPayments.filter(pp => pp.project_id === p.id).reduce((sum, pp) => sum + pp.amount, 0);
            const projectRemaining = p.target_amount - projectTotalPaid;
            return `
              <tr>
                <td>${p.name}</td>
                <td>${p.description || '-'}</td>
                <td>${formatCurrency(p.target_amount, profile?.currency || 'DH')}</td>
                <td>${formatCurrency(projectTotalPaid, profile?.currency || 'DH')}</td>
                <td>${formatCurrency(projectRemaining, profile?.currency || 'DH')}</td>
                <td>${t(p.status)}</td>
                <td>${new Date(p.created_at).toLocaleDateString()}</td>
                <td>${p.end_date ? new Date(p.end_date).toLocaleDateString() : '-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    const html = getPrintTemplate(title, content);

    if (window.innerWidth <= 768) {
      try {
        await exportHtmlToPdf(html, `${title}.pdf`);
      } catch (error) {
        console.error('Error exporting PDF:', error);
      }
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const data = {
        residentId: selectedResidentId,
        amount: Math.round(Number(paymentAmount) * 100) / 100,
        date: paymentDate,
        receiptNumber: formData.get('receiptNumber'),
        paymentType,
        months: autoMonths,
        year: autoYear
      };

      const res = await fetch(`/api/syndic/payments/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingItem(null);
        setPaymentAmount('');
        setSelectedResidentId('');
        fetchData();
      } else {
        const err = await res.json();
        alert(t('Error') + ': ' + (err.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating payment:', error);
      alert(t('Error updating payment'));
    }
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      expenseType: formData.get('expenseType'),
      spender: formData.get('spender'),
      amount: Math.round(Number(formData.get('amount')) * 100) / 100,
      receiptNumber: formData.get('receiptNumber'),
      notes: formData.get('notes'),
      date: formData.get('date'),
      paymentType: formData.get('paymentType')
    };

    const res = await fetch(`/api/syndic/expenses/${editingItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      setIsModalOpen(false);
      setEditingItem(null);
      fetchData();
    } else {
      const err = await res.json();
      alert(t('Error') + ': ' + (err.error || 'Unknown error'));
    }
  };

  const handleRentalPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingRental) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const receiptNumber = formData.get('receiptNumber') as string || nextReceiptNumber;

    const amount = Math.round(Number(rentalPaymentAmount) * 100) / 100;
    if (isNaN(amount) || amount <= 0) return;

    const rentalPrice = Number(payingRental.rental_price || 0);
    const oldTotalPaid = Number(payingRental.total_paid || 0);
    const newTotalPaid = oldTotalPaid + amount;
    
    const oldMonthsCovered = rentalPrice > 0 ? Math.floor(oldTotalPaid / rentalPrice) : 0;
    const newMonthsCovered = rentalPrice > 0 ? Math.floor(newTotalPaid / rentalPrice) : 0;
    const monthsCovered = [];
    for (let i = oldMonthsCovered; i < newMonthsCovered; i++) {
      monthsCovered.push(i);
    }

    const res = await fetch('/api/syndic/rental-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rentalIncomeId: payingRental.id,
        syndicId,
        amount,
        date: rentalPaymentDate,
        receiptNumber,
        paymentType: rentalPaymentType,
        monthsCovered
      })
    });

    if (res.ok) {
      setPayingRental(null);
      setRentalPaymentAmount('');
      setRentalPaymentType('cash');
      setRentalPaymentDate(new Date().toISOString().split('T')[0]);
      if (rentalHistoryView) {
        fetchRentalPayments(rentalHistoryView.tenant_name, rentalHistoryView.property_type, selectedRentalYear);
      }
      fetchData();
    } else {
      const err = await res.json();
      alert(t('Error') + ': ' + (err.error || 'Unknown error'));
    }
  };

  useEffect(() => {
    if (rentalHistoryView) {
      fetchRentalPayments(rentalHistoryView.tenant_name, rentalHistoryView.property_type, selectedRentalYear);
    }
  }, [selectedRentalYear, rentalHistoryView]);

  const fetchRentalPayments = async (tenantName: string, propertyType: string, year: string = 'all') => {
    try {
      const res = await fetch(`/api/syndic/rental-payments/history?tenant_name=${encodeURIComponent(tenantName)}&property_type=${encodeURIComponent(propertyType)}&syndic_id=${syndicId}&year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setRentalPayments(data);
      }
    } catch (error) {
      console.error('Error fetching rental payments:', error);
    }
  };

  const handleDeleteRentalPayment = async (paymentId: number) => {
    try {
      const res = await fetch(`/api/syndic/rental-payments/${paymentId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (rentalHistoryView) {
          fetchRentalPayments(rentalHistoryView.tenant_name, rentalHistoryView.property_type, selectedRentalYear);
        }
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting rental payment:', error);
    }
  };

  const SelectionScreen = ({ 
    title, 
    options 
  }: { 
    title: string; 
    options: { label: string; icon: React.ReactNode; onClick: () => void; color: string }[] 
  }) => (
    <div className="flex flex-col items-center justify-center min-h-[500px] space-y-12 py-12 animate-in fade-in zoom-in duration-500">
      <h2 className="text-4xl font-extrabold text-gray-900 mb-4 text-center tracking-tight">{title}</h2>
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-6xl px-4">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={opt.onClick}
            className={`flex-1 flex flex-col items-center justify-center p-12 rounded-[3rem] bg-white border-2 border-transparent hover:border-${opt.color}-500 shadow-2xl hover:shadow-${opt.color}-500/20 transition-all duration-500 group relative overflow-hidden transform hover:-translate-y-2`}
          >
            <div className={`w-28 h-28 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 relative z-10`}>
              <div className={`text-${opt.color}-600 [&>svg]:w-12 [&>svg]:h-12`}>
                {opt.icon}
              </div>
            </div>
            <span className="text-3xl font-black text-gray-900 text-center relative z-10 tracking-tight">{opt.label}</span>
            <div className={`mt-4 px-6 py-2 rounded-full bg-${opt.color}-50 text-${opt.color}-600 text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
              {t('Select')}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderResidentDetails = () => {
    if (!viewingResident) return null;

    const residentPayments = (Array.isArray(payments) ? payments : []).filter(p => Number(p.resident_id) === Number(viewingResident.id));
    const residentProjectPayments = (Array.isArray(projectPayments) ? projectPayments : []).filter(p => Number((p as any).resident_id) === Number(viewingResident.id));

    const filteredPayments = residentPayments.filter(p => {
      if (!p.date) return true;
      const d = new Date(p.date);
      if (residentPaymentsYearFilter && d.getFullYear() !== Number(residentPaymentsYearFilter)) return false;
      if (residentPaymentsMonthFilter && (d.getMonth() + 1) !== Number(residentPaymentsMonthFilter)) return false;
      return true;
    });

    const filteredProjectPayments = residentProjectPayments.filter(p => {
      if (!p.date) return true;
      const d = new Date(p.date);
      if (residentProjectsYearFilter && d.getFullYear() !== Number(residentProjectsYearFilter)) return false;
      if (residentProjectsMonthFilter && (d.getMonth() + 1) !== Number(residentProjectsMonthFilter)) return false;
      return true;
    });

    const monthlyFee = profile?.membership_fee ?? 0;
    
    const totalPaid = Number(viewingResident.current_balance || 0) + residentPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const certYear = profile?.certified_year || new Date().getFullYear();
    const certMonth = profile?.certified_month || 1;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    let totalMonthsUntilCurrent = 0;
    if (currentYear > certYear) {
      totalMonthsUntilCurrent = (currentYear - certYear) * 12 + (currentMonth - certMonth + 1);
    } else if (currentYear === certYear) {
      totalMonthsUntilCurrent = Math.max(0, currentMonth - certMonth + 1);
    }
    
    const totalRequiredUntilCurrent = totalMonthsUntilCurrent * monthlyFee;
    const balanceAtCurrent = totalPaid - totalRequiredUntilCurrent;
    const unpaidAmount = balanceAtCurrent < 0 ? Math.abs(balanceAtCurrent) : 0;

    const years = [];
    for (let y = certYear; y <= currentYear; y++) {
      years.push(y);
    }

    const allStatusMonths = [];
    for (let y = certYear; y <= currentYear; y++) {
      const startMonth = (y === certYear) ? certMonth : 1;
      const endMonth = (y === currentYear) ? currentMonth : 12;
      for (let m = startMonth; m <= endMonth; m++) {
        allStatusMonths.push({ year: y, month: m });
      }
    }

    const filteredStatusMonths = allStatusMonths.filter(item => {
      if (residentStatusYearFilter && item.year !== Number(residentStatusYearFilter)) return false;
      if (residentStatusMonthFilter && item.month !== Number(residentStatusMonthFilter)) return false;
      return true;
    }).reverse();

    return (
      <div id="resident-details-view" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <UserCircle className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{viewingResident.full_name}</h2>
              <p className="text-gray-500 text-sm">
                {viewingResident.building ? `${t('Building')} ${viewingResident.building} - ` : ''}
                {t('Apartment')} {viewingResident.apartment}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setViewingResident(null)} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t('Back')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-gray-200 px-4 overflow-x-auto bg-white rounded-t-3xl pt-4">
          <TabButton active={residentDetailsTab === 'general'} onClick={() => setResidentDetailsTab('general')}>
            {t('General Information')}
          </TabButton>
          <TabButton active={residentDetailsTab === 'payments'} onClick={() => setResidentDetailsTab('payments')}>
            {t('Payments')}
          </TabButton>
          <TabButton active={residentDetailsTab === 'status'} onClick={() => setResidentDetailsTab('status')}>
            {t('Payment Status')}
          </TabButton>
          <TabButton active={residentDetailsTab === 'projects'} onClick={() => setResidentDetailsTab('projects')}>
            {t('Projects')}
          </TabButton>
        </div>

        <div className="bg-white p-6 rounded-b-3xl shadow-sm border border-gray-100 min-h-[400px]">
          {residentDetailsTab === 'general' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('Full Name')}</p>
                  <p className="text-gray-900 font-medium">{viewingResident.full_name}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('Phone')}</p>
                  <p className="text-gray-900 font-medium" dir="ltr">{viewingResident.phone}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('Email')}</p>
                  <p className="text-gray-900 font-medium">{viewingResident.email || '-'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('Property Number')}</p>
                  <p className="text-gray-900 font-medium">{viewingResident.property_number || '-'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('Join Date')}</p>
                  <p className="text-gray-900 font-medium">{viewingResident.joining_date || '-'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('Status')}</p>
                  <p className="text-gray-900 font-medium">{viewingResident.occupancy_type === 'owner' ? t('Owner') : t('Tenant')}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-xs text-blue-500 uppercase font-bold tracking-wider mb-1">{t('Current Balance')}</p>
                  <p className={`text-xl font-bold ${viewingResident.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(viewingResident.current_balance, profile?.currency || 'DH')}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-gray-100">
                <Button variant="secondary" onClick={() => {
                  window.print();
                }} className="flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  {t('Print')}
                </Button>
                <Button 
                  onClick={() => {
                    if (unpaidAmount > 0) {
                      alert(t('Please pay the syndic dues to print the certificate'));
                    } else {
                      setPrintingCertificate(viewingResident);
                    }
                  }} 
                  className={`${unpaidAmount > 0 ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-green-600 hover:bg-green-700 shadow-green-200'} text-white flex items-center gap-2 px-6 py-2 rounded-xl transition-all shadow-lg`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {t('Certificate of No Dues')}
                </Button>
              </div>
            </div>
          )}

          {residentDetailsTab === 'payments' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Filter by Year')}</label>
                  <Input 
                    type="number"
                    placeholder={t('Year')}
                    value={residentPaymentsYearFilter}
                    onChange={(e) => setResidentPaymentsYearFilter(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Filter by Month')}</label>
                  <Input 
                    type="number"
                    min="1"
                    max="12"
                    placeholder={t('Month')}
                    value={residentPaymentsMonthFilter}
                    onChange={(e) => setResidentPaymentsMonthFilter(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className={`w-full ${isRtl ? 'text-right' : 'text-left'}`}>
                  <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-bold">
                    <tr>
                      <th className="p-3 border-b">{t('Date')}</th>
                      <th className="p-3 border-b">{t('Receipt Number')}</th>
                      <th className="p-3 border-b">{t('Payment Type')}</th>
                      <th className="p-3 border-b">{t('Amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPayments.length > 0 ? filteredPayments.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3 text-sm">{p.date}</td>
                        <td className="p-3 text-sm">{p.receipt_number}</td>
                        <td className="p-3 text-sm">{t(p.payment_type || 'cash')}</td>
                        <td className="p-3 text-sm font-bold text-blue-600">{formatCurrency(p.amount, profile?.currency || 'DH')}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500 italic">{t('No payments found')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {residentDetailsTab === 'status' && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <h3 className="text-lg font-bold text-blue-900 mb-4">{t('Payment Status Summary')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-4 rounded-xl shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">{t('Total Paid')}</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(residentPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0), profile?.currency || 'DH')}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">{t('Current Balance')}</p>
                    <p className={`text-xl font-bold ${viewingResident.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(viewingResident.current_balance, profile?.currency || 'DH')}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">{t('Unpaid Amounts')}</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(unpaidAmount, profile?.currency || 'DH')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Filter by Year')}</label>
                  <Input 
                    type="number"
                    placeholder={t('Year')}
                    value={residentStatusYearFilter}
                    onChange={(e) => setResidentStatusYearFilter(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Filter by Month')}</label>
                  <Input 
                    type="number"
                    min="1"
                    max="12"
                    placeholder={t('Month')}
                    value={residentStatusMonthFilter}
                    onChange={(e) => setResidentStatusMonthFilter(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className={`w-full ${isRtl ? 'text-right' : 'text-left'}`}>
                  <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-bold">
                    <tr>
                      <th className="p-3 border-b">{t('Month')}</th>
                      <th className="p-3 border-b">{t('Status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStatusMonths.map((item, i) => {
                      const monthIndexFromStart = (item.year - certYear) * 12 + (item.month - certMonth);
                      const monthsCovered = monthlyFee > 0 ? Math.floor(totalPaid / monthlyFee) : 0;
                      const isPaid = monthIndexFromStart < monthsCovered;

                      return (
                        <tr key={`${item.year}-${item.month}`} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-sm font-medium">{displayMonths[item.month - 1]} {item.year}</td>
                          <td className="p-3">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {isPaid ? t('Paid') : t('Unpaid')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStatusMonths.length === 0 && (
                      <tr>
                        <td colSpan={2} className="p-8 text-center text-gray-500 italic">{t('No data found')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {residentDetailsTab === 'projects' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Filter by Year')}</label>
                  <Input 
                    type="number"
                    placeholder={t('Year')}
                    value={residentProjectsYearFilter}
                    onChange={(e) => setResidentProjectsYearFilter(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Filter by Month')}</label>
                  <Input 
                    type="number"
                    min="1"
                    max="12"
                    placeholder={t('Month')}
                    value={residentProjectsMonthFilter}
                    onChange={(e) => setResidentProjectsMonthFilter(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className={`w-full ${isRtl ? 'text-right' : 'text-left'}`}>
                  <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-bold">
                    <tr>
                      <th className="p-3 border-b">{t('Project')}</th>
                      <th className="p-3 border-b">{t('Project Description')}</th>
                      <th className="p-3 border-b">{t('Receipt Number')}</th>
                      <th className="p-3 border-b">{t('Date')}</th>
                      <th className="p-3 border-b">{t('Amount')}</th>
                      <th className="p-3 border-b">{t('Remaining')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProjectPayments.length > 0 ? filteredProjectPayments.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3 text-sm">{(p as any).project_name || t('Project')}</td>
                        <td className="p-3 text-sm text-gray-500">{(p as any).project_description || '-'}</td>
                        <td className="p-3 text-sm">{p.receipt_number || '-'}</td>
                        <td className="p-3 text-sm">{p.date}</td>
                        <td className="p-3 text-sm font-bold text-blue-600">{formatCurrency(p.amount, profile?.currency || 'DH')}</td>
                        <td className="p-3 text-sm text-red-600">{formatCurrency((p as any).remaining_balance || 0, profile?.currency || 'DH')}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500 italic">{t('No project payments found')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const sidebarItems = [
    { icon: <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} />, label: t('Dashboard'), onClick: () => { setActiveTab('dashboard'); setViewingResident(null); }, isActive: activeTab === 'dashboard' },
    { icon: <Building2 className="w-4 h-4" strokeWidth={1.5} />, label: t('Residential Apartments'), onClick: () => { setActiveTab('residents'); setViewingResident(null); }, isActive: activeTab === 'residents' },
    { 
      icon: <DollarSign className="w-4 h-4" strokeWidth={1.5} />, 
      label: t('Payments'), 
      onClick: () => { setActiveTab('payments'); setPaymentSubTab('residents'); setViewingResident(null); },
      isActive: activeTab === 'payments'
    },
    { 
      icon: <BarChart3 className="w-4 h-4" strokeWidth={1.5} />, 
      label: t('Payment Status'), 
      onClick: () => { setActiveTab('reports'); setSelectedReport('residents'); setViewingResident(null); }, 
      isActive: activeTab === 'reports' 
    },
    { 
      icon: <DollarSign className="w-4 h-4" strokeWidth={1.5} />, 
      label: t('Other Incomes'), 
      onClick: () => { setActiveTab('other_incomes'); setOtherIncomeSubTab('rental'); setViewingResident(null); },
      isActive: activeTab === 'other_incomes'
    },
    { icon: <Settings className="w-4 h-4" strokeWidth={1.5} />, label: t('Expenses'), onClick: () => { setActiveTab('expenses'); setViewingResident(null); }, isActive: activeTab === 'expenses' },
    { 
      icon: <Landmark className="w-4 h-4" strokeWidth={1.5} />, 
      label: t('Financial Management'), 
      onClick: () => { setActiveTab('financial'); setFinancialSubTab('bank'); setViewingResident(null); },
      isActive: activeTab === 'financial'
    },
    { 
      icon: <Bell className="w-4 h-4" strokeWidth={1.5} />, 
      label: t('Announcements and Complaints'), 
      onClick: () => { setActiveTab('notifications_center'); setNotificationsSubTab('announcements'); setViewingResident(null); }, 
      isActive: activeTab === 'notifications_center' 
    },
    { icon: <Briefcase className="w-4 h-4" strokeWidth={1.5} />, label: t('Projects'), onClick: () => { setActiveTab('projects'); setViewingResident(null); }, isActive: activeTab === 'projects' },
    { icon: <Settings className="w-4 h-4" strokeWidth={1.5} />, label: t('Settings'), onClick: () => { setActiveTab('initial_balance'); setViewingResident(null); }, isActive: activeTab === 'initial_balance' },
    { icon: <UserCircle className="w-4 h-4" strokeWidth={1.5} />, label: t('My Account'), onClick: () => { setActiveTab('profile'); setViewingResident(null); }, isActive: activeTab === 'profile' },
  ].filter(item => {
    if (item.label === t('Residential Apartments') && !localShowApartments) return false;
    return true;
  });

  const handleUpdateRentalPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRentalPayment) return;

    try {
      const response = await fetch(`/api/syndic/rental-payments/${editingRentalPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(rentalPaymentAmount),
          date: rentalPaymentDate,
          payment_type: rentalPaymentType
        }),
      });

      if (response.ok) {
        setEditingRentalPayment(null);
        if (rentalHistoryView) {
          fetchRentalPayments(rentalHistoryView.tenant_name, rentalHistoryView.property_type, selectedRentalYear);
        }
        fetchData();
      }
    } catch (error) {
      console.error('Error updating rental payment:', error);
    }
  };

  const renderTableActions = (item: any) => (
    <div className="flex gap-2">
      {item.isPayment ? (
        <span className="text-[10px] text-gray-400 italic px-2 py-1 bg-gray-50 rounded-full border border-gray-100">
          {t('Payment')}
        </span>
      ) : item.is_linked ? (
        <span className="text-[10px] text-blue-500 italic px-2 py-1 bg-blue-50 rounded-full border border-blue-100">
          {t('Automatic')}
        </span>
      ) : (
        <>
          {(activeTab === 'payments' || (activeTab === 'other_incomes' && otherIncomeSubTab === 'other')) && (
        <button 
          onClick={() => {
            if (activeTab === 'payments') {
              setDirectPrintPayment({
                ...item,
                current_balance: calculateBalanceAtDate(item.resident_id, item.date)
              });
            } else {
              setDirectPrintOtherIncome(item);
            }
          }}
          className="p-1 text-green-600 hover:bg-green-50 rounded"
          title={t('Print')}
        >
          <Printer className="w-4 h-4" />
        </button>
      )}
      {activeTab === 'other_incomes' && otherIncomeSubTab === 'rental' && (
        <button 
          onClick={() => { setRentalHistoryView(item); fetchRentalPayments(item.tenant_name, item.property_type, selectedRentalYear); }}
          className="p-1 text-purple-600 hover:bg-purple-50 rounded"
          title={t('History')}
        >
          <History className="w-4 h-4" />
        </button>
      )}
      <button 
        onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
        title={t('Edit')}
      >
        <Edit2 className="w-4 h-4" />
      </button>
      {!(activeTab === 'other_incomes' && otherIncomeSubTab === 'rental' && item.id < 0) && (
        <button 
          onClick={() => handleDeleteResident(item.id)}
          className="p-1 text-red-600 hover:bg-red-50 rounded"
          title={t('Delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
        </>
      )}
    </div>
  );

  const getActiveTitle = () => {
    switch (activeTab) {
      case 'dashboard': return t('Dashboard');
      case 'residents': return t('Residential Apartments');
      case 'payments': 
        if (paymentSubTab === 'residents') return t('Residential Apartments');
        return t('Payments');
      case 'reports': 
        if (selectedReport === 'residents') return `${t('Payment Status')} - ${t('Residential Apartments')}`;
        return t('Payment Status');
      case 'other_incomes': return otherIncomeSubTab === 'rental' ? t('Rental Incomes') : t('Other Incomes');
      case 'expenses': return t('Expenses');
      case 'initial_balance': return t('Settings');
      case 'financial': return financialSubTab === 'bank' ? t('Bank Management') : t('Cash Box Management');
      case 'complaints': return t('Announcements and Complaints');
      case 'notifications_center': return t('Announcements and Complaints');
      case 'projects': return t('Projects');
      case 'notifications': return t('Notifications');
      case 'profile': return t('My Account');
      default: return t('Syndic Dashboard');
    }
  };



  const handleTabChange = (tab: string) => {
    setPrevTab(activeTab);
    setActiveTab(tab);
  };

  const handleBack = () => {
    if (viewingResident) {
      setViewingResident(null);
      return;
    }
    if (activeTab === 'reports' && selectedReport) {
      setSelectedReport(null);
      return;
    }
    if (activeTab === 'payments' && paymentSubTab) {
      setPaymentSubTab(null);
      return;
    }
    if (activeTab === 'other_incomes' && otherIncomeSubTab) {
      setOtherIncomeSubTab(null);
      return;
    }
    if (activeTab === 'financial' && financialSubTab) {
      setFinancialSubTab(null);
      return;
    }

    if (prevTab) {
      setActiveTab(prevTab);
      setPrevTab(null);
    } else {
      setActiveTab('dashboard');
    }
  };

  const unpaidResidents = useMemo(() => {
    if (!profile || !residents || !payments) return [];
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    return residents.filter(r => {
      const monthlyFee = profile.membership_fee ?? 0;
        
      const certYear = profile.certified_year || currentYear;
      const certMonth = profile.certified_month || 1;

      const totalPaid = Number(r.current_balance || 0) + payments
        .filter(c => Number(c.resident_id) === Number(r.id))
        .reduce((sum, c) => sum + Number(c.amount || 0), 0);

      let totalMonthsUntilCurrentMonth = 0;
      if (currentYear > certYear) {
        totalMonthsUntilCurrentMonth = (currentYear - certYear) * 12 + (currentMonth - certMonth + 1);
      } else if (currentYear === certYear) {
        totalMonthsUntilCurrentMonth = Math.max(0, currentMonth - certMonth + 1);
      }
      
      const totalRequiredUntilCurrentMonth = totalMonthsUntilCurrentMonth * monthlyFee;
      const balanceAtCurrentMonth = totalPaid - totalRequiredUntilCurrentMonth;

      return balanceAtCurrentMonth < 0;
    }).map(r => {
      const monthlyFee = profile.membership_fee ?? 0;
        
      const certYear = profile.certified_year || currentYear;
      const certMonth = profile.certified_month || 1;

      const totalPaid = Number(r.current_balance || 0) + payments
        .filter(c => Number(c.resident_id) === Number(r.id))
        .reduce((sum, c) => sum + Number(c.amount || 0), 0);

      let totalMonthsUntilCurrentMonth = 0;
      if (currentYear > certYear) {
        totalMonthsUntilCurrentMonth = (currentYear - certYear) * 12 + (currentMonth - certMonth + 1);
      } else if (currentYear === certYear) {
        totalMonthsUntilCurrentMonth = Math.max(0, currentMonth - certMonth + 1);
      }
      
      const totalRequiredUntilCurrentMonth = totalMonthsUntilCurrentMonth * monthlyFee;
      const balanceAtCurrentMonth = totalPaid - totalRequiredUntilCurrentMonth;

      return {
        ...r,
        balance: balanceAtCurrentMonth
      };
    });
  }, [residents, payments, profile]);

  return (
    <>
      <DashboardLayout 
        title={
          <div className="flex items-center gap-4">
            {activeTab !== 'dashboard' && (
              <button 
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
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
            if (item.onClick) {
              setPrevTab(activeTab);
              item.onClick();
            }
          }
        }))}
        onNotificationClick={() => {
          setActiveTab('notifications_center');
          setNotificationsSubTab('announcements');
        }}
        onProfileClick={() => setActiveTab('profile')}
        onLogoClick={() => setActiveTab('dashboard')}
        headerContent={
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => handlePrintInterface()} className="hidden md:flex items-center gap-2">
              <Printer className="w-4 h-4" />
              {t('Print Dashboard')}
            </Button>
          </div>
        }
      >
        <div id="main-content-to-print" className="space-y-6">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportExcel} 
            className="hidden" 
            accept=".xlsx, .xls"
          />

          {viewingResident ? renderResidentDetails() : (
            <>
              {activeTab === 'dashboard' && dashboardStats && (
            <div className="space-y-6">
              {/* Advanced Filtering */}
              <div className="flex justify-end gap-3 mb-2 relative z-10">
                <Button 
                  variant="secondary" 
                  onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)} 
                  className="md:hidden w-10 h-10 p-0 rounded-full flex items-center justify-center" 
                  title={t('Filters')}
                >
                  <MoreVertical className="w-5 h-5" />
                </Button>
                <div className={`${isMobileFiltersOpen ? 'flex' : 'hidden md:flex'} gap-3 flex-wrap`}>
                  <select 
                    className="p-1.5 text-sm border border-gray-200 rounded-lg bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={dashboardYearFilter}
                    onChange={(e) => setDashboardYearFilter(e.target.value)}
                  >
                    <option value="">{t('All Years')}</option>
                    {[...Array(10)].map((_, i) => {
                      const year = new Date().getFullYear() - i;
                      return <option key={year} value={year}>{year}</option>;
                    })}
                  </select>
                  <select 
                    className="p-1.5 text-sm border border-gray-200 rounded-lg bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={dashboardMonthFilter}
                    onChange={(e) => setDashboardMonthFilter(e.target.value)}
                  >
                    <option value="">{t('All Months')}</option>
                    {displayMonths.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bank & Cashbox Balance Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">{t('Financial Overview')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-sm text-blue-600 mb-1">{t('Bank Balance')}</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {formatCurrency(dashboardStats.totals.bankBalance || 0, profile?.currency || 'DH')}
                    </p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-sm text-emerald-600 mb-1">{t('Cash Box Balance')}</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      {formatCurrency(dashboardStats.totals.cashboxBalance || 0, profile?.currency || 'DH')}
                    </p>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-sm text-indigo-600 mb-1">{t('Total Balance (Bank+Cash)')}</p>
                    <p className={`text-2xl font-bold ${(dashboardStats.totals.bankBalance || 0) + (dashboardStats.totals.cashboxBalance || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatCurrency((dashboardStats.totals.bankBalance || 0) + (dashboardStats.totals.cashboxBalance || 0), profile?.currency || 'DH')}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  <div className="p-4 rounded-2xl border border-[#E0CFE0]" style={{ backgroundColor: '#F0DFF0' }}>
                    <p className="text-sm text-slate-600 mb-1">{t('Total Expenses')}</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(dashboardStats.totals.expenses || 0, profile?.currency || 'DH')}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl border border-yellow-100" style={{ backgroundColor: '#FFF0BC' }}>
                    <p className="text-sm text-slate-600 mb-1">{t('Total Income')}</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(dashboardStats.totals.income || 0, profile?.currency || 'DH')}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl border border-amber-100" style={{ backgroundColor: '#FFEFEB' }}>
                    <p className="text-sm mb-1" style={{ color: '#C92E06' }}>{t('Total Uncollected Amounts')}</p>
                    <p className="text-2xl font-bold" style={{ color: '#C92E06' }}>
                      {formatCurrency(dashboardStats.totals.overdueAmount || 0, profile?.currency || 'DH')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Balance Sheet Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {t('Balance Sheet')}
                    <button 
                      onMouseEnter={() => setIsBalanceInfoModalOpen(true)}
                      onMouseLeave={() => setIsBalanceInfoModalOpen(false)}
                      className="text-blue-500 hover:text-blue-700 transition-colors cursor-pointer relative group"
                      title={t('Information')}
                    >
                      <Info size={18} />
                      {/* Hover Tooltip/Popup */}
                      {isBalanceInfoModalOpen && (
                        <div 
                          className="absolute bottom-full mb-2 z-[100] w-80 md:w-96 p-5 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-blue-100 text-right pointer-events-none"
                          dir={isRtl ? 'rtl' : 'ltr'}
                        >
                          <div className="space-y-4">
                            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                              <p className="font-bold text-blue-900 mb-2">{t('Balance Formula')}</p>
                              <p className="text-xs text-blue-800">{t('Actif Formula')}</p>
                              <p className="text-xs text-blue-800">{t('Passif Formula')}</p>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="flex gap-3 items-start">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                <p className="text-xs text-gray-700 leading-relaxed">{t('Balance Zero')}</p>
                              </div>
                              
                              <div className="flex gap-3 items-start">
                                <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                <p className="text-xs text-gray-700 leading-relaxed">{t('Balance Positive')}</p>
                              </div>
                              
                              <div className="flex gap-3 items-start">
                                <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                                <p className="text-xs text-gray-700 leading-relaxed">{t('Balance Negative')}</p>
                              </div>
                            </div>
                          </div>
                          {/* Triangle pointer */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white" />
                        </div>
                      )}
                    </button>
                  </h3>
                  {(() => {
                    const totalBalance = (dashboardStats.totals.bankBalance || 0) + (dashboardStats.totals.cashboxBalance || 0);
                    const actif = totalBalance;
                    const passif = (profile?.initial_bank_balance || 0) + (profile?.initial_cashbox_balance || 0) + (dashboardStats.totals.income || 0) - (dashboardStats.totals.expenses || 0);
                    const balance = actif - passif;
                    return balance === 0 ? (
                      <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        {t('Balance 0 means accounts are accurate')}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
                        {t('Please review accounts, for accounts to be accurate the balance must be 0')}
                      </span>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-sm text-emerald-600 mb-1">{t('Actif')}</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      {formatCurrency((dashboardStats.totals.bankBalance || 0) + (dashboardStats.totals.cashboxBalance || 0), profile?.currency || 'DH')}
                    </p>
                  </div>
                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                    <p className="text-sm text-rose-600 mb-1">{t('Passif')}</p>
                    <p className="text-2xl font-bold text-rose-900">
                      {formatCurrency(
                        (profile?.initial_bank_balance || 0) + (profile?.initial_cashbox_balance || 0) + (dashboardStats.totals.income || 0) - (dashboardStats.totals.expenses || 0), 
                        profile?.currency || 'DH'
                      )}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-sm text-blue-600 mb-1">{t('Balance')}</p>
                    <p className={`text-2xl font-bold ${
                      ((dashboardStats.totals.bankBalance || 0) + (dashboardStats.totals.cashboxBalance || 0)) - 
                      ((profile?.initial_bank_balance || 0) + (profile?.initial_cashbox_balance || 0) + (dashboardStats.totals.income || 0) - (dashboardStats.totals.expenses || 0)) >= 0 ? 'text-blue-900' : 'text-red-600'
                    }`}>
                      {formatCurrency(
                        ((dashboardStats.totals.bankBalance || 0) + (dashboardStats.totals.cashboxBalance || 0)) - 
                        ((profile?.initial_bank_balance || 0) + (profile?.initial_cashbox_balance || 0) + (dashboardStats.totals.income || 0) - (dashboardStats.totals.expenses || 0)), 
                        profile?.currency || 'DH'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Property Summaries */}
              <div className="grid grid-cols-1 gap-6">
                {/* Apartments */}
                {localShowApartments && (
                <div className="relative overflow-hidden bg-gradient-to-br from-[#e6f4ff] to-[#f0f9ff] p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 backdrop-blur-md">
                  {/* Smooth abstract rounded shape in the top right corner */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-bl from-blue-300/30 to-sky-200/10 rounded-full blur-xl"></div>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-200/40 to-transparent rounded-bl-[64px]"></div>
                  
                  {/* Subtle glowing bokeh circles */}
                  <div className="absolute bottom-10 -left-10 w-32 h-32 bg-blue-200/30 rounded-full blur-2xl"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-sky-100/40 rounded-full blur-xl"></div>

                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <Building2 className="w-6 h-6 text-blue-600" />
                      <h3 className="text-lg font-bold text-slate-800">{t('Residential Apartments')}</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-slate-600">{t('Total Income')}</span>
                        <span className="font-bold text-blue-700">{formatCurrency(dashboardStats.totals.apartmentIncome || 0, profile?.currency || 'DH')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sky-600">{t('Paying')}</span>
                        <span className="font-bold text-sky-600">{dashboardStats.payerStatus.apartments.payers}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-rose-500">{t('Non-Paying')}</span>
                        <span className="font-bold text-rose-500">{dashboardStats.payerStatus.apartments.nonPayers}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-blue-200/50 pt-3 mt-3">
                        <span className="text-slate-500">{t('Total Apartments')}</span>
                        <span className="font-bold text-slate-800">{dashboardStats.counts.residents_count || 0}</span>
                      </div>

                      {/* Compact Payment Status */}
                      <div className="mt-3 pt-3 border-t border-dashed border-blue-200/50">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] text-slate-500 leading-tight">
                            <span className="text-sm font-bold text-slate-800 block">
                              {Math.round((dashboardStats.payerStatus.apartments.payers / ((dashboardStats.payerStatus.apartments.payers + dashboardStats.payerStatus.apartments.nonPayers) || 1)) * 100)}%
                            </span>
                            {t('Collection Rate')}
                          </div>
                          <div className="h-[40px] w-[40px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: t('Paying'), value: dashboardStats.payerStatus.apartments.payers, fill: '#0284c7' },
                                    { name: t('Non-Paying'), value: dashboardStats.payerStatus.apartments.nonPayers, fill: '#f43f5e' }
                                  ]}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={12}
                                  outerRadius={18}
                                  paddingAngle={2}
                                  dataKey="value"
                                  stroke="none"
                                >
                                  <Cell fill="#0284c7" />
                                  <Cell fill="#f43f5e" />
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] mt-1">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#0284c7]"></div>
                            <span className="text-slate-600">{t('Paying')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#f43f5e]"></div>
                            <span className="text-slate-600">{t('Non-Paying')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>

              {/* Project Summaries */}
              {projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">{t('Active Projects')}</h3>
                  {(() => {
                    const activeProjects = projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled');
                    return (
                      <div className={`grid grid-cols-1 ${
                        activeProjects.length === 1 ? '' : 
                        activeProjects.length === 2 ? 'md:grid-cols-2' : 
                        'md:grid-cols-2 lg:grid-cols-3'
                      } gap-6`}>
                        {activeProjects.map(project => {
                          const payments = projectPayments.filter(pp => pp.project_id === project.id);
                          const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
                          const remaining = project.target_amount - totalPaid;
                          const payerIds = new Set(payments.filter(p => p.resident_id).map(p => p.resident_id));
                          const payersCount = payerIds.size;
                          const nonPayersCount = Math.max(0, residents.length - payersCount);
                          const collectionRate = Math.round((totalPaid / (project.target_amount || 1)) * 100);
                          
                          return (
                            <div key={project.id} className="relative overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 backdrop-blur-md">
                              <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-bl from-indigo-300/30 to-purple-200/10 rounded-full blur-xl"></div>
                              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-200/40 to-transparent rounded-bl-[64px]"></div>
                              
                              <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                  <Target className="w-6 h-6 text-indigo-600" />
                                  <h3 className="text-lg font-bold text-slate-800 truncate" title={project.name}>{project.name}</h3>
                                </div>
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-slate-600">{t('Target Amount')}</span>
                                    <span className="font-bold text-indigo-700">{formatCurrency(project.target_amount, profile?.currency || 'DH')}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-slate-600">{t('Total Payments')}</span>
                                    <span className="font-bold text-emerald-600">{formatCurrency(totalPaid, profile?.currency || 'DH')}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-rose-500">{t('Remaining')}</span>
                                    <span className="font-bold text-rose-500">{formatCurrency(remaining, profile?.currency || 'DH')}</span>
                                  </div>
                                  <div className="flex justify-between items-center border-t border-indigo-200/50 pt-3 mt-3">
                                    <span className="text-slate-500">{t('Status')}</span>
                                    <span className="font-bold text-slate-800 uppercase text-xs">{t(project.status)}</span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-dashed border-indigo-200/50">
                                    <div>
                                      <span className="text-[10px] text-slate-500 block uppercase tracking-wider">{t('Payers')}</span>
                                      <span className="text-sm font-bold text-emerald-600">{payersCount}</span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-slate-500 block uppercase tracking-wider">{t('Non-Payers')}</span>
                                      <span className="text-sm font-bold text-rose-500">{nonPayersCount}</span>
                                    </div>
                                  </div>

                                  {/* Collection Rate */}
                                  <div className="mt-3 pt-3 border-t border-dashed border-indigo-200/50">
                                    <div className="flex items-center justify-between">
                                      <div className="text-[10px] text-slate-500 leading-tight">
                                        <span className="text-sm font-bold text-slate-800 block">
                                          {collectionRate}%
                                        </span>
                                        {t('Collection Percentage')}
                                      </div>
                                      <div className="h-[40px] w-[40px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                          <PieChart>
                                            <Pie
                                              data={[
                                                { name: t('Paid'), value: totalPaid, fill: '#4f46e5' },
                                                { name: t('Remaining'), value: Math.max(0, remaining), fill: '#e2e8f0' }
                                              ]}
                                              cx="50%"
                                              cy="50%"
                                              innerRadius={12}
                                              outerRadius={18}
                                              paddingAngle={2}
                                              dataKey="value"
                                              stroke="none"
                                            >
                                              <Cell fill="#4f46e5" />
                                              <Cell fill="#e2e8f0" />
                                            </Pie>
                                          </PieChart>
                                        </ResponsiveContainer>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

          <div className="grid grid-cols-1 gap-6">
            {/* Income vs Expenses Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-slate-900 mb-6">{t('Income vs Expenses')}</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardStats.monthly.income.map((item: any, index: number) => ({
                    name: `${item.month}/${item.year}`,
                    income: item.total,
                    expenses: dashboardStats.monthly.expenses[index]?.total || 0
                  })).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="circle" 
                      wrapperStyle={{ paddingBottom: '20px' }}
                      formatter={(value: string) => <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 500 }}>{value}</span>}
                    />
                    <Bar dataKey="income" name={t('Income')} fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name={t('Expenses')} fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Income vs Expenses Trend LineChart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-slate-900 mb-6">{t('Income vs Expenses Trend')}</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardStats.monthly.income.map((item: any, index: number) => ({
                    name: `${item.month}/${item.year}`,
                    income: item.total,
                    expenses: dashboardStats.monthly.expenses[index]?.total || 0
                  })).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="circle" 
                      wrapperStyle={{ paddingBottom: '20px' }}
                      formatter={(value: string) => <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 500 }}>{value}</span>}
                    />
                    <Line type="monotone" dataKey="income" name={t('Income')} stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="expenses" name={t('Expenses')} stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="mb-6 flex flex-row flex-wrap gap-4 items-center justify-center md:justify-between">
        {activeTab === 'residents' && (
          <>
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Button variant="dark" onClick={() => setIsModalOpen(true)} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Add Member')}>
                <Plus className="w-5 h-5" />
              </Button>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Import')}>
                <Download className="w-5 h-5" />
              </Button>
              <Button variant="secondary" onClick={handleExportExcel} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Export')}>
                <Upload className="w-5 h-5" />
              </Button>
              <Button variant="secondary" onClick={handlePrintResidents} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Print')}>
                <Printer className="w-5 h-5" />
              </Button>
              <Button variant="secondary" className="w-10 h-10 p-0 rounded-full flex items-center justify-center text-red-600 border-red-100 hover:bg-red-50" onClick={handleDeleteAll} title={t('Delete All')}>
                <Trash2 className="w-5 h-5" />
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)} 
                className="md:hidden w-10 h-10 p-0 rounded-full flex items-center justify-center" 
                title={t('Filters')}
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </div>
            
            <div className={`${isMobileFiltersOpen ? 'flex' : 'hidden md:flex'} items-center justify-center md:justify-start gap-2 flex-wrap w-full md:w-auto`}>
              <Input 
                className="w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-10 text-center placeholder-blue-400 text-blue-900"
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
                placeholder={t('Building')}
              />
              <Input 
                className="w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-10 text-center placeholder-blue-400 text-blue-900"
                value={apartmentFilter}
                onChange={(e) => setApartmentFilter(e.target.value)}
                placeholder={t('Apartment')}
              />
            </div>
          </>
        )}
      </div>

      {activeTab === 'residents' && (
        <div className="space-y-6">
          {residentAddSuccess && (
            <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">
                {t('Resident added successfully!')}
              </span>
            </div>
          )}
          {importSummary && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-4 rounded-xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm font-bold">{t('Import completed successfully!')}</span>
              </div>
              <div className="space-y-1 text-sm">
                <p>{t('Successfully imported: {{count}}', { count: importSummary.successCount })}</p>
                <p className={importSummary.failCount > 0 ? 'text-red-600 font-medium' : ''}>
                  {t('Skipped/Failed: {{count}}', { count: importSummary.failCount })}
                </p>
                {importSummary.reasons.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-blue-100">
                    <p className="text-xs font-bold mb-1 uppercase tracking-wider opacity-70">{t('Reasons for skipping:')}</p>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      {importSummary.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="bg-sky-50 rounded-2xl shadow-sm border border-sky-100 overflow-x-auto">
          <table className={`w-full ${isRtl ? 'text-right' : 'text-left'}`}>
            <thead className="bg-sky-100 text-gray-900 text-base font-black uppercase tracking-wider">
              <tr>
                <th className="p-3 border-b border-sky-200">{t('Full Name')}</th>
                <th className="p-3 border-b border-sky-200">
                  {t('Apartment')}
                </th>
                <th className="p-3 border-b border-sky-200">{t('Property Number')}</th>
                <th className="p-3 border-b border-sky-200">{t('Join Date')}</th>
                <th className="p-3 border-b border-sky-200">{t('Phone')}</th>
                <th className="p-3 border-b border-sky-200">{t('Email')}</th>
                <th className="p-3 border-b border-sky-200">{t('Password')}</th>
                <th className="p-3 border-b border-sky-200">{t('Starting Balance')}</th>
                <th className="p-3 border-b border-sky-200">{t('Status')}</th>
                <th className="p-3 border-b border-sky-200">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100">
              {(Array.isArray(residents) ? residents : [])
                .filter(r => {
                  const matchesBuilding = !buildingFilter || (r.building && r.building.trim().toLowerCase() === buildingFilter.trim().toLowerCase());
                  const matchesApartment = !apartmentFilter || (r.apartment && r.apartment.trim().toLowerCase() === apartmentFilter.trim().toLowerCase());
                  return matchesBuilding && matchesApartment;
                })
                .map((r) => (
                <tr 
                  key={r.id} 
                  className="hover:bg-sky-100/50 even:bg-sky-50/50 transition-colors cursor-pointer group"
                  onClick={() => setViewingResident(r)}
                >
                  <td className="p-3 text-sm font-medium group-hover:text-blue-600 transition-colors">{r.full_name}</td>
                  <td className="p-3 text-sm">{r.apartment}</td>
                  <td className="p-3 text-sm">{r.property_number || '-'}</td>
                  <td className="p-3 text-sm">{r.joining_date || '-'}</td>
                  <td className="p-3 text-sm" dir="ltr">{r.phone}</td>
                  <td className="p-3 text-sm">{r.email}</td>
                  <td className="p-3 font-mono text-xs">{r.password}</td>
                  <td className={`p-3 text-sm font-bold ${Number(r.current_balance || 0) < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {formatCurrency(r.current_balance || 0, profile?.currency || 'DH')}
                  </td>
                  <td className="p-3">
                    <span className={`text-sm font-bold text-black dark:text-white`}>
                      {r.occupancy_type === 'owner' ? t('Owner') : t('Tenant')}
                    </span>
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>{renderTableActions(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-6">
          {paymentAddSuccess && (
            <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">{t('Payment added successfully!')}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-8 px-4 overflow-x-auto">
            {localShowApartments && (
            <TabButton 
              active={paymentSubTab === 'residents'} 
              onClick={() => setPaymentSubTab('residents')}
            >
              {t('Residential Apartments')}
            </TabButton>
            )}
          </div>

          <div className="space-y-6">
            <div className="mb-6 flex flex-row flex-wrap gap-4 items-center justify-center md:justify-between">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Button variant="dark" onClick={() => { fetchNextReceiptNumber('payment'); setIsModalOpen(true); }} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Add')}>
                <Plus className="w-5 h-5" />
              </Button>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Import')}>
                <Download className="w-5 h-5" />
              </Button>
              <Button variant="secondary" onClick={handleExportExcel} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Export')}>
                <Upload className="w-5 h-5" />
              </Button>
              <Button variant="secondary" onClick={handlePrintPayments} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Print')}>
                <Printer className="w-5 h-5" />
              </Button>
              <Button variant="secondary" className="w-10 h-10 p-0 rounded-full flex items-center justify-center text-red-600 border-red-100 hover:bg-red-50" onClick={handleDeleteAll} title={t('Delete All')}>
                <Trash2 className="w-5 h-5" />
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)} 
                className="md:hidden w-10 h-10 p-0 rounded-full flex items-center justify-center" 
                title={t('Filters')}
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </div>
            
            <div className={`${isMobileFiltersOpen ? 'flex' : 'hidden md:flex'} items-center justify-center md:justify-start gap-2 flex-wrap w-full md:w-auto`}>
              <Input 
                className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-10 text-center placeholder-blue-400 text-blue-900"
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
                placeholder={t('Building')}
              />
              <Input 
                className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-10 text-center placeholder-blue-400 text-blue-900"
                value={apartmentFilter}
                onChange={(e) => setApartmentFilter(e.target.value)}
                placeholder={t('Apartment')}
              />
              <select 
                className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-10 text-center text-blue-900"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                <option value="">{t('Month')}</option>
                {displayMonths.map((m, i) => (
                  <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                ))}
              </select>
              <Input 
                type="number"
                className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-10 text-center placeholder-blue-400 text-blue-900"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                placeholder={t('Year')}
              />
            </div>
          </div>

          <div className="bg-sky-50 rounded-2xl shadow-sm border border-sky-100 overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'}`}>
              <thead className="bg-sky-100 text-gray-900 text-base font-black uppercase tracking-wider">
                <tr>
                  <th className="p-3 border-b border-sky-200">{t('Full Name')}</th>
                  <th className="p-3 border-b border-sky-200">
                    {t('Apartment')}
                  </th>
                  <th className="p-3 border-b border-sky-200">{t('Date')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Receipt Number')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Payment Type')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Payment')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100">
                {(Array.isArray(payments) ? payments : [])
                  .filter(c => {
                    const matchesBuilding = !buildingFilter || (c.building && c.building.toLowerCase().includes(buildingFilter.toLowerCase()));
                    const matchesApartment = !apartmentFilter || (c.apartment && c.apartment.toLowerCase().includes(apartmentFilter.toLowerCase()));
                    const matchesMonth = !monthFilter || (c.date && c.date.split('-')[1] === monthFilter);
                    const matchesYear = !yearFilter || (c.date && c.date.split('-')[0] === yearFilter);
                    return matchesBuilding && matchesApartment && matchesMonth && matchesYear;
                  })
                  .map((c) => (
                  <tr key={c.id} className="hover:bg-sky-100/50 even:bg-sky-50/50 transition-colors">
                    <td className="p-3 text-sm font-medium">{c.full_name}</td>
                    <td className="p-3 text-sm">{c.apartment}</td>
                    <td className="p-3 text-sm">{c.date}</td>
                    <td className="p-3 text-sm">{c.receipt_number}</td>
                    <td className="p-3 text-sm">
                      {t(c.payment_type || 'cash')}
                    </td>
                    <td className="p-3 text-sm text-blue-600 font-bold">{formatCurrency(c.amount, profile?.currency || 'DH')}</td>
                    <td className="p-3">{renderTableActions(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'expenses' && (
        <div className="space-y-6">
          {paymentAddSuccess && (
            <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">{t('Expense added successfully!')}</span>
            </div>
          )}
          <div className="flex flex-row flex-wrap gap-4 items-center justify-center md:justify-between mb-6">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Button variant="dark" onClick={() => { fetchNextReceiptNumber('expense'); setIsModalOpen(true); }} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Add Expense')}>
                <Plus className="w-5 h-5" />
              </Button>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Import')}>
                <Download className="w-5 h-5" />
              </Button>
              <Button variant="secondary" onClick={handleExportExcel} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Export')}>
                <Upload className="w-5 h-5" />
              </Button>
              <Button variant="secondary" onClick={handlePrintExpenses} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Print')}>
                <Printer className="w-5 h-5" />
              </Button>
              <Button variant="secondary" className="w-10 h-10 p-0 rounded-full flex items-center justify-center text-red-600 border-red-100 hover:bg-red-50" onClick={handleDeleteAll} title={t('Delete All')}>
                <Trash2 className="w-5 h-5" />
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)} 
                className="md:hidden w-10 h-10 p-0 rounded-full flex items-center justify-center" 
                title={t('Filters')}
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </div>
            
            <div className={`${isMobileFiltersOpen ? 'flex' : 'hidden md:flex'} items-center gap-1.5 md:gap-2 flex-wrap justify-center w-full md:w-auto`}>
              <Input 
                className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center placeholder-blue-400 text-blue-900"
                value={expenseTypeFilter}
                onChange={(e) => setExpenseTypeFilter(e.target.value)}
                placeholder={t('Expense Type')}
              />
              <Input 
                className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center placeholder-blue-400 text-blue-900"
                value={expenseSpenderFilter}
                onChange={(e) => setExpenseSpenderFilter(e.target.value)}
                placeholder={t('Spender')}
              />
              <Input 
                type="number"
                className="w-16 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center placeholder-blue-400 text-blue-900"
                value={expenseYearFilter}
                onChange={(e) => setExpenseYearFilter(e.target.value)}
                placeholder={t('Year')}
              />
              <select
                className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center text-blue-900"
                value={expenseMonthFilter}
                onChange={(e) => setExpenseMonthFilter(e.target.value)}
              >
                <option value="">{t('Month')}</option>
                {displayMonths.map((m, i) => (
                  <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-sky-50 rounded-2xl shadow-sm border border-sky-100 overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'}`}>
              <thead className="bg-sky-100 text-gray-900 text-base font-black uppercase tracking-wider">
                <tr>
                  <th className="p-3 border-b border-sky-200">{t('Expense Type')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Spender')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Date')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Receipt Number')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Notes')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Payment Method')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Amount')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100">
                {(Array.isArray(filteredExpenses) ? filteredExpenses : []).map((e) => (
                  <tr key={e.id} className="hover:bg-sky-100/50 even:bg-sky-50/50 transition-colors">
                    <td className="p-3 text-sm">{t(e.expense_type)}</td>
                    <td className="p-3 text-sm">{e.spender}</td>
                    <td className="p-3 text-sm">{e.date}</td>
                    <td className="p-3 text-sm">{e.receipt_number}</td>
                    <td className="p-3 text-xs max-w-xs truncate" title={e.notes}>{e.notes}</td>
                    <td className="p-3 text-sm">{e.payment_type === 'bank' ? t('Bank') : t('Cash')}</td>
                    <td className="p-3 text-sm text-red-600 font-bold">{formatCurrency(e.amount, profile?.currency || 'DH')}</td>
                    <td className="p-3">{renderTableActions(e)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-sky-100 font-bold">
                <tr>
                  <td colSpan={6} className="p-3 text-sm">{t('Total Expenses')}</td>
                  <td colSpan={1} className="p-3 text-sm text-red-600">{formatCurrency(filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0), profile?.currency || 'DH')}</td>
                  <td colSpan={1} className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-8 px-4 overflow-x-auto">
            {localShowApartments && (
            <TabButton 
              active={selectedReport === 'residents'} 
              onClick={() => setSelectedReport('residents')}
            >
              {t('Residential Apartments')}
            </TabButton>
            )}
          </div>

          {selectedReport && selectedReport !== 'annual' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
            <div className="flex items-center justify-center md:justify-start gap-1.5 md:gap-2 flex-wrap w-full md:w-auto">
              <Button variant="secondary" onClick={handlePrintReport} className="w-9 h-9 md:w-10 md:h-10 p-0 rounded-full flex items-center justify-center" title={t('Print')}>
                <Printer className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
              <Button variant="secondary" onClick={handleExportExcel} className="w-9 h-9 md:w-10 md:h-10 p-0 rounded-full flex items-center justify-center" title={t('Export')}>
                <Upload className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)} 
                className="md:hidden w-9 h-9 md:w-10 md:h-10 p-0 rounded-full flex items-center justify-center" 
                title={t('Filters')}
              >
                <MoreVertical className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
              
              <div className={`${isMobileFiltersOpen ? 'flex' : 'hidden md:flex'} items-center gap-1.5 md:gap-2 flex-wrap`}>
                <Input 
                  className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center placeholder-blue-400 text-blue-900"
                  value={buildingFilter}
                  onChange={(e) => setBuildingFilter(e.target.value)}
                  placeholder={t('Building')}
                />
                <Input 
                  type="number"
                  className="w-16 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center placeholder-blue-400 text-blue-900"
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                  placeholder={t('Year')}
                />
                <select
                  className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center placeholder-blue-400 text-blue-900"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Number(e.target.value))}
                >
                  {displayMonths.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-center md:justify-end gap-2 flex-wrap w-full md:w-auto">
            </div>
          </div>

          <div className="bg-sky-50 rounded-2xl shadow-sm border border-sky-100 overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'}`}>
              <thead className="bg-sky-100 text-gray-900 text-base font-black uppercase tracking-wider">
                <tr>
                  <th className="p-3 border-b border-sky-200 font-bold">{t('Full Name')}</th>
                  <th className="p-3 border-b border-sky-200 font-bold">{t('Apartment')}</th>
                  {displayMonths.slice(0, reportMonth).map(m => (
                    <th key={m} className="p-3 border-b border-sky-200 border-x border-sky-100 text-center min-w-[60px] font-bold">{m}</th>
                  ))}
                  <th className="p-3 border-b border-sky-200 font-bold">{t('Balance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100">
                {(Array.isArray(residents) ? residents : [])
                  .filter(r => !buildingFilter || (r.building && r.building.toLowerCase().includes(buildingFilter.toLowerCase())))
                  .map((r) => {
                    const monthlyFee = profile?.membership_fee ?? 0;
                    const certYear = profile?.certified_year || new Date().getFullYear();
                    const certMonth = profile?.certified_month || 1;

                    const totalPaid = Number(r.current_balance || 0) + (Array.isArray(payments) ? payments : [])
                      .filter(c => Number((c as any).resident_id) === Number(r.id))
                      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

                    const monthsCovered = monthlyFee > 0 ? Math.floor(totalPaid / monthlyFee) : 0;
                    
                    // Calculate balance based on the selected month of the displayed year
                    let totalMonthsUntilSelectedMonth = 0;
                    if (reportYear > certYear) {
                      totalMonthsUntilSelectedMonth = (reportYear - certYear) * 12 + (reportMonth - certMonth + 1);
                    } else if (reportYear === certYear) {
                      totalMonthsUntilSelectedMonth = Math.max(0, reportMonth - certMonth + 1);
                    }
                    
                    const totalRequiredUntilSelectedMonth = totalMonthsUntilSelectedMonth * monthlyFee;
                    const balanceAtSelectedMonth = totalPaid - totalRequiredUntilSelectedMonth;

                    return (
                      <tr key={r.id} className="hover:bg-sky-100/50 even:bg-sky-50/50 transition-colors text-sm">
                        <td className="p-3 font-bold border-b border-sky-100">{r.full_name}</td>
                        <td className="p-3 border-b border-sky-100 font-bold">{r.apartment}</td>
                        {displayMonths.slice(0, reportMonth).map((_, i) => {
                          const m = i + 1;
                          const isBeforeCertified = reportYear < certYear || (reportYear === certYear && m < certMonth);
                          
                          if (isBeforeCertified) {
                            return <td key={i} className="p-3 border-b border-sky-100 border-x border-sky-100 text-center text-gray-300">-</td>;
                          }

                          const monthIndexFromStart = (reportYear - certYear) * 12 + (m - certMonth);
                          const isPaid = monthIndexFromStart < monthsCovered;

                          return (
                            <td key={i} className={`p-3 border-b border-sky-100 border-x text-center font-bold ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                              {isPaid ? t('Paid') : t('Unpaid')}
                            </td>
                          );
                        })}
                        <td className="p-3 border-b border-sky-100 font-mono text-center font-bold">
                          <span className={balanceAtSelectedMonth >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(balanceAtSelectedMonth, profile?.currency || 'DH')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </div>
      )}

      {activeTab === 'initial_balance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden md:col-span-1">
              <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 border-b border-gray-100">
                <Printer className="w-6 h-6 text-gray-600" />
                <h3 className="font-semibold text-gray-800">{t('Receipt Settings')}</h3>
              </div>
              <div className="p-6">
                <ReceiptSettings 
                  styles={profile?.receipt_settings ? JSON.parse(profile.receipt_settings) : {
                    textColor: '#1f2937',
                    backgroundColor: '#ffffff',
                    fontWeight: 'normal',
                    fontSize: '14px',
                    stampSize: '120px',
                    logoSize: '128px',
                    logoPosition: 'center'
                  }} 
                  onChange={handleReceiptStylesChange} 
                />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden md:col-span-1">
              <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 border-b border-gray-100">
                <DollarSign className="w-6 h-6 text-gray-600" />
                <h3 className="text-gray-900 text-xl font-bold">{t('General Settings')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-800 text-lg font-semibold">{t('Currency')}</span>
                  <div className="w-32">
                    <select 
                      value={localCurrency} 
                      onChange={(e) => {
                        setLocalCurrency(e.target.value);
                        updateProfileFieldDirectly('currency', e.target.value);
                      }}
                      className="w-full p-2 border rounded-xl text-right text-lg font-bold"
                    >
                      <option value="DH">DH</option>
                      <option value="€">€</option>
                      <option value="$">$</option>
                      <option value="£">£</option>
                      <option value="SAR">SAR</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden md:col-span-2">
              <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 border-b border-gray-100">
                <LayoutDashboard className="w-6 h-6 text-gray-600" />
                <h3 className="text-gray-900 text-xl font-bold">{t('Display Settings')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-800 text-lg font-semibold">{t('Show Apartments')}</span>
                  <input 
                    type="checkbox" 
                    checked={localShowApartments} 
                    onChange={(e) => {
                      setLocalShowApartments(e.target.checked);
                      updateProfileFieldDirectly('showApartments', e.target.checked);
                    }}
                    className="w-6 h-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden md:col-span-2">
              <div className="bg-blue-50 px-4 py-3 flex items-center gap-2 border-b border-blue-100">
                <Wallet className="w-6 h-6 text-blue-600" />
                <h3 className="text-blue-900 text-xl font-bold">{t('Treasury')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-800 text-lg font-semibold">{t('Initial Bank Balance')}</span>
                  <div className="w-32">
                    <Input 
                      type="number" 
                      value={localBankBalance} 
                      onChange={(e) => setLocalBankBalance(e.target.value)}
                      onBlur={() => updateProfileFieldDirectly('bank', localBankBalance)}
                      className="text-right text-lg font-bold"
                    />
                  </div>
                </div>
                <div className="h-px bg-gray-100"></div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-800 text-lg font-semibold">{t('Initial Cash Box Balance')}</span>
                  <div className="w-32">
                    <Input 
                      type="number" 
                      value={localCashboxBalance} 
                      onChange={(e) => setLocalCashboxBalance(e.target.value)}
                      onBlur={() => updateProfileFieldDirectly('cashbox', localCashboxBalance)}
                      className="text-right text-lg font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {localShowApartments && (
            <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden md:col-span-2">
              <div className="bg-blue-50 px-4 py-3 flex items-center gap-2 border-b border-blue-100">
                <Building2 className="w-6 h-6 text-blue-600" />
                <h3 className="text-blue-900 text-xl font-bold">{t('Apartment Settings')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-800 text-lg font-semibold">{t('Membership Fee')}</span>
                  <div className="w-32">
                    <Input 
                      type="number" 
                      value={localMembershipFee} 
                      onChange={(e) => setLocalMembershipFee(e.target.value)}
                      onBlur={() => updateProfileFieldDirectly('membershipFee', localMembershipFee)}
                      className="text-right text-lg font-bold"
                    />
                  </div>
                </div>
                <div className="h-px bg-gray-100"></div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-800 text-lg font-semibold">{t('Certified Date')}</span>
                  <div className="flex gap-2">
                    <div className="w-16">
                      <Input 
                        type="number" 
                        min="1"
                        max="12"
                        value={localCertifiedMonth} 
                        onChange={(e) => setLocalCertifiedMonth(e.target.value)}
                        onBlur={() => updateProfileFieldDirectly('certifiedMonth', localCertifiedMonth)}
                        className="text-center text-lg font-bold"
                        placeholder="MM"
                      />
                    </div>
                    <div className="w-24">
                      <Input 
                        type="number" 
                        value={localCertifiedYear} 
                        onChange={(e) => setLocalCertifiedYear(e.target.value)}
                        onBlur={() => updateProfileFieldDirectly('certifiedYear', localCertifiedYear)}
                        className="text-center text-lg font-bold"
                        placeholder="YYYY"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="space-y-6">
          {paymentAddSuccess && (
            <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">{financialSubTab === 'bank' ? t('Bank operation added successfully!') : t('Cash box operation added successfully!')}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-8 px-4 overflow-x-auto">
            <TabButton 
              active={financialSubTab === 'bank'} 
              onClick={() => setFinancialSubTab('bank')}
            >
              {t('Bank')}
            </TabButton>
            <TabButton 
              active={financialSubTab === 'cashbox'} 
              onClick={() => setFinancialSubTab('cashbox')}
            >
              {t('Cash Box')}
            </TabButton>
          </div>
          <div className="flex flex-row flex-wrap gap-4 items-center justify-center md:justify-between mb-6">
             <div className="flex items-center justify-center md:justify-start gap-2">
               <Button variant="dark" onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Add')}>
                 <Plus className="w-5 h-5" />
               </Button>
               <Button variant="secondary" onClick={handleExportExcel} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Export')}>
                 <Upload className="w-5 h-5" />
               </Button>
               <Button variant="secondary" onClick={handlePrintBankOps} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Print')}>
                 <Printer className="w-5 h-5" />
               </Button>
               <Button 
                variant="secondary" 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)} 
                className="md:hidden w-10 h-10 p-0 rounded-full flex items-center justify-center" 
                title={t('Filters')}
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
             </div>
             
             <div className={`${isMobileFiltersOpen ? 'flex' : 'hidden md:flex'} items-center justify-center md:justify-start gap-1.5 md:gap-2 flex-wrap w-full md:w-auto`}>
               <select
                 className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center text-blue-900"
                 value={bankOpTypeFilter}
                 onChange={(e) => setBankOpTypeFilter(e.target.value)}
               >
                 <option value="">{t('All')}</option>
                 <option value="deposit">{t('Deposit')}</option>
                 <option value="withdrawal">{t('Withdrawal')}</option>
               </select>
               <Input
                 className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center placeholder-blue-400 text-blue-900"
                 value={bankNameFilter}
                 onChange={(e) => setBankNameFilter(e.target.value)}
                 placeholder={t('Name')}
               />
               <Input
                 type="number"
                 className="w-16 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center placeholder-blue-400 text-blue-900"
                 value={bankYearFilter}
                 onChange={(e) => setBankYearFilter(e.target.value)}
                 placeholder={t('Year')}
               />
               <select
                 className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center text-blue-900"
                 value={bankMonthFilter}
                 onChange={(e) => setBankMonthFilter(e.target.value)}
               >
                 <option value="">{t('Month')}</option>
                 {displayMonths.map((m, i) => (
                   <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                 ))}
               </select>
             </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-end gap-4 mb-6">
            <div className="flex items-center gap-3 bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100 shadow-sm w-full md:w-auto justify-center">
              <span className="text-sm text-blue-600 font-medium">{financialSubTab === 'bank' ? t('Bank Balance') : t('Cash Box Balance')}:</span>
              <span className={`text-lg font-bold ${
                (combinedOps.reduce((acc, curr) => acc + (curr.operation_type === 'deposit' ? curr.amount : -curr.amount), 0) + (financialSubTab === 'bank' ? (profile?.initial_bank_balance || 0) : (profile?.initial_cashbox_balance || 0))) >= 0 
                  ? 'text-blue-900' 
                  : 'text-red-600'
              }`}>
                {formatCurrency(combinedOps.reduce((acc, curr) => acc + (curr.operation_type === 'deposit' ? curr.amount : -curr.amount), 0) + (financialSubTab === 'bank' ? (profile?.initial_bank_balance || 0) : (profile?.initial_cashbox_balance || 0)), profile?.currency || 'DH')}
              </span>
            </div>
          </div>

          <div className="bg-sky-50 rounded-2xl shadow-sm border border-sky-100 overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'}`}>
              <thead className="bg-sky-100 text-gray-900 text-base font-black uppercase tracking-wider">
                <tr>
                  <th className="p-3 border-b border-sky-200">{t('Operation Type')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Name')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Apartment')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Date')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Description')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Amount')}</th>
                  <th className="p-3 border-b border-sky-200">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100">
                {combinedOps.filter(op => {
                  const matchesType = !bankOpTypeFilter || op.operation_type === bankOpTypeFilter;
                  const formattedName = formatOperationName(op.name);
                  const matchesName = !bankNameFilter || (formattedName && formattedName.toLowerCase().includes(bankNameFilter.toLowerCase()));
                  const matchesMonth = !bankMonthFilter || (op.date && op.date.split('-')[1] === bankMonthFilter);
                  const matchesYear = !bankYearFilter || (op.date && op.date.split('-')[0] === bankYearFilter);
                  return matchesType && matchesName && matchesMonth && matchesYear;
                }).map((op) => (
                  <tr key={op.id} className="hover:bg-sky-100/50 even:bg-sky-50/50 transition-colors">
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        op.operation_type === 'deposit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {t(op.operation_type === 'deposit' ? 'Deposit' : 'Withdrawal')}
                      </span>
                    </td>
                    <td className="p-3 text-sm font-medium">{formatOperationName(op.name)}</td>
                    <td className="p-3 text-sm">{op.apartment || '-'}</td>
                    <td className="p-3 text-sm">{op.date}</td>
                    <td className="p-3 text-xs max-w-xs truncate" title={formatOperationDescription(op.description)}>{formatOperationDescription(op.description)}</td>
                    <td className={`p-3 text-sm font-bold ${op.operation_type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(op.amount, profile?.currency || 'DH')}
                    </td>
                    <td className="p-3">{renderTableActions(op)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex flex-col items-center">
              <span className="text-green-700 font-medium text-sm mb-1">{t('Total Deposits')}</span>
              <span className="text-xl font-bold text-green-800">
                {formatCurrency(combinedOps
                  .filter(op => {
                     const matchesType = !bankOpTypeFilter || op.operation_type === bankOpTypeFilter;
                     const formattedName = formatOperationName(op.name);
                     const matchesName = !bankNameFilter || (formattedName && formattedName.toLowerCase().includes(bankNameFilter.toLowerCase()));
                     const matchesMonth = !bankMonthFilter || (op.date && op.date.split('-')[1] === bankMonthFilter);
                     const matchesYear = !bankYearFilter || (op.date && op.date.split('-')[0] === bankYearFilter);
                     return matchesType && matchesName && matchesMonth && matchesYear;
                  })
                  .reduce((acc, curr) => acc + (curr.operation_type === 'deposit' ? curr.amount : 0), 0), profile?.currency || 'DH')}
              </span>
            </div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex flex-col items-center">
              <span className="text-red-700 font-medium text-sm mb-1">{t('Total Withdrawals')}</span>
              <span className="text-xl font-bold text-red-800">
                {formatCurrency(combinedOps
                  .filter(op => {
                     const matchesType = !bankOpTypeFilter || op.operation_type === bankOpTypeFilter;
                     const formattedName = formatOperationName(op.name);
                     const matchesName = !bankNameFilter || (formattedName && formattedName.toLowerCase().includes(bankNameFilter.toLowerCase()));
                     const matchesMonth = !bankMonthFilter || (op.date && op.date.split('-')[1] === bankMonthFilter);
                     const matchesYear = !bankYearFilter || (op.date && op.date.split('-')[0] === bankYearFilter);
                     return matchesType && matchesName && matchesMonth && matchesYear;
                  })
                  .reduce((acc, curr) => acc + (curr.operation_type === 'withdrawal' ? curr.amount : 0), 0), profile?.currency || 'DH')}
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'other_incomes' && (
        <div className="space-y-6">
          {paymentAddSuccess && (
            <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">{t('Income added successfully!')}</span>
            </div>
          )}
          {rentalHistoryView ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <Button 
                    variant="secondary" 
                    onClick={() => {
                      setRentalHistoryView(null);
                      setSelectedRentalYear('all');
                    }}
                    className="w-10 h-10 p-0 rounded-full flex items-center justify-center"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{t('Payment History')}</h2>
                    <p className="text-sm text-gray-500">{rentalHistoryView.tenant_name} - {rentalHistoryView.property_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    className="p-2 border border-blue-100 rounded-xl text-sm bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 text-blue-900"
                    value={selectedRentalYear}
                    onChange={(e) => setSelectedRentalYear(e.target.value)}
                  >
                    <option value="all">{t('All Years')}</option>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <option key={year} value={String(year)}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-xl border border-sky-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={`w-full ${isRtl ? 'text-right' : 'text-left'}`}>
                    <thead className="bg-sky-50 text-gray-900 text-sm font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-4 border-b border-sky-100">{t('Date')}</th>
                        <th className="p-4 border-b border-sky-100">{t('Receipt Number')}</th>
                        <th className="p-4 border-b border-sky-100">{t('Amount')}</th>
                        <th className="p-4 border-b border-sky-100">{t('Payment Type')}</th>
                        <th className="p-4 border-b border-sky-100">{t('Months Covered')}</th>
                        <th className="p-4 border-b border-sky-100 text-center">{t('Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-50">
                      {rentalPayments.map((p: any) => {
                        let monthsText = '';
                        try {
                          const indices = JSON.parse(p.months_covered || '[]');
                          if (indices.length > 0) {
                            const startDate = new Date(rentalHistoryView.date);
                            monthsText = indices.map((idx: number) => {
                              const d = new Date(startDate.getFullYear(), startDate.getMonth() + idx, 1);
                              return d.toLocaleString('fr-FR', { month: 'short', year: 'numeric' });
                            }).join(', ');
                          }
                        } catch (e) {}

                        return (
                          <tr key={p.id} className="hover:bg-sky-50/50 transition-colors">
                            <td className="p-4 text-sm text-gray-600">{p.date}</td>
                            <td className="p-4 text-sm font-medium text-gray-900">{p.receipt_number || '-'}</td>
                            <td className="p-4 text-sm font-bold text-blue-600">{formatCurrency(p.amount, profile?.currency || 'DH')}</td>
                            <td className="p-4 text-sm text-gray-600">
                              {t(p.payment_type || 'cash')}
                            </td>
                            <td className="p-4 text-xs text-gray-500 min-w-[200px]" title={monthsText}>
                              {monthsText ? (
                                <div className="flex flex-wrap gap-1 max-w-[300px]">
                                  {monthsText.split(', ').map((m: string, i: number) => (
                                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 text-[10px] whitespace-nowrap">
                                      {m}
                                    </span>
                                  ))}
                                </div>
                              ) : '-'}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => setDirectPrintRentalPayment({ ...p, income_type: 'rental', tenant_name: rentalHistoryView.tenant_name, property_type: rentalHistoryView.property_type, monthsText })}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                                  title={t('Print')}
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => {
                                    setEditingRentalPayment(p);
                                    setRentalPaymentAmount(p.amount.toString());
                                    setRentalPaymentType(p.payment_type);
                                    setRentalPaymentDate(p.date);
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                  title={t('Edit')}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => {
                                    setConfirmConfig({
                                      isOpen: true,
                                      title: t('Delete Payment'),
                                      message: t('Are you sure you want to delete this payment?'),
                                      onConfirm: () => {
                                        handleDeleteRentalPayment(p.id);
                                        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                                      }
                                    });
                                  }}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                  title={t('Delete')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {rentalPayments.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-gray-400 italic">
                            {t('No payments recorded yet')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-8 px-4 overflow-x-auto">
            <TabButton 
              active={otherIncomeSubTab === 'rental'} 
              onClick={() => setOtherIncomeSubTab('rental')}
            >
              {t('Rental Incomes')}
            </TabButton>
            <TabButton 
              active={otherIncomeSubTab === 'other'} 
              onClick={() => setOtherIncomeSubTab('other')}
            >
              {t('Other Incomes')}
            </TabButton>
          </div>
          <div className="mb-6 flex flex-row flex-wrap gap-4 items-center justify-center md:justify-between">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Button variant="dark" onClick={() => { fetchNextReceiptNumber(otherIncomeSubTab === 'rental' ? 'rental' : 'other_income'); setIsModalOpen(true); }} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Add')}>
                <Plus className="w-5 h-5" />
              </Button>
              <Button variant="secondary" onClick={handleExportExcel} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Export')}>
                <Upload className="w-5 h-5" />
              </Button>
              <Button variant="secondary" onClick={handlePrintOtherIncomes} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Print')}>
                <Printer className="w-5 h-5" />
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)} 
                className="md:hidden w-10 h-10 p-0 rounded-full flex items-center justify-center" 
                title={t('Filters')}
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </div>
            
            <div className={`${isMobileFiltersOpen ? 'flex' : 'hidden md:flex'} items-center gap-1.5 md:gap-2 flex-wrap justify-center w-full md:w-auto`}>
              {otherIncomeSubTab === 'rental' && (
                <>
                  <Input 
                    className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center placeholder-blue-400 text-blue-900"
                    value={buildingFilter} // Reusing buildingFilter for tenant name in this context
                    onChange={(e) => setBuildingFilter(e.target.value)}
                    placeholder={t('Tenant Name')}
                  />
                  <Input 
                    type="number"
                    className="w-16 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center placeholder-blue-400 text-blue-900"
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    placeholder={t('Year')}
                  />
                </>
              )}
              
              {otherIncomeSubTab === 'other' && (
                <>
                  <Input 
                    className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center placeholder-blue-400 text-blue-900"
                    value={incomeTypeFilter}
                    onChange={(e) => setIncomeTypeFilter(e.target.value)}
                    placeholder={t('Income Nature')}
                  />
                  <Input 
                    className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center placeholder-blue-400 text-blue-900"
                    value={contributorNameFilter}
                    onChange={(e) => setContributorNameFilter(e.target.value)}
                    placeholder={t('Contributor Name')}
                  />
                  <Input 
                    type="number"
                    className="w-16 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center placeholder-blue-400 text-blue-900"
                    value={otherIncomeYearFilter}
                    onChange={(e) => setOtherIncomeYearFilter(e.target.value)}
                    placeholder={t('Year')}
                  />
                  <select
                    className="w-20 md:w-24 p-1.5 border border-blue-100 rounded-lg text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-100 h-9 md:h-10 text-center text-blue-900"
                    value={otherIncomeMonthFilter}
                    onChange={(e) => setOtherIncomeMonthFilter(e.target.value)}
                  >
                    <option value="">{t('Month')}</option>
                    {displayMonths.map((m, i) => (
                      <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {otherIncomeSubTab === 'rental' ? (
            <div className="bg-sky-50 rounded-2xl shadow-sm border border-sky-100 overflow-hidden overflow-x-auto">
              <table className={`w-full ${isRtl ? 'text-right' : 'text-left'}`}>
                <thead className="bg-sky-100 text-gray-900 text-base font-black uppercase tracking-wider">
                  <tr>
                    <th className="p-3 border-b border-sky-200">{t('Property Address')}</th>
                    <th className="p-3 border-b border-sky-200">{t('Tenant Name')}</th>
                    <th className="p-3 border-b border-sky-200">{t('Rental Price')}</th>
                    <th className="p-3 border-b border-sky-200">{t('Start Date')}</th>
                    <th className="p-3 border-b border-sky-200">{t('End Date')}</th>
                    <th className="p-3 border-b border-sky-200 border-x text-center">{t('Rental Fee')}</th>
                    {displayMonths.map(m => (
                      <th key={m} className="p-3 border-b border-sky-200 border-x text-center min-w-[60px]">{m}</th>
                    ))}
                    <th className="p-3 border-b border-sky-200">{t('Balance')}</th>
                    <th className="p-3 border-b border-sky-200">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {displayRentalIncomes
                    .map((ri) => {
                      const rentalPrice = Number(ri.rental_price || 0);
                      const cumulativeTotalPaid = Number(ri.cumulativeTotalPaid || 0);
                      
                      const startDate = new Date(ri.firstDate);
                      const startMonth = startDate.getMonth() + 1;
                      const startYear = startDate.getFullYear();
                      const targetYear = Number(ri.year);
                      
                      let referenceYear = targetYear;
                      let referenceMonth = 12;

                      if (ri.end_date) {
                        const endDate = new Date(ri.end_date);
                        const endM = endDate.getMonth() + 1;
                        const endY = endDate.getFullYear();
                        
                        // The reference point for balance is either the end of the displayed year 
                        // or the end of the rental, whichever comes first.
                        if (endY < targetYear) {
                          referenceYear = endY;
                          referenceMonth = endM;
                        } else if (endY === targetYear) {
                          referenceMonth = Math.min(12, endM);
                        }
                      }

                      const totalMonthsRequired = Math.max(0, (referenceYear - startYear) * 12 + (referenceMonth - startMonth) + 1);
                      const totalAmountRequired = totalMonthsRequired * rentalPrice;
                      
                      const monthsCovered = rentalPrice > 0 ? Math.floor(cumulativeTotalPaid / rentalPrice) : 0;
                      const balance = cumulativeTotalPaid - totalAmountRequired;
                      
                      return (
                        <tr key={ri.id} className="hover:bg-sky-100/50 even:bg-sky-50/50 transition-colors">
                          <td className="p-3 text-sm">{ri.property_address || '-'}</td>
                          <td className="p-3 text-sm font-medium">
                            <div className="flex flex-col">
                              <span>{ri.tenant_name}</span>
                              {ri.end_date && new Date(ri.end_date) <= new Date() && (
                                <span className="text-[9px] text-red-500 font-bold uppercase">{t('Ended')}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-sm font-bold text-blue-600">{formatCurrency(ri.rental_price, profile?.currency || 'DH')}</td>
                          <td className="p-3 text-sm">{ri.date}</td>
                          <td className="p-3 text-sm">{ri.end_date || '-'}</td>
                          <td className="p-3 border-x border-sky-100 text-center">
                              <button 
                                onClick={() => { setPayingRental(ri); setRentalPaymentAmount(''); setRentalPaymentType('cash'); fetchNextReceiptNumber('rental'); }}
                                disabled={ri.end_date && new Date(ri.end_date) <= new Date()}
                                className={`p-1 rounded text-[10px] font-bold border ${ri.end_date && new Date(ri.end_date) <= new Date() ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed' : 'text-green-600 hover:bg-green-50 border-green-200'}`}
                                title={t('Rental Fee')}
                              >
                                {t('Rental Fee')}
                              </button>
                          </td>
                          {displayMonths.map((_, i) => {
                            const m = i + 1;
                            const monthsSinceStart = (targetYear - startYear) * 12 + (m - startMonth);
                            
                            if (monthsSinceStart < 0) {
                              return <td key={i} className="p-3 border-b border-sky-100 border-x text-center text-gray-300">-</td>;
                            }

                            if (ri.end_date) {
                              const endDate = new Date(ri.end_date);
                              const endMonth = endDate.getMonth() + 1;
                              const endYear = endDate.getFullYear();
                              if (targetYear > endYear || (targetYear === endYear && m > endMonth)) {
                                return <td key={i} className="p-3 border-b border-sky-100 border-x text-center text-gray-300">-</td>;
                              }
                            }

                            const isPaid = monthsSinceStart < monthsCovered;
                            let paymentType = '';
                            if (isPaid) {
                              paymentType = t('Paid');
                            }
                            return (
                              <td key={i} className={`p-3 border-b border-sky-100 border-x text-center text-[10px] font-bold ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                                {isPaid ? paymentType : t('Unpaid')}
                              </td>
                            );
                          })}
                          <td className={`p-3 text-sm font-bold text-center ${balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(balance, profile?.currency || 'DH')}
                          </td>
                          <td className="p-3">{renderTableActions(ri)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-sky-50 rounded-2xl shadow-sm border border-sky-100 overflow-x-auto">
              <table className={`w-full ${isRtl ? 'text-right' : 'text-left'}`}>
                <thead className="bg-sky-100 text-gray-900 text-base font-black uppercase tracking-wider">
                  <tr>
                    <th className="p-3 border-b border-sky-200">{t('Income Type')}</th>
                    <th className="p-3 border-b border-sky-200">{t('Contributor Name')}</th>
                    <th className="p-3 border-b border-sky-200">{t('Date')}</th>
                    <th className="p-3 border-b border-sky-200">{t('Receipt Number')}</th>
                    <th className="p-3 border-b border-sky-200">{t('Payment Method')}</th>
                    <th className="p-3 border-b border-sky-200">{t('Amount')}</th>
                    <th className="p-3 border-b border-sky-200">{t('Notes')}</th>
                    <th className="p-3 border-b border-sky-200">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {filteredOtherIncomes.map((oi) => (
                    <tr key={oi.id} className="hover:bg-sky-100/50 even:bg-sky-50/50 transition-colors">
                      <td className="p-3 text-sm">{t(oi.income_type)}</td>
                      <td className="p-3 text-sm">{oi.contributor_name}</td>
                      <td className="p-3 text-sm">{oi.date}</td>
                      <td className="p-3 text-sm">{oi.receipt_number}</td>
                      <td className="p-3 text-sm">{oi.payment_type === 'bank' ? t('Bank') : t('Cash')}</td>
                      <td className="p-3 text-sm font-bold text-blue-600">{formatCurrency(oi.amount, profile?.currency || 'DH')}</td>
                      <td className="p-3 text-xs text-gray-500 max-w-xs truncate" title={oi.notes}>{oi.notes || '-'}</td>
                      <td className="p-3">{renderTableActions(oi)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-sky-100 font-bold">
                  <tr>
                    <td colSpan={4} className="p-3 text-base text-sky-900 text-right">{t('Total Income')}</td>
                    <td className="p-3 text-base text-green-600">{formatCurrency(totalOtherIncome, profile?.currency || 'DH')}</td>
                    <td colSpan={2} className="p-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          </>
        )}
        </div>
      )}

      {activeTab === 'complaints' && (
        <Spreadsheet 
          data={complaints}
          columns={[
            { key: 'resident_name', label: t('Resident') },
            { key: 'subject', label: t('Subject') },
            { key: 'description', label: t('Description') },
            { key: 'status', label: t('Status'), type: 'select', options: ['pending', 'in_progress', 'resolved'] },
            { key: 'created_at', label: t('Date'), type: 'date' }
          ]}
          onAdd={() => {
            // Logic to add a new complaint row
            // For now, we can just open the modal if we had one, 
            // but the user wants an Excel page.
            // I'll implement a simple add logic.
            const newComplaint: Complaint = {
              id: Date.now(),
              resident_id: 0,
              syndic_id: Number(syndicId),
              subject: '',
              description: '',
              status: 'pending',
              created_at: new Date().toISOString().split('T')[0]
            };
            setComplaints([...complaints, newComplaint]);
          }}
          onDelete={handleDeleteComplaint}
          onSave={async (newData) => {
            try {
              for (const item of newData) {
                // If it's an existing item (id is a small number or exists in DB)
                // We check if it's a new item by checking if it has resident_id (new items won't have it yet)
                if (item.resident_id) {
                  await fetch(`/api/complaints/${item.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: item.status })
                  });
                } else {
                  // New item from spreadsheet - we'll assign it to the first resident or a placeholder
                  await fetch('/api/complaints', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      residentId: residents[0]?.id || 1, 
                      syndicId: Number(syndicId), 
                      subject: item.subject || 'New Notification', 
                      description: item.description || '' 
                    })
                  });
                }
              }
              fetchData();
              alert(t('Saved successfully'));
            } catch (error) {
              console.error('Error saving:', error);
              alert(t('Error saving data'));
            }
          }}
        />
      )}

      {activeTab === 'notifications_center' && (
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-8 px-4 overflow-x-auto">
            <TabButton 
              active={notificationsSubTab === 'announcements'} 
              onClick={() => setNotificationsSubTab('announcements')}
            >
              {t('Announcements')}
            </TabButton>
            <TabButton 
              active={notificationsSubTab === 'complaints'} 
              onClick={() => setNotificationsSubTab('complaints')}
            >
              {t('Complaints')}
            </TabButton>
            <TabButton 
              active={notificationsSubTab === 'notifications'} 
              onClick={() => setNotificationsSubTab('notifications')}
            >
              {t('System Notifications')}
            </TabButton>
            <TabButton 
              active={notificationsSubTab === 'reminders'} 
              onClick={() => setNotificationsSubTab('reminders')}
            >
              {t('Automatic Reminders')}
            </TabButton>
          </div>

          <SharedNotifications 
            userRole="syndic"
            announcements={announcements}
            complaints={complaints}
            unpaidResidents={unpaidResidents}
            automaticReminders={automaticReminders}
            currency={profile?.currency || 'DH'}
            onAddAnnouncement={handleAddAnnouncement}
            onAddComplaint={handleAddComplaint}
            onUpdateComplaintStatus={handleUpdateComplaintStatus}
            onUpdateComplaintAnswer={handleUpdateComplaintAnswer}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            onDeleteComplaint={handleDeleteComplaint}
            onDeleteAutomaticReminder={handleDeleteAutomaticReminder}
            onClearAllAutomaticReminders={handleClearAllAutomaticReminders}
            onRefresh={fetchData}
            activeSubTab={notificationsSubTab}
            onSubTabChange={setNotificationsSubTab}
            hideTabs={true}
          />
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="space-y-6">
          {paymentAddSuccess && (
            <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">{t('Payment added successfully!')}</span>
            </div>
          )}
          {selectedProject ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col items-center justify-center mb-8 relative">
                <div className="absolute right-0 top-0">
                  <Button variant="secondary" onClick={() => setSelectedProject(null)} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Back')}>
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                </div>
                
                <div className="text-center px-12">
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">{selectedProject.name}</h2>
                  <p className="text-gray-500 text-sm max-w-md leading-relaxed mx-auto">{selectedProject.description}</p>
                </div>
              </div>

              <div className="flex flex-row flex-wrap gap-4 items-center justify-center md:justify-between mb-6">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <Button 
                    variant="dark" 
                    onClick={() => {
                      setProjectPaymentAmount('');
                      setProjectPaymentRemaining((-(selectedProject.individual_payment || 0)).toString());
                      fetchNextReceiptNumber('project_payment');
                      setProjectPaymentTypeFilter(localShowApartments ? 'resident' : 'external');
                      setIsAddingFromTable(false);
                      setIsProjectPaymentModalOpen(true);
                    }} 
                    className="w-10 h-10 p-0 rounded-full flex items-center justify-center"
                    title={t('Add Payment')}
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                  <Button variant="secondary" onClick={handleExportProjectPaymentsExcel} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Export')}>
                    <Upload className="w-5 h-5" />
                  </Button>
                  <Button variant="secondary" onClick={handlePrintProjectPayments} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Print')}>
                    <Printer className="w-5 h-5" />
                  </Button>
                  <Button variant="secondary" onClick={() => { setEditingProject(selectedProject); setIsProjectModalOpen(true); }} className="w-10 h-10 p-0 rounded-full flex items-center justify-center" title={t('Edit')}>
                    <Edit2 className="w-5 h-5" />
                  </Button>
                  <Button variant="secondary" onClick={handleDeleteAllProjectPayments} className="w-10 h-10 p-0 rounded-full flex items-center justify-center text-red-600 border-red-100 hover:bg-red-50" title={t('Delete All Payments')}>
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end justify-center bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">{t('Individual Payment')}</span>
                    <span className="text-xl font-black leading-none text-blue-900">{formatCurrency(selectedProject.individual_payment || 0, profile?.currency || 'DH')}</span>
                  </div>
                </div>
              </div>

              {projectStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
                      <Target className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('Target Amount')}</p>
                      <p className="text-2xl font-black text-gray-900">{formatCurrency(projectStats.targetAmount, profile?.currency || 'DH')}</p>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('Total Payments')}</p>
                      <p className="text-2xl font-black text-blue-600">{formatCurrency(projectStats.totalPaid, profile?.currency || 'DH')}</p>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 flex items-center justify-center text-rose-600 shadow-inner">
                      <Clock className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('Total Remaining')}</p>
                      <p className={clsx("text-2xl font-black", projectStats.totalRemaining <= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(-projectStats.totalRemaining, profile?.currency || 'DH')}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 items-center mb-6">
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <span className="text-[10px] md:text-xs font-bold text-blue-500 ml-1 md:ml-2">{t('Filter by')}:</span>
                  <select
                    value={projectPaymentListTypeFilter}
                    onChange={(e) => setProjectPaymentListTypeFilter(e.target.value)}
                    className="text-[10px] md:text-sm font-bold bg-blue-50 border border-blue-100 rounded-xl px-2 md:px-4 py-1 md:py-2 focus:ring-2 focus:ring-blue-500 text-blue-900"
                  >
                    <option value="all">{t('All Types')}</option>
                    {localShowApartments && <option value="resident">{t('Apartments')}</option>}
                    <option value="external">{t('External Contributor')}</option>
                  </select>
                  <div className="relative flex-1 min-w-[120px] md:max-w-[200px]">
                    <Input
                      placeholder={t('Building')}
                      value={projectPaymentListBuildingFilter}
                      onChange={(e) => setProjectPaymentListBuildingFilter(e.target.value)}
                      className="h-7 md:h-10 text-[10px] md:text-sm font-bold bg-blue-50 border border-blue-100 rounded-xl pl-7 md:pl-10 focus:ring-2 focus:ring-blue-500 text-blue-900 placeholder-blue-400"
                    />
                    <Building2 className="w-3 h-3 md:w-4 h-4 text-blue-400 absolute left-2 md:left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <select
                    value={projectPaymentListStatusFilter}
                    onChange={(e) => setProjectPaymentListStatusFilter(e.target.value)}
                    className="text-[10px] md:text-sm font-bold bg-blue-50 border border-blue-100 rounded-xl px-2 md:px-4 py-1 md:py-2 focus:ring-2 focus:ring-blue-500 text-blue-900"
                  >
                    <option value="all">{t('All Status')}</option>
                    <option value="paid">{t('Paid')}</option>
                    <option value="unpaid">{t('Unpaid')}</option>
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-sky-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-sky-50/50">
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Full Name')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Apartment')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Payment')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Date')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Remaining')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Receipt Number')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Payment Method')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {filteredProjectPaymentsData.map(({ resident, payment }) => (
                        <tr key={resident.id} className="hover:bg-sky-100/50 even:bg-sky-50/50 transition-colors group">
                          <td className="p-3 text-sm font-bold text-gray-900">{resident.full_name}</td>
                          <td className="p-3 text-sm text-gray-600">{resident.apartment}</td>
                          <td className="p-3 text-sm font-black text-blue-600">
                            {payment ? formatCurrency(payment.amount, profile?.currency || 'DH') : '-'}
                          </td>
                          <td className="p-3 text-sm text-gray-500">{payment?.date || '-'}</td>
                          <td className={clsx("p-3 text-sm font-bold", payment && payment.remaining_balance <= 0 ? "text-emerald-600" : "text-rose-600")}>
                            {payment ? formatCurrency(-payment.remaining_balance, profile?.currency || 'DH') : formatCurrency(-(selectedProject.individual_payment || 0), profile?.currency || 'DH')}
                          </td>
                          <td className="p-3 text-sm text-gray-500">{payment?.receipt_number || '-'}</td>
                          <td className="p-3 text-sm text-gray-600">
                            {payment?.payment_type ? t(payment.payment_type) : '-'}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              {payment ? (
                                <>
                                  <button 
                                    onClick={() => {
                                      setDirectPrintProjectPayment({ ...payment, project_name: selectedProject.name });
                                    }} 
                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" 
                                    title={t('Print Receipt')}
                                  >
                                    <Printer className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => { 
                                    setEditingProjectPayment(payment); 
                                    setProjectPaymentAmount(payment.amount.toString());
                                    setProjectPaymentRemaining((-payment.remaining_balance).toString());
                                    setProjectPaymentMethod(payment.payment_type || 'cash');
                                    setIsProjectPaymentModalOpen(true); 
                                  }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDeleteProjectPayment(payment.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors" title={t('Delete Payment')}>
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setProjectPaymentTypeFilter(resident.status as any);
                                    setProjectPaymentApartmentFilter(resident.apartment);
                                    setProjectPaymentResidentId(resident.id.toString());
                                    setProjectPaymentAmount('');
                                    setProjectPaymentRemaining((-(selectedProject.individual_payment || 0)).toString());
                                    setProjectPaymentMethod('cash');
                                    fetchNextReceiptNumber('project_payment');
                                    setIsAddingFromTable(true);
                                    setIsProjectPaymentModalOpen(true);
                                  }} 
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
                                >
                                  <Plus className="w-4 h-4" />
                                  {t('Add')}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-12">
                  <div className="text-right">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('Total Payments')}</p>
                    <p className="text-2xl font-black text-blue-600">
                      {formatCurrency(filteredProjectPaymentsData.reduce((sum, item) => sum + (item.payment?.amount || 0), 0), profile?.currency || 'DH')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('Total Remaining')}</p>
                    <p className={clsx("text-2xl font-black", filteredProjectPaymentsData.reduce((sum, item) => {
                        if (item.payment) return sum + item.payment.remaining_balance;
                        return sum + (selectedProject.individual_payment || 0);
                      }, 0) <= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {formatCurrency(-filteredProjectPaymentsData.reduce((sum, item) => {
                        if (item.payment) return sum + item.payment.remaining_balance;
                        return sum + (selectedProject.individual_payment || 0);
                      }, 0), profile?.currency || 'DH')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-nowrap overflow-x-auto gap-2 items-center justify-between mb-6 no-scrollbar pb-2">
                <div className="flex items-center gap-2 flex-nowrap min-w-max">
                  <Button variant="dark" onClick={() => setIsProjectModalOpen(true)} className="w-8 h-8 md:w-10 md:h-10 p-0 rounded-full flex items-center justify-center" title={t('Add Project')}>
                    <Plus className="w-4 h-4 md:w-5 md:h-5" />
                  </Button>
                  <Button variant="secondary" onClick={handleExportExcel} className="w-8 h-8 md:w-10 md:h-10 p-0 rounded-full flex items-center justify-center" title={t('Export')}>
                    <Upload className="w-4 h-4 md:w-5 md:h-5" />
                  </Button>
                  <Button variant="secondary" onClick={handlePrintProjects} className="w-8 h-8 md:w-10 md:h-10 p-0 rounded-full flex items-center justify-center" title={t('Print')}>
                    <Printer className="w-4 h-4 md:w-5 md:h-5" />
                  </Button>
                  <Button variant="secondary" className="w-8 h-8 md:w-10 md:h-10 p-0 rounded-full flex items-center justify-center text-red-600 border-red-100 hover:bg-red-50" onClick={handleDeleteAllProjects} title={t('Delete All')}>
                    <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto min-w-[150px] md:min-w-0">
                  <div className="relative flex-1 md:w-64">
                    <Input
                      placeholder={t('Search Projects...')}
                      value={projectSearchFilter}
                      onChange={(e) => setProjectSearchFilter(e.target.value)}
                      className="h-8 md:h-10 pl-8 md:pl-10 text-xs md:text-sm rounded-2xl bg-blue-50 border border-blue-100 focus:border-blue-500 transition-all text-blue-900 placeholder-blue-400"
                    />
                    <Users className="w-3 h-3 md:w-4 h-4 text-blue-400 absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-sky-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-sky-50/50">
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Project Name')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Description')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Target Amount')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Total Payments')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Remaining Amount')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Status')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Creation Date')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('End Date')}</th>
                        <th className="p-3 text-base font-black text-black uppercase tracking-widest border-b border-sky-200">{t('Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {projects.filter(p => p.name.toLowerCase().includes(projectSearchFilter.toLowerCase())).map((project) => {
                        const projectTotalPaid = projectPayments.filter(pp => pp.project_id === project.id).reduce((sum, pp) => sum + pp.amount, 0);
                        const projectRemaining = project.target_amount - projectTotalPaid;
                        
                        return (
                          <tr key={project.id} className="hover:bg-sky-100/50 even:bg-sky-50/50 transition-colors group cursor-pointer" onClick={() => setSelectedProject(project)}>
                            <td className="p-3 text-sm font-bold text-gray-900">{project.name}</td>
                            <td className="p-3 text-sm text-gray-600 max-w-xs truncate">{project.description}</td>
                            <td className="p-3 text-sm font-black text-gray-900">{formatCurrency(project.target_amount, profile?.currency || 'DH')}</td>
                            <td className="p-3 text-sm font-black text-blue-600">{formatCurrency(projectTotalPaid, profile?.currency || 'DH')}</td>
                            <td className="p-3 text-sm font-black text-rose-600">{formatCurrency(projectRemaining, profile?.currency || 'DH')}</td>
                            <td className="p-3">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                project.status === 'completed' ? 'bg-green-100 text-green-700' :
                                project.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                project.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {t(project.status)}
                              </span>
                            </td>
                            <td className="p-3 text-sm text-gray-600">{new Date(project.created_at).toLocaleDateString()}</td>
                            <td className="p-3 text-sm text-gray-600">{project.end_date ? new Date(project.end_date).toLocaleDateString() : '-'}</td>
                            <td className="p-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-2">
                                <button onClick={() => { setEditingProject(project); setIsProjectModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteProject(project.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors" title={t('Delete Project')}>
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}



      <Modal
        isOpen={isProjectModalOpen}
        onClose={() => { setIsProjectModalOpen(false); setEditingProject(null); }}
        title={editingProject ? t('Edit Project') : t('Add Project')}
      >
        <form onSubmit={editingProject ? handleUpdateProject : handleAddProject} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">{t('Project Name')}</label>
            <Input name="name" defaultValue={editingProject?.name} required placeholder={t('Enter project name')} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">{t('Description')}</label>
            <textarea
              name="description"
              defaultValue={editingProject?.description}
              className="w-full rounded-2xl border border-gray-200 focus:border-blue-500 transition-all p-3 text-sm min-h-[100px]"
              placeholder={t('Enter project description')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">{t('Target Amount')}</label>
              <Input name="targetAmount" type="number" step="0.01" defaultValue={editingProject?.target_amount} required placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">{t('Individual Payment')}</label>
              <Input name="individualPayment" type="number" step="0.01" defaultValue={editingProject?.individual_payment} required placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">{t('End Date')}</label>
            <Input name="endDate" type="date" defaultValue={editingProject?.end_date ? editingProject.end_date.split('T')[0] : ''} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">{t('Status')}</label>
            <select
              name="status"
              defaultValue={editingProject?.status || 'planned'}
              className="w-full rounded-2xl border-2 border-gray-200 focus:border-blue-500 transition-all p-3 text-sm"
            >
              <option value="planned">{t('Planned')}</option>
              <option value="in_progress">{t('In Progress')}</option>
              <option value="completed">{t('Completed')}</option>
              <option value="cancelled">{t('Cancelled')}</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" type="button" onClick={() => { setIsProjectModalOpen(false); setEditingProject(null); }}>
              {t('Cancel')}
            </Button>
            <Button variant="dark" type="submit">
              {editingProject ? t('Update Project') : t('Add Project')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isProjectPaymentModalOpen}
        onClose={() => { 
          setIsProjectPaymentModalOpen(false); 
          setEditingProjectPayment(null); 
          setProjectPaymentResidentId('');
          setProjectPaymentApartmentFilter('');
          setIsAddingFromTable(false);
        }}
        title={editingProjectPayment ? t('Edit Payment') : t('Add Payment')}
      >
        <form onSubmit={editingProjectPayment ? handleUpdateProjectPayment : handleAddProjectPayment} className="space-y-4">
          {!editingProjectPayment ? (
            <>
              {!isAddingFromTable && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">{t('Type')}</label>
                  <select
                    value={projectPaymentTypeFilter}
                    onChange={(e) => {
                      setProjectPaymentTypeFilter(e.target.value as any);
                      setProjectPaymentApartmentFilter('');
                      setProjectPaymentResidentId('');
                    }}
                    className="w-full rounded-2xl border-2 border-gray-200 focus:border-blue-500 transition-all p-3 text-sm"
                  >
                    {localShowApartments && <option value="resident">{t('Apartments')}</option>}
                    <option value="external">{t('External Contributor')}</option>
                  </select>
                </div>
              )}

              {projectPaymentTypeFilter !== 'external' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">
                      {t('Apartment')}
                    </label>
                    <Input
                      value={projectPaymentApartmentFilter}
                      onChange={(e) => {
                        setProjectPaymentApartmentFilter(e.target.value);
                        setProjectPaymentResidentId('');
                      }}
                      placeholder={t('Apartment')}
                      readOnly={isAddingFromTable}
                      className={isAddingFromTable ? "bg-gray-50" : ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">{t('Full Name')}</label>
                    {isAddingFromTable ? (
                      <>
                        <input type="hidden" name="residentId" value={projectPaymentResidentId} />
                        <Input
                          value={residents.find(r => r.id.toString() === projectPaymentResidentId)?.full_name || ''}
                          readOnly
                          className="bg-gray-50"
                        />
                      </>
                    ) : (
                      <select
                        name="residentId"
                        value={projectPaymentResidentId}
                        onChange={(e) => setProjectPaymentResidentId(e.target.value)}
                        required
                        className="w-full rounded-2xl border-2 border-gray-200 focus:border-blue-500 transition-all p-3 text-sm"
                      >
                        <option value="">{t('Select Resident')}</option>
                        {residents
                          .filter(r => r.status === projectPaymentTypeFilter &&
                                       (!projectPaymentApartmentFilter || (r.apartment && r.apartment.toLowerCase().includes(projectPaymentApartmentFilter.toLowerCase()))))
                          .map(r => (
                            <option key={r.id} value={r.id}>{r.full_name}</option>
                          ))}
                      </select>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">{t('Full Name')}</label>
                    <Input name="fullName" required placeholder={t('Enter full name')} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">{t('Apartment')} ({t('Optional')})</label>
                    <Input name="apartment" placeholder={t('Apartment')} />
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">{t('Full Name')}</label>
                <Input name="fullName" defaultValue={editingProjectPayment?.full_name} required placeholder={t('Enter full name')} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">{t('Apartment')} ({t('Optional')})</label>
                <Input name="apartment" defaultValue={editingProjectPayment?.apartment} placeholder={t('Apartment')} />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">{t('Payment')}</label>
              <Input 
                name="amount" 
                type="text" 
                value={projectPaymentAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                    setProjectPaymentAmount(val);
                    const amount = parseFloat(val) || 0;
                    const individualPayment = selectedProject?.individual_payment || 0;
                    setProjectPaymentRemaining((amount - individualPayment).toString());
                  }
                }}
                required 
                placeholder="0.00" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">{t('Remaining')}</label>
              <Input 
                name="remainingBalance" 
                type="text" 
                value={projectPaymentRemaining}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                    setProjectPaymentRemaining(val);
                  }
                }}
                required 
                placeholder="0.00" 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">{t('Receipt Number')}</label>
              <Input key={`proj-pay-${editingProjectPayment ? editingProjectPayment.id : nextReceiptNumber}`} name="receiptNumber" defaultValue={editingProjectPayment?.receipt_number || nextReceiptNumber} required placeholder={t('Receipt Number')} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">{t('Date')}</label>
              <Input type="date" name="date" defaultValue={editingProjectPayment?.date || new Date().toISOString().split('T')[0]} required />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">{t('Transaction Type')}</label>
            <div className="flex gap-8">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="projectPaymentMethod"
                      value="cash"
                      checked={projectPaymentMethod === 'cash'}
                      onChange={(e) => setProjectPaymentMethod(e.target.value)}
                      className="peer appearance-none w-6 h-6 border-2 border-gray-300 rounded-full checked:border-blue-500 transition-all cursor-pointer"
                      required
                    />
                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{t('Cash Deposit')}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="projectPaymentMethod"
                      value="bank"
                      checked={projectPaymentMethod === 'bank'}
                      onChange={(e) => setProjectPaymentMethod(e.target.value)}
                      className="peer appearance-none w-6 h-6 border-2 border-gray-300 rounded-full checked:border-blue-500 transition-all cursor-pointer"
                      required
                    />
                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{t('Bank Deposit')}</span>
                </label>
              </div>
            </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" type="button" onClick={() => { 
              setIsProjectPaymentModalOpen(false); 
              setEditingProjectPayment(null); 
              setProjectPaymentResidentId('');
              setProjectPaymentApartmentFilter('');
            }}>
              {t('Cancel')}
            </Button>
            <Button variant="dark" type="submit">
              {editingProjectPayment ? t('Update Payment') : t('Add Payment')}
            </Button>
          </div>
        </form>
      </Modal>

      {activeTab === 'profile' && profile && (
        <div className="max-w-2xl bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          {saveSuccess && (
            <div className="mb-6 bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">{t('Account updated successfully!')}</span>
            </div>
          )}
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="flex flex-col md:flex-row justify-center gap-8 mb-8">
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm font-medium text-gray-600">{t('Profile Picture')}</span>
                <div className="relative">
                  <img 
                    src={profile.profile_picture || 'https://picsum.photos/200'} 
                    className="w-32 h-32 rounded-full object-cover border-4 border-blue-50"
                    alt="Profile"
                  />
                  <label htmlFor="syndic-profile-upload" className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition-colors">
                    <Edit2 className="w-4 h-4" />
                    <input 
                      id="syndic-profile-upload" 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <span className="text-sm font-medium text-gray-600">{t('Stamp & Signature')}</span>
                <div className="relative">
                  <div className="w-32 h-32 rounded-2xl border-4 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
                    {profile.stamp_signature ? (
                      <img 
                        src={profile.stamp_signature} 
                        className="w-full h-full object-contain"
                        alt="Stamp and Signature"
                      />
                    ) : (
                      <div className="text-center text-gray-400">
                        <FileSignature className="w-8 h-8 mx-auto mb-1 opacity-50" />
                        <span className="text-xs">{t('Upload')}</span>
                      </div>
                    )}
                  </div>
                  <label htmlFor="syndic-stamp-upload" className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition-colors">
                    <Edit2 className="w-4 h-4" />
                    <input 
                      id="syndic-stamp-upload" 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleStampUpload}
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">{t('Full Name')}</label>
                <Input name="fullName" defaultValue={profile.full_name} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Email')}</label>
                <Input name="email" type="email" defaultValue={profile.email} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Phone')}</label>
                <Input name="phone" defaultValue={profile.phone || ''} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Residence Name')}</label>
                <Input name="residenceName" defaultValue={profile.residence_name || profile.residence_address} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">{t('Residence Address')}</label>
                <Input name="residenceAddress" defaultValue={profile.residence_address} />
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
            </>
          )}
        </div>

      <Modal
        isOpen={!!monthlyFeeModalType}
        onClose={() => setMonthlyFeeModalType(null)}
        title={t('Resident Monthly Fee')}
      >
        <form key={monthlyFeeModalType || 'none'} onSubmit={handleUpdateMonthlyFee} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('Monthly Fee')}</label>
            <Input 
              name="monthlyFee" 
              type="number" 
              step="any"
              defaultValue={profile?.resident_monthly_fee ?? 0} 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('Currency')}</label>
            <select name="currency" className="w-full p-2 border rounded-xl" defaultValue={profile?.currency || 'DH'} required>
              <option value="DH">DH (Dirham)</option>
              <option value="€">€ (Euro)</option>
              <option value="$">$ (Dollar)</option>
              <option value="£">£ (Pound)</option>
              <option value="SAR">SAR (Riyal)</option>
            </select>
          </div>
          <Button variant="primary" type="submit" className="w-full mt-4">
            {t('Save Changes')}
          </Button>
        </form>
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={() => { 
          setIsModalOpen(false); 
          setEditingItem(null); 
          setNextReceiptNumber(''); 
          setModalApartmentFilter('');
          setPaymentType('cash');
          setResidentError(null);
        }}
        title={editingItem ? t('Edit') : (
          activeTab === 'payments' ? t('Add') : 
          activeTab === 'expenses' ? t('Add Expense') : 
          activeTab === 'other_incomes' ? t('Add') : 
          activeTab === 'financial' ? t('Add Operation') : 
          t('Add Resident')
        )}
      >
        {activeTab === 'payments' ? (
          <form onSubmit={editingItem ? handleUpdatePayment : handleAddPayment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-full">
                <label className="block text-sm font-medium mb-1">
                  {t('Apartment')}
                </label>
                <Input 
                  placeholder={t('Apartment')} 
                  value={modalApartmentFilter} 
                  onChange={(e) => setModalApartmentFilter(e.target.value)} 
                />
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium mb-1">{t('Resident')}</label>
                <select 
                  name="residentId" 
                  className="w-full p-2 border rounded-xl" 
                  value={selectedResidentId}
                  onChange={(e) => setSelectedResidentId(e.target.value)}
                  required
                >
                  <option value="">{t('Select')}</option>
                  {(Array.isArray(residents) ? residents : [])
                    .filter(r => {
                      const aMatch = !modalApartmentFilter || (r.apartment && r.apartment.trim().toLowerCase() === modalApartmentFilter.trim().toLowerCase());
                      return aMatch;
                    })
                    .map(r => (
                    <option key={r.id} value={r.id}>{r.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Payment')}</label>
                <Input 
                  name="amount" 
                  type="number" 
                  step="any"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Date')}</label>
                <Input 
                  name="date" 
                  type="date" 
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Receipt Number')}</label>
                <Input 
                  key={`cont-${editingItem ? editingItem.id : nextReceiptNumber}`} 
                  name="receiptNumber" 
                  defaultValue={editingItem?.receipt_number || nextReceiptNumber} 
                  required 
                />
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium mb-3 text-gray-700">{t('Transaction Type')}</label>
                <div className="flex gap-8">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="radio"
                        name="paymentType"
                        value="cash"
                        checked={paymentType === 'cash'}
                        onChange={(e) => setPaymentType(e.target.value)}
                        className="peer appearance-none w-6 h-6 border-2 border-gray-300 rounded-full checked:border-blue-500 transition-all cursor-pointer"
                        required
                      />
                      <div className="absolute w-3 h-3 bg-blue-500 rounded-full transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{t('Cash Deposit')}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="radio"
                        name="paymentType"
                        value="bank"
                        checked={paymentType === 'bank'}
                        onChange={(e) => setPaymentType(e.target.value)}
                        className="peer appearance-none w-6 h-6 border-2 border-gray-300 rounded-full checked:border-blue-500 transition-all cursor-pointer"
                        required
                      />
                      <div className="absolute w-3 h-3 bg-blue-500 rounded-full transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{t('Bank Deposit')}</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 col-span-full">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Months Covered')}</label>
                  <Input 
                    name="months" 
                    value={autoMonths}
                    onChange={(e) => setAutoMonths(e.target.value)}
                    placeholder={t('Jan, Feb...')} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Year')}</label>
                  <Input 
                    name="year" 
                    value={autoYear}
                    onChange={(e) => setAutoYear(e.target.value)}
                    placeholder="2026" 
                  />
                </div>

              </div>
            </div>
            <Button variant="lightBlue" type="submit" className="w-full mt-4">
              {editingItem ? t('Save Changes') : t('Submit')}
            </Button>
          </form>
        ) : activeTab === 'other_incomes' ? (
          otherIncomeSubTab === 'rental' ? (
            <form onSubmit={editingItem ? handleUpdateRentalIncome : handleAddRentalIncome} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Property Type')}</label>
                  <select 
                    name="propertyType" 
                    className="w-full h-12 rounded-xl border border-input-border bg-white px-4 py-2 text-sm"
                    defaultValue={editingItem?.property_type || 'Apartment'}
                    required
                  >
                    <option value="Apartment">{t('Apartment')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Property Address')}</label>
                  <Input name="propertyAddress" defaultValue={editingItem?.property_address} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Tenant Name')}</label>
                  <Input name="tenantName" defaultValue={editingItem?.tenant_name} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Phone')}</label>
                  <Input name="phone" defaultValue={editingItem?.phone} required dir="ltr" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Rental Price')}</label>
                  <Input name="rentalPrice" type="number" step="any" defaultValue={editingItem?.rental_price} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Receipt Number')}</label>
                  <Input name="receiptNumber" defaultValue={editingItem?.receipt_number || nextReceiptNumber} required />
                </div>
                <div className="col-span-full">
                  <label className="block text-sm font-medium mb-3 text-gray-700">{t('Transaction Type')}</label>
                  <div className="flex gap-8">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="radio"
                          name="paymentType"
                          value="cash"
                          defaultChecked={!editingItem || editingItem.payment_type !== 'bank'}
                          className="peer appearance-none w-6 h-6 border-2 border-gray-300 rounded-full checked:border-blue-500 transition-all cursor-pointer"
                          required
                        />
                        <div className="absolute w-3 h-3 bg-blue-500 rounded-full transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{t('Cash Deposit')}</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="radio"
                          name="paymentType"
                          value="bank"
                          defaultChecked={editingItem?.payment_type === 'bank'}
                          className="peer appearance-none w-6 h-6 border-2 border-gray-300 rounded-full checked:border-blue-500 transition-all cursor-pointer"
                          required
                        />
                        <div className="absolute w-3 h-3 bg-blue-500 rounded-full transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{t('Bank Deposit')}</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 col-span-full">
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('Date')}</label>
                    <Input name="date" type="date" defaultValue={editingItem?.date || new Date().toISOString().split('T')[0]} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('Rental End Date')}</label>
                    <Input name="endDate" type="date" defaultValue={editingItem?.endDate} />
                  </div>
                </div>
              </div>
              <Button variant="lightBlue" type="submit" className="w-full mt-4">
                {editingItem ? t('Save Changes') : t('Submit')}
              </Button>
            </form>
          ) : (
            <form onSubmit={editingItem ? handleUpdateOtherIncome : handleAddOtherIncome} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Income Type')}</label>
                  <Input name="incomeType" defaultValue={editingItem?.income_type} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Contributor Name')}</label>
                  <Input name="contributorName" defaultValue={editingItem?.contributor_name} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Amount')}</label>
                  <Input name="amount" type="number" step="any" defaultValue={editingItem?.amount} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Receipt Number')}</label>
                  <Input name="receiptNumber" defaultValue={editingItem?.receipt_number || nextReceiptNumber} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Date')}</label>
                  <Input name="date" type="date" defaultValue={editingItem?.date || new Date().toISOString().split('T')[0]} required />
                </div>
                <div className="col-span-full">
                  <label className="block text-sm font-medium mb-3 text-gray-700">{t('Transaction Type')}</label>
                  <div className="flex gap-8">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="radio"
                          name="paymentType"
                          value="cash"
                          defaultChecked={!editingItem || editingItem.payment_type !== 'bank'}
                          className="peer appearance-none w-6 h-6 border-2 border-gray-300 rounded-full checked:border-blue-500 transition-all cursor-pointer"
                          required
                        />
                        <div className="absolute w-3 h-3 bg-blue-500 rounded-full transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{t('Cash Deposit')}</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="radio"
                          name="paymentType"
                          value="bank"
                          defaultChecked={editingItem?.payment_type === 'bank'}
                          className="peer appearance-none w-6 h-6 border-2 border-gray-300 rounded-full checked:border-blue-500 transition-all cursor-pointer"
                          required
                        />
                        <div className="absolute w-3 h-3 bg-blue-500 rounded-full transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{t('Bank Deposit')}</span>
                    </label>
                  </div>
                </div>
                <div className="col-span-full">
                  <label className="block text-sm font-medium mb-1">{t('Notes')}</label>
                  <textarea 
                    name="notes" 
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    defaultValue={editingItem?.notes}
                    placeholder={t('Add notes...')}
                  />
                </div>
              </div>
              <Button variant="lightBlue" type="submit" className="w-full mt-4">
                {editingItem ? t('Save Changes') : t('Submit')}
              </Button>
            </form>
          )
        ) : activeTab === 'expenses' ? (
          <form onSubmit={editingItem ? handleUpdateExpense : handleAddExpense} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('Expense Type')}</label>
                <Input name="expenseType" defaultValue={editingItem?.expense_type} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Spender')}</label>
                <Input name="spender" defaultValue={editingItem?.spender} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Amount')}</label>
                <Input name="amount" type="number" step="any" defaultValue={editingItem?.amount} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Date')}</label>
                <Input name="date" type="date" defaultValue={editingItem?.date || new Date().toISOString().split('T')[0]} required />
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium mb-1">{t('Receipt Number')}</label>
                <Input key={`exp-${editingItem ? editingItem.id : nextReceiptNumber}`} name="receiptNumber" defaultValue={editingItem?.receipt_number || nextReceiptNumber} required />
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium mb-3 text-gray-700">{t('Transaction Type')}</label>
                <div className="flex gap-8">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="radio"
                        name="paymentType"
                        value="cash"
                        defaultChecked={!editingItem || editingItem.payment_type === 'cash'}
                        className="peer appearance-none w-6 h-6 border-2 border-gray-300 rounded-full checked:border-blue-500 transition-all cursor-pointer"
                        required
                      />
                      <div className="absolute w-3 h-3 bg-blue-500 rounded-full transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{t('Cash Deposit')}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="radio"
                        name="paymentType"
                        value="bank"
                        defaultChecked={editingItem?.payment_type === 'bank'}
                        className="peer appearance-none w-6 h-6 border-2 border-gray-300 rounded-full checked:border-blue-500 transition-all cursor-pointer"
                        required
                      />
                      <div className="absolute w-3 h-3 bg-blue-500 rounded-full transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{t('Bank Deposit')}</span>
                  </label>
                </div>
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium mb-1">{t('Notes')}</label>
                <textarea 
                  name="notes" 
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  defaultValue={editingItem?.notes}
                  placeholder={t('Add notes...')}
                />
              </div>
            </div>
            <Button variant="lightBlue" type="submit" className="w-full mt-4">
              {editingItem ? t('Save Changes') : t('Submit')}
            </Button>
          </form>
        ) : activeTab === 'financial' ? (
          <form onSubmit={editingItem ? handleUpdateBankOperation : handleAddBankOperation} className="space-y-4">
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">{t('Operation Type')}</label>
                  <select 
                    name="operationType" 
                    defaultValue={editingItem?.operation_type || 'deposit'} 
                    className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                    required
                  >
                    <option value="deposit">{t('Deposit')}</option>
                    <option value="withdrawal">{t('Withdrawal')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">{t('Name')}</label>
                  <Input name="name" defaultValue={editingItem?.name} className="w-full" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">{t('Date')}</label>
                  <Input name="date" type="date" defaultValue={editingItem?.date || new Date().toISOString().split('T')[0]} className="w-full" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">{t('Amount')}</label>
                  <Input name="amount" type="number" step="0.01" defaultValue={editingItem?.amount} placeholder={t('Amount')} className="w-full" required />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2 text-gray-700">{t('Description')}</label>
                  <textarea 
                    name="description" 
                    defaultValue={editingItem?.description} 
                    className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[100px]"
                    placeholder={t('Description')}
                  />
                </div>
              </div>
            </div>
            <Button variant="lightBlue" type="submit" className="w-full py-3 text-base font-bold shadow-lg hover:shadow-xl transition-all">
              {editingItem ? t('Save Changes') : t('Submit')}
            </Button>
          </form>
        ) : (
          <form onSubmit={editingItem ? handleUpdateResident : handleAddResident} className="space-y-4">
            {residentError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-300">
                {residentError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('Full Name')}</label>
                <Input name="fullName" defaultValue={editingItem?.full_name} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('Apartment')}
                </label>
                <Input name="apartment" defaultValue={editingItem?.apartment} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Property Number')}</label>
                <Input name="propertyNumber" defaultValue={editingItem?.property_number} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Join Date')}</label>
                <Input name="joiningDate" type="date" defaultValue={editingItem?.joining_date} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Phone')}</label>
                <Input name="phone" defaultValue={editingItem?.phone} required dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Email')}</label>
                <Input name="email" type="email" defaultValue={editingItem?.email} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Password')}</label>
                <Input name="password" type="password" placeholder={editingItem ? t('Leave blank to keep current') : t('Password')} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Starting Balance')}</label>
                <Input name="currentBalance" type="number" step="any" defaultValue={editingItem?.current_balance || 0} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('Status')}</label>
                <select 
                  name="occupancyType" 
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue={editingItem?.occupancy_type || 'owner'}
                >
                  <option value="owner">{t('Owner')}</option>
                  <option value="tenant">{t('Tenant')}</option>
                </select>
              </div>
              {editingItem && (
                <div className="flex items-center gap-2 col-span-full">
                  <input type="checkbox" name="is_active" defaultChecked={editingItem.is_active === 1} />
                  <label className="text-sm font-medium">{t('Active')}</label>
                </div>
              )}
            </div>
            <Button variant="lightBlue" type="submit" className="w-full mt-4">
              {editingItem ? t('Save Changes') : t('Activate')}
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        isOpen={!!payingRental}
        onClose={() => setPayingRental(null)}
        title={t('Add Rental Payment')}
      >
        {payingRental && (
          <form onSubmit={handleRentalPayment} className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-xl mb-4">
              <p className="text-sm text-blue-800 font-medium">{t('Tenant Name')}: {payingRental.tenant_name}</p>
              <p className="text-sm text-blue-800 font-medium">{t('Rental Price')}: {formatCurrency(payingRental.rental_price, profile?.currency || 'DH')}</p>
              <p className="text-sm text-blue-800 font-medium">{t('Total Paid')}: {formatCurrency(payingRental.total_paid || 0, profile?.currency || 'DH')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('Amount')}</label>
              <Input 
                type="number" 
                step="any"
                value={rentalPaymentAmount} 
                onChange={(e) => setRentalPaymentAmount(e.target.value)} 
                required 
                placeholder={t('Amount')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('Date')}</label>
              <Input 
                type="date" 
                value={rentalPaymentDate} 
                onChange={(e) => setRentalPaymentDate(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('Receipt Number')}</label>
              <Input 
                name="receiptNumber" 
                defaultValue={nextReceiptNumber}
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-3 text-gray-700">{t('Transaction Type')}</label>
              <div className="flex gap-8">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="rentalPaymentType"
                      value="cash"
                      checked={rentalPaymentType === 'cash'}
                      onChange={(e) => setRentalPaymentType(e.target.value)}
                      className="peer appearance-none w-6 h-6 border-2 border-gray-300 rounded-full checked:border-blue-500 transition-all cursor-pointer"
                      required
                    />
                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{t('Cash Deposit')}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="rentalPaymentType"
                      value="bank"
                      checked={rentalPaymentType === 'bank'}
                      onChange={(e) => setRentalPaymentType(e.target.value)}
                      className="peer appearance-none w-6 h-6 border-2 border-gray-300 rounded-full checked:border-blue-500 transition-all cursor-pointer"
                      required
                    />
                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{t('Bank Deposit')}</span>
                </label>
              </div>
            </div>
            <Button variant="primary" type="submit" className="w-full mt-4">
              {t('Submit')}
            </Button>
          </form>
        )}
      </Modal>



      <Modal
        isOpen={!!editingRentalPayment}
        onClose={() => setEditingRentalPayment(null)}
        title={t('Edit Rental Payment')}
      >
        <form onSubmit={handleUpdateRentalPayment} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('Amount')}</label>
            <Input 
              type="number" 
              value={rentalPaymentAmount}
              onChange={(e) => setRentalPaymentAmount(e.target.value)}
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t('Transaction Type')}</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="editRentalPaymentType"
                  value="cash"
                  checked={rentalPaymentType === 'cash'}
                  onChange={(e) => setRentalPaymentType(e.target.value)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">{t('Cash Deposit')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="editRentalPaymentType"
                  value="bank"
                  checked={rentalPaymentType === 'bank'}
                  onChange={(e) => setRentalPaymentType(e.target.value)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">{t('Bank Deposit')}</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('Date')}</label>
            <Input 
              type="date" 
              value={rentalPaymentDate}
              onChange={(e) => setRentalPaymentDate(e.target.value)}
              required 
            />
          </div>
          <Button variant="primary" type="submit" className="w-full mt-4">
            {t('Save Changes')}
          </Button>
        </form>
      </Modal>


      <div style={{ display: 'none' }}>
        <div id="hidden-receipt-template">
          {directPrintPayment && (
            <ReceiptTemplate 
              profile={profile} 
              payment={directPrintPayment} 
              type="payment" 
              customStyles={profile?.receipt_settings ? JSON.parse(profile.receipt_settings) : undefined}
            />
          )}
          {directPrintProjectPayment && (
            <ReceiptTemplate 
              profile={profile} 
              payment={directPrintProjectPayment} 
              type="project_payment" 
              projectName={directPrintProjectPayment.project_name}
              customStyles={profile?.receipt_settings ? JSON.parse(profile.receipt_settings) : undefined}
            />
          )}
          {directPrintOtherIncome && (
            <ReceiptTemplate 
              profile={profile} 
              payment={directPrintOtherIncome} 
              type="other_income" 
              customStyles={profile?.receipt_settings ? JSON.parse(profile.receipt_settings) : undefined}
            />
          )}
          {directPrintRentalPayment && (
            <ReceiptTemplate 
              profile={profile} 
              payment={directPrintRentalPayment} 
              type="other_income" 
              customStyles={profile?.receipt_settings ? JSON.parse(profile.receipt_settings) : undefined}
            />
          )}
        </div>
      </div>

      <div style={{ display: 'none' }}>
        <div id="certificate-print-template">
          {printingCertificate && (
            <div>
              <div className="header">
                <div className="logo-container">
                  {profile?.profile_picture ? (
                    <img src={profile.profile_picture} alt="Logo" className="logo" />
                  ) : (
                    <div className="logo bg-blue-50 flex items-center justify-center">
                      <Building2 className="w-16 h-16 text-blue-600" />
                    </div>
                  )}
                </div>
                <div className="residence-header-info">
                  <div className="residence-name-row">
                    {profile?.residence_name} — Résidence
                  </div>
                  <div className="address-bar">{profile?.residence_address}</div>
                </div>
              </div>

              <div className="title-gray-section">
                <div className="title-content">
                  <h1 className="main-title">{t('Certificate of No Dues')}</h1>
                  <div className="sub-title">
                    Attestation de libération des charges
                  </div>
                </div>
                <div className="date-section">
                  <div className="date-label">{t('Date')}</div>
                  <div className="date-value">{new Date().toLocaleDateString('fr-FR')}</div>
                </div>
              </div>

              <div className="info-grid">
                <div className="info-column">
                  <h3>{t('Syndicate Information')}</h3>
                  <div className="info-row">
                    <span className="info-label">{t('Residence Name')}:</span>
                    <span className="info-value">{profile?.residence_name}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{t('Address')}:</span>
                    <span className="info-value">{profile?.residence_address}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{t('Syndic Name')}:</span>
                    <span className="info-value">{profile?.full_name}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{t('Phone')}:</span>
                    <span className="info-value">{profile?.phone}</span>
                  </div>
                </div>
                <div className="info-column">
                  <h3>{t('Payer Information')}</h3>
                  <div className="info-row">
                    <span className="info-label">{t('Full Name')}:</span>
                    <span className="info-value">{printingCertificate.full_name}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{t('Apartment')}:</span>
                    <span className="info-value">{printingCertificate.apartment}</span>
                  </div>
                  {printingCertificate.building && (
                    <div className="info-row">
                      <span className="info-label">{t('Building')}:</span>
                      <span className="info-value">{printingCertificate.building}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="declaration-box">
                <div className="declaration-title">Attestation</div>
                <div className="declaration-text">
                  {`Je soussigné, ${profile?.full_name}, en ma qualité de syndic de la résidence mentionnée ci-dessus, certifie que le copropriétaire mentionné ci-dessus a payé toutes les charges de copropriété jusqu'à la date de cette attestation.`}
                </div>
              </div>

              <div className="financial-section">
                <div className="section-title">Situation Financière</div>
                <div className="financial-card">
                  <div className="financial-row">
                    <span className="financial-label">{t('Current Balance')}</span>
                    <span className="financial-value">{formatCurrency(printingCertificate.current_balance, profile?.currency || 'DH')}</span>
                  </div>
                  {printingCertificate.current_balance > 0 && (
                    <div className="financial-row">
                      <span className="credit-badge">
                        Solde créditeur en faveur du propriétaire
                      </span>
                    </div>
                  )}
                  <div className="financial-row">
                    <span className="financial-label">
                      Montant du solde créditeur
                    </span>
                    <span className="financial-value" style={{ color: '#3b82f6' }}>{formatCurrency(printingCertificate.current_balance > 0 ? printingCertificate.current_balance : 0, profile?.currency || 'DH')}</span>
                  </div>
                </div>
              </div>

              <div className="validity-box">
                <div className="validity-title">Note de Validité</div>
                <div className="validity-text">
                  Cette attestation est valable à la date de sa délivrance, elle ne comprend pas les charges futures qui pourraient être dues après cette date. Pour toute transaction immobilière, il est conseillé de demander une attestation mise à jour.
                </div>
              </div>

              <div className="signature-section">
                <div className="signature-title">{t('Stamp and Signature')}</div>
                <div className="signature-area">
                  {profile?.stamp_signature && (
                    <img src={profile.stamp_signature} alt="Stamp" className="stamp-img" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </DashboardLayout>
      <Modal
        isOpen={isInitialBalanceModalOpen}
        onClose={() => setIsInitialBalanceModalOpen(false)}
        title={
          initialBalanceType === 'bank' ? t('Initial Bank Balance') : 
          initialBalanceType === 'cashbox' ? t('Initial Cash Box Balance') : 
          initialBalanceType === 'uncollected' ? t('Initial Uncollected Balance') : 
          t('Initial Unpaid Balance')
        }
      >
        <form onSubmit={handleUpdateInitialBalance} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-blue-900">
              {t('Amount')} ({profile?.currency || 'DH'})
            </label>
            <Input
              type="number"
              step="0.01"
              value={initialBalanceValue}
              onChange={(e) => setInitialBalanceValue(e.target.value)}
              placeholder="0.00"
              required
              className="bg-blue-50 border-blue-100"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsInitialBalanceModalOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button type="submit" variant="primary">
              {t('Save Changes')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
      />
    </>
  );
}
