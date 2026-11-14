import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LogOut, Menu, X, Bell, ChevronDown, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  isSubItem?: boolean;
  toggleOnly?: boolean;
  subItems?: SidebarItem[];
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: React.ReactNode;
  sidebarItems: SidebarItem[];
  headerContent?: React.ReactNode;
  onNotificationClick?: () => void;
  onProfileClick?: () => void;
  onLogoClick?: () => void;
}

import { BottomNav } from './BottomNav';

export function DashboardLayout({ children, title, sidebarItems, headerContent, onNotificationClick, onProfileClick, onLogoClick }: DashboardLayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [userInfo, setUserInfo] = React.useState({ name: '', picture: '', role: '' });
  const [unreadCount, setUnreadCount] = React.useState(0);

  const [openSubMenu, setOpenSubMenu] = React.useState<number | null>(null);
  const isRtl = false;

  React.useEffect(() => {
    document.title = 'Résidance Ennasr';
  }, []);

  // Filter items for bottom nav (max 5)
  const bottomNavItems = sidebarItems
    .filter(item => !item.isSubItem && !item.toggleOnly)
    .slice(0, 5)
    .map(item => ({
      icon: item.icon,
      label: item.label,
      onClick: item.onClick,
      isActive: item.isActive
    }));

  React.useEffect(() => {
    const fetchProfile = async () => {
      const userId = localStorage.getItem('userId');
      const userRole = localStorage.getItem('userRole');
      if (userId && userId !== 'undefined' && userId !== 'null' && userRole) {
        try {
          let url = '';
          if (userRole === 'resident') {
            url = `/api/resident/profile/${userId}`;
          } else if (userRole === 'syndic') {
            url = `/api/syndic/profile/${userId}`;
          }

          if (url) {
            const res = await fetch(url);
            const contentType = res.headers.get('content-type');
            if (res.ok && contentType && contentType.includes('application/json')) {
              const data = await res.json();
              if (data && data.full_name) {
                setUserInfo({
                  name: data.full_name,
                  picture: data.profile_picture || '',
                  role: userRole
                });
              }
            }
          } else {
            setUserInfo(prev => ({ ...prev, role: userRole }));
          }
        } catch (err) {
          // Ignore network glitch or aborted fetch
        }

        try {
          const res = await fetch(`/api/notifications/unread-count/${userId}`);
          const contentType = res.headers.get('content-type');
          if (res.ok && contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (typeof data?.count === 'number') {
              setUnreadCount(data.count);
            }
          }
        } catch (err) {
          // Ignore network glitch or aborted fetch
        }
      }
    };

    fetchProfile();
    const interval = setInterval(fetchProfile, 30000); // Poll every 30 seconds

    window.addEventListener('profileUpdated', fetchProfile);
    return () => {
      window.removeEventListener('profileUpdated', fetchProfile);
      clearInterval(interval);
    };
  }, []);



  return (
    <div className={`h-screen overflow-hidden bg-app-bg flex transition-colors duration-200`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={`fixed top-0 bottom-0 z-50 w-64 bg-sidebar-bg border-r border-card-border text-sidebar-text flex flex-col transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 print:hidden ${
          isSidebarOpen 
            ? 'translate-x-0' 
            : isRtl ? 'translate-x-full' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <h2 
            className={`text-2xl font-bold tracking-tight text-header-bg ${onLogoClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={onLogoClick}
          >
            Résidance Ennasr
          </h2>
          <button className="lg:hidden text-app-text" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
          <nav className="px-4 py-6 space-y-1">
            {sidebarItems.map((item, index) => (
              <div key={index} className="relative">
                <button
                  onClick={() => {
                    if (item.subItems) {
                      setOpenSubMenu(openSubMenu === index ? null : index);
                    } else {
                      item.onClick();
                      if (!item.toggleOnly) setIsSidebarOpen(false);
                    }
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    item.isActive 
                      ? 'bg-btn-secondary text-btn-secondary-text shadow-sm' 
                      : 'text-sidebar-text hover:bg-gray-100 dark:hover:bg-white/10'
                  } ${item.isSubItem ? (isRtl ? 'pr-8' : 'pl-8') : ''}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`shrink-0 ${item.isActive ? 'text-btn-secondary-text' : 'text-icon'}`}>{item.icon}</span>
                    <span className={`font-normal text-start break-words whitespace-normal leading-tight ${item.isSubItem ? 'text-xs' : 'text-sm'}`}>{item.label}</span>
                  </div>
                  {item.subItems && (
                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${openSubMenu === index ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {item.subItems && openSubMenu === index && (
                  <div className="pt-1 space-y-1 bg-gray-50 dark:bg-[#525252] rounded-xl mt-1">
                    {item.subItems.map((subItem, subIndex) => (
                      <button
                        key={subIndex}
                        onClick={() => {
                          subItem.onClick();
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-200 ${
                          subItem.isActive 
                            ? 'bg-btn-secondary text-btn-secondary-text' 
                            : 'text-sidebar-text hover:bg-gray-100 dark:hover:bg-white/10'
                        } ${isRtl ? 'pr-10' : 'pl-10'}`}
                      >
                        <span className="text-xs shrink-0">{subItem.icon}</span>
                        <span className="text-xs font-normal text-start break-words whitespace-normal leading-tight flex-1 min-w-0">{subItem.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="px-4 pb-6">
            <div className="pt-4 border-t border-card-border">
              <button
                onClick={() => {
                  localStorage.removeItem('userRole');
                  localStorage.removeItem('userId');
                  localStorage.removeItem('syndicAuth');
                  window.dispatchEvent(new Event('authChanged'));
                  navigate('/');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">{t('Logout')}</span>
              </button>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
        <header className="bg-header-bg border-b border-white/10 p-4 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-md print:hidden">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 text-header-text hover:bg-white/10 rounded-lg"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-header-text hidden lg:block">
              {typeof title === 'string' ? title : title}
            </h1>
          </div>
          
          <div className={`flex items-center gap-2 md:gap-4 ${isRtl ? 'mr-auto' : 'ml-auto'} shrink-0`}>
            
            {/* Notification Bell */}
            {onNotificationClick && (
              <div className="relative">
                <button 
                  className="p-2 text-header-text hover:bg-white/10 rounded-full transition-colors"
                  onClick={() => {
                    onNotificationClick();
                    
                    // Clear unread notifications on server
                    const userId = localStorage.getItem('userId');
                    if (userId) {
                      setUnreadCount(0);
                      fetch(`/api/notifications/read-all/${userId}`, { method: 'PUT' })
                        .catch(err => console.error('Error marking notifications as read:', err));
                    }
                  }}
                >
                  <Bell className="w-6 h-6" />
                </button>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-header-bg"></span>
                )}
              </div>
            )}

            {/* Consolidated User Profile & Time */}
            <div className="flex items-center pl-2 border-l border-white/10">
              <div 
                className="flex flex-col items-center justify-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={onProfileClick}
              >
                <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden flex items-center justify-center shadow-sm">
                  {userInfo.picture ? (
                    <img src={userInfo.picture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-white" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <div className="flex-1 p-4 md:p-6 pb-24 lg:pb-6 overflow-auto bg-app-bg transition-colors duration-200">
          <div className="max-w-7xl mx-auto text-app-text">
            {children}
          </div>
        </div>
        <BottomNav items={bottomNavItems} />
      </main>
    </div>
  );
}
