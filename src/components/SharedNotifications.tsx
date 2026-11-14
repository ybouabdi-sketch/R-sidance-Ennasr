import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Plus, Send, CheckCircle2, Clock, AlertCircle, Trash2, Settings, Inbox } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';

interface Announcement {
  id: number;
  title: string;
  message: string;
  created_at: string;
}

interface Complaint {
  id: number;
  subject: string;
  description: string;
  status: 'pending' | 'in_progress' | 'resolved';
  answer?: string;
  created_at: string;
  resident_name?: string;
}

interface UnpaidResident {
  id: number;
  full_name: string;
  building?: string;
  apartment?: string;
  phone?: string;
  balance: number;
  status: string;
  automatic_reminders_enabled?: number;
}

interface AutomaticReminder {
  id: number;
  syndic_id: number;
  resident_id: number;
  message: string;
  created_at: string;
  resident_name?: string;
  building?: string;
  apartment?: string;
  syndic_name?: string;
}

interface SharedNotificationsProps {
  userRole: 'syndic' | 'resident';
  announcements: Announcement[];
  complaints: Complaint[];
  unpaidResidents?: UnpaidResident[];
  automaticReminders?: AutomaticReminder[];
  currency?: string;
  onAddAnnouncement: (title: string, message: string) => void;
  onAddComplaint: (subject: string, description: string) => void;
  onUpdateComplaintStatus: (id: number, status: 'pending' | 'in_progress') => void;
  onUpdateComplaintAnswer: (id: number, answer: string) => void;
  onDeleteAnnouncement?: (id: number) => void;
  onDeleteComplaint?: (id: number) => void;
  onDeleteAutomaticReminder?: (id: number) => void;
  onClearAllAutomaticReminders?: () => void;
  onRefresh?: () => void;
  activeSubTab?: 'announcements' | 'complaints' | 'reminders' | 'notifications';
  onSubTabChange?: (tab: 'announcements' | 'complaints' | 'reminders' | 'notifications') => void;
  hideTabs?: boolean;
}

export function SharedNotifications({
  userRole,
  announcements,
  complaints,
  unpaidResidents = [],
  automaticReminders = [],
  currency = 'DH',
  onAddAnnouncement,
  onAddComplaint,
  onUpdateComplaintStatus,
  onUpdateComplaintAnswer,
  onDeleteAnnouncement,
  onDeleteComplaint,
  onDeleteAutomaticReminder,
  onClearAllAutomaticReminders,
  onRefresh,
  activeSubTab: externalSubTab,
  onSubTabChange: onExternalSubTabChange,
  hideTabs = false,
}: SharedNotificationsProps) {
  const { t } = useTranslation();
  const [internalSubTab, setInternalSubTab] = useState<'announcements' | 'complaints' | 'reminders' | 'notifications'>('announcements');
  const activeSubTab = externalSubTab || internalSubTab;
  const setActiveSubTab = onExternalSubTabChange || setInternalSubTab;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState('');
  
  // Reminder settings state
  const [reminderSettings, setReminderSettings] = useState({
    messageTemplate: 'Bonjour {{name}}, nous vous rappelons que vous avez un solde impayé de {{amount}} DH. Merci de régulariser votre situation dans les plus brefs délais.',
    deadlineDay: 5,
    daysBetween: 3,
    maxTimes: 3
  });

  const [selectedResidents, setSelectedResidents] = useState<number[]>([]);

  useEffect(() => {
    if (userRole === 'syndic') {
      const syndicId = localStorage.getItem('userId');
      if (syndicId) {
        fetch(`/api/syndic/reminder-settings/${syndicId}`)
          .then(res => res.json())
          .then(data => {
            if (data) {
              setReminderSettings({
                messageTemplate: data.reminder_message_template || 'Bonjour {{name}}, nous vous rappelons que vous avez un solde impayé de {{amount}} DH. Merci de régulariser votre situation dans les plus brefs délais.',
                deadlineDay: data.reminder_deadline_day || 5,
                daysBetween: data.reminder_days_between || 3,
                maxTimes: data.reminder_max_times || 3
              });
            }
          })
          .catch(err => console.error('Error fetching reminder settings:', err));
      }
    }
  }, [userRole]);

  const handleSaveSettings = async () => {
    try {
      const syndicId = localStorage.getItem('userId');
      await fetch(`/api/syndic/reminder-settings/${syndicId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminderSettings)
      });
      setIsSettingsModalOpen(false);
    } catch (error) {
      console.error('Error saving reminder settings:', error);
    }
  };

  const handleSelectAll = () => {
    if (unpaidResidents) {
      if (selectedResidents.length === unpaidResidents.length) {
        setSelectedResidents([]);
      } else {
        setSelectedResidents(unpaidResidents.map(r => r.id));
      }
    }
  };

  const handleSelectResident = (id: number) => {
    setSelectedResidents(prev => 
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };

  const sendReminder = async (id: number) => {
    const resident = unpaidResidents?.find(r => r.id === id);
    if (!resident) return;

    const message = reminderSettings.messageTemplate
      .replace('{{name}}', resident.full_name)
      .replace('{{amount}}', Math.abs(resident.balance).toString());

    try {
      const syndicId = localStorage.getItem('userId');
      await fetch('/api/syndic/bulk-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syndicId: Number(syndicId),
          reminders: [{ residentId: id, message }]
        })
      });
      if (onRefresh) onRefresh();
      alert(t('Reminder sent successfully'));
    } catch (error) {
      console.error('Error sending reminder:', error);
      alert(t('Failed to send reminder'));
    }
  };

  const sendBulkReminders = async () => {
    if (selectedResidents.length === 0 || !unpaidResidents) return;

    const reminders = selectedResidents.map(id => {
      const resident = unpaidResidents.find(r => r.id === id);
      if (!resident) return null;
      return {
        residentId: id,
        message: reminderSettings.messageTemplate
          .replace('{{name}}', resident.full_name)
          .replace('{{amount}}', Math.abs(resident.balance).toString())
      };
    }).filter(Boolean);

    try {
      const syndicId = localStorage.getItem('userId');
      await fetch('/api/syndic/bulk-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syndicId: Number(syndicId),
          reminders
        })
      });
      setSelectedResidents([]);
      if (onRefresh) onRefresh();
      alert(t('Reminders sent successfully'));
    } catch (error) {
      console.error('Error sending bulk reminders:', error);
      alert(t('Failed to send reminders'));
    }
  };

  const handleSend = () => {
    if (activeSubTab === 'announcements') {
      onAddAnnouncement(title, message);
    } else {
      onAddComplaint(title, message);
    }
    setTitle('');
    setMessage('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {!hideTabs && (
        <div className="flex gap-6 border-b border-gray-100 mb-6 px-4">
          <button
            onClick={() => setActiveSubTab('announcements')}
            className={`pb-4 px-2 text-sm font-medium transition-all relative ${
              activeSubTab === 'announcements' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('Announcements')}
            {activeSubTab === 'announcements' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('complaints')}
            className={`pb-4 px-2 text-sm font-medium transition-all relative ${
              activeSubTab === 'complaints' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('Complaints')}
            {activeSubTab === 'complaints' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('notifications')}
            className={`pb-4 px-2 text-sm font-medium transition-all relative ${
              activeSubTab === 'notifications' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('System Notifications')}
            {activeSubTab === 'notifications' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
          {userRole === 'syndic' && (
            <button
              onClick={() => setActiveSubTab('reminders')}
              className={`pb-4 px-2 text-sm font-medium transition-all relative ${
                activeSubTab === 'reminders' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('Automatic Reminders')}
              {activeSubTab === 'reminders' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          )}
        </div>
      )}

      {activeSubTab === 'announcements' && (
        <div className="space-y-4">
          {userRole === 'syndic' && (
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('Add Announcement')}
            </Button>
          )}
          <div className="grid gap-4">
            {announcements.map(a => (
              <div key={a.id} className="p-4 bg-white dark:bg-[#525252] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 relative">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg dark:text-white">{a.title}</h3>
                    <p className="text-gray-600 dark:text-white">{a.message}</p>
                    <span className="text-xs text-gray-400 dark:text-gray-400">{new Date(a.created_at).toLocaleDateString()}</span>
                  </div>
                  {onDeleteAnnouncement && (
                    <button 
                      onClick={() => onDeleteAnnouncement(a.id)}
                      className="text-red-500 hover:text-red-700 p-2"
                      title={t('Delete')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'complaints' && (
        <div className="space-y-4">
          {userRole === 'resident' && (
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('New Complaint')}
            </Button>
          )}
          <table className="w-full bg-white dark:bg-[#525252] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <thead className="bg-sky-100 text-gray-900 text-base font-black uppercase tracking-wider">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-4 text-left dark:text-white">{t('Complaint')}</th>
                <th className="p-4 text-left dark:text-white">{t('Date')}</th>
                <th className="p-4 text-left dark:text-white">{t('Status')}</th>
                <th className="p-4 text-left dark:text-white">{t('Answer')}</th>
                {onDeleteComplaint && <th className="p-4 text-center dark:text-white">{t('Actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {complaints.map(c => (
                <tr key={c.id} className="border-b border-gray-200 dark:border-gray-700">
                  <td className="p-4">
                    <p className="font-bold dark:text-white">{c.subject}</p>
                    <p className="text-sm text-gray-600 dark:text-white">{c.description}</p>
                  </td>
                  <td className="p-4 dark:text-white">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="p-4">
                    {userRole === 'syndic' ? (
                      <button 
                        onClick={() => onUpdateComplaintStatus(c.id, c.status === 'pending' ? 'in_progress' : 'pending')}
                        className={`px-2 py-1 rounded-full text-xs ${c.status === 'pending' ? 'bg-yellow-100' : 'bg-green-100'}`}
                      >
                        {t(c.status)}
                      </button>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs ${c.status === 'pending' ? 'bg-yellow-100' : 'bg-green-100'}`}>
                        {t(c.status)}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {userRole === 'syndic' ? (
                      <Input 
                        value={c.answer || ''} 
                        onChange={(e) => onUpdateComplaintAnswer(c.id, e.target.value)}
                        placeholder={t('Enter answer')}
                      />
                    ) : (
                      <span>{c.answer}</span>
                    )}
                  </td>
                  {onDeleteComplaint && (
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => onDeleteComplaint(c.id)}
                        className="text-red-500 hover:text-red-700 p-2"
                        title={t('Delete')}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'reminders' && userRole === 'syndic' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleSelectAll}
              >
                {unpaidResidents && selectedResidents.length === unpaidResidents.length && unpaidResidents.length > 0 ? t('Deselect All') : t('Select All')}
              </Button>
              <Button 
                size="sm" 
                disabled={selectedResidents.length === 0}
                onClick={sendBulkReminders}
              >
                <Send className="w-4 h-4 mr-2" />
                {t('Send to Selected')}
              </Button>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {selectedResidents.length} {t('selected')}
              </span>
            </div>
            <Button onClick={() => setIsSettingsModalOpen(true)} variant="secondary">
              <Settings className="w-4 h-4 mr-2" />
              {t('Notification Settings')}
            </Button>
          </div>
          <table className="w-full bg-white dark:bg-[#525252] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <thead className="bg-sky-100 text-gray-900 text-base font-black uppercase tracking-wider">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    checked={unpaidResidents && selectedResidents.length === unpaidResidents.length && unpaidResidents.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="p-4 text-left dark:text-white">{t('Full Name')}</th>
                <th className="p-4 text-left dark:text-white">{t('Apartment')}</th>
                <th className="p-4 text-left dark:text-white">{t('Balance')}</th>
                <th className="p-4 text-center dark:text-white">{t('Action')}</th>
              </tr>
            </thead>
            <tbody>
              {unpaidResidents.map(r => (
                <tr key={r.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors">
                  <td className="p-4 text-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      checked={selectedResidents.includes(r.id)}
                      onChange={() => handleSelectResident(r.id)}
                    />
                  </td>
                  <td className="p-4 font-bold dark:text-white">{r.full_name}</td>
                  <td className="p-4 dark:text-white">{r.apartment || '-'}</td>
                  <td className="p-4 text-red-600 font-bold">{Math.abs(r.balance).toLocaleString()} {currency}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-4">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => sendReminder(r.id)}
                        title={t('Send Reminder')}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      >
                        <Bell className="w-4 h-4" />
                      </Button>
                      {r.phone && (
                        <a 
                          href={`https://wa.me/${r.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            reminderSettings.messageTemplate
                              .replace('{{name}}', r.full_name)
                              .replace('{{amount}}', Math.abs(r.balance).toString())
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-500 hover:text-green-600 transition-colors"
                          title={t('Send WhatsApp Message Now')}
                        >
                          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {unpaidResidents.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    {t('No unpaid residents found')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'notifications' && (
        <div className="space-y-4">
          {userRole === 'syndic' ? (
            <div className="space-y-4">
              {onClearAllAutomaticReminders && automaticReminders.length > 0 && (
                <div className="flex justify-end">
                  <Button 
                    variant="secondary" 
                    onClick={onClearAllAutomaticReminders}
                    className="text-red-600 border-red-100 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('Clear All')}
                  </Button>
                </div>
              )}
              <div className="overflow-x-auto bg-white dark:bg-[#525252] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                  <thead className="text-xs text-gray-700 uppercase bg-sky-100 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                      <th className="px-6 py-3">{t('Resident')}</th>
                      <th className="px-6 py-3">{t('Apartment')}</th>
                      <th className="px-6 py-3">{t('Send Date')}</th>
                      <th className="px-6 py-3 text-center">{t('Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {automaticReminders.map(r => (
                      <tr key={r.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{r.resident_name}</td>
                        <td className="px-6 py-4">{r.apartment || '-'}</td>
                        <td className="px-6 py-4">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="px-6 py-4 text-center">
                          {onDeleteAutomaticReminder && (
                            <button 
                              onClick={() => onDeleteAutomaticReminder(r.id)}
                              className="text-red-500 hover:text-red-700 p-2"
                              title={t('Delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {automaticReminders.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                          {t('No notifications found')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {automaticReminders.map(r => (
                <div key={r.id} className="p-4 bg-white dark:bg-[#525252] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 relative">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{t('Automatic Reminder')}</h3>
                        <p className="text-gray-600 dark:text-gray-300 text-sm whitespace-pre-wrap">{r.message}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(r.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {automaticReminders.length === 0 && (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  {t('No notifications found')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={activeSubTab === 'announcements' ? t('Add Announcement') : t('New Complaint')}>
        <div className="space-y-4">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('Subject')} />
          <textarea 
            value={message} 
            onChange={e => setMessage(e.target.value)} 
            className="w-full p-2 border rounded" 
            placeholder={t('Description')}
            rows={4}
          />
          <Button onClick={handleSend}>{t('Send')}</Button>
        </div>
      </Modal>

      <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title={t('Notification Settings')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('Message Template')}</label>
            <textarea 
              value={reminderSettings.messageTemplate} 
              onChange={e => setReminderSettings({...reminderSettings, messageTemplate: e.target.value})} 
              className="w-full p-2 border rounded" 
              rows={4}
            />
            <p className="text-xs text-gray-500 mt-1">{t('Use {{name}} for resident name and {{amount}} for unpaid balance')}</p>
          </div>
          <Button onClick={handleSaveSettings} className="w-full">{t('Save Settings')}</Button>
        </div>
      </Modal>
    </div>
  );
}
