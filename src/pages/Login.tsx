import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail, Lock, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { motion } from 'motion/react';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginConfig, setLoginConfig] = useState<any>(null);

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/settings/login-page')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load login config');
        return res.json();
      })
      .then(data => {
        setLoginConfig(data);
        if (data?.appName) {
          document.title = data.appName;
        }
      })
      .catch(err => console.error('Failed to load login config:', err));
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const formData = new FormData(e.target as HTMLFormElement);
    const identifier = String(formData.get('identifier') || '').trim();
    const password = String(formData.get('password') || '');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('userRole', data.role);
        localStorage.setItem('userId', data.id.toString());

        if (data.role === 'syndic') {
          localStorage.setItem('syndicAuth', '1');
          window.dispatchEvent(new Event('authChanged'));
          window.dispatchEvent(new Event('profileUpdated'));
          navigate('/');
        } else if (data.role === 'resident') {
          localStorage.removeItem('syndicAuth');
          window.dispatchEvent(new Event('authChanged'));
          window.dispatchEvent(new Event('profileUpdated'));
          navigate('/resident');
        }
      } else {
        setError(t('Invalid credentials or account not active'));
      }
    } catch (err) {
      setError(t('An error occurred during login'));
    } finally {
      setLoading(false);
    }
  };

  const isDark = document.documentElement.classList.contains('dark');

  const bgColor = isDark ? loginConfig?.global?.darkBgColor : loginConfig?.global?.bgColor;
  const cardBgColor = isDark ? loginConfig?.global?.darkCardBgColor : loginConfig?.global?.cardBgColor;
  const inputBgColor = isDark ? loginConfig?.global?.darkInputBgColor : loginConfig?.global?.inputBgColor;
  const buttonBgColor = loginConfig?.global?.buttonBgColor;
  const buttonTextColor = loginConfig?.global?.buttonTextColor;
  const textColor = isDark ? loginConfig?.global?.darkTextColor : loginConfig?.global?.textColor;
  const fontFamily = loginConfig?.global?.fontFamily;
  const buttonSize = loginConfig?.global?.buttonSize;
  const buttonWeight = loginConfig?.global?.buttonWeight;

  const appName = loginConfig?.appName || 'Résidance Ennasr';
  const showLogo = loginConfig?.showLogo !== false;
  const showAppName = loginConfig?.showAppName !== false;
  const logoUrl = loginConfig?.logoUrl;

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-200" 
      dir="ltr"
      style={{ 
        backgroundColor: bgColor || (isDark ? '#020617' : '#F8FAFC'),
        fontFamily: fontFamily || 'inherit'
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[440px]"
      >
        {/* Logo & Header */}
        <div className="text-center mb-10">
          {showLogo && (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-xl shadow-blue-200 mb-6 overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-10 h-10 text-white" />
              )}
            </div>
          )}
          {showAppName && (
            <h1 
              className="text-3xl font-bold mb-2"
              style={{ color: textColor || (isDark ? '#FFFFFF' : '#0F172A') }}
            >
              {appName}
            </h1>
          )}
        </div>

        {/* Login Card */}
        <div 
          className="p-8 md:p-10 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-800"
          style={{ backgroundColor: cardBgColor || (isDark ? '#0F172A' : '#FFFFFF') }}
        >
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label 
                className="text-sm font-semibold block px-1"
                style={{ color: textColor || (isDark ? '#CBD5E1' : '#334155') }}
              >
                {t('Email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  name="identifier"
                  type="text"
                  required
                  placeholder={t('Email Placeholder')}
                  className="pl-12 h-12 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 rounded-xl transition-all"
                  style={{ 
                    backgroundColor: inputBgColor || (isDark ? '#1E293B' : '#F8FAFC'),
                    color: textColor || (isDark ? '#FFFFFF' : '#0F172A')
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label 
                  className="text-sm font-semibold block"
                  style={{ color: textColor || (isDark ? '#CBD5E1' : '#334155') }}
                >
                  {t('Password')}
                </label>
                <button type="button" onClick={() => setIsForgotModalOpen(true)} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                  {t('Forgot password?')}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  name="password"
                  type="password"
                  required
                  placeholder={t('Password Placeholder')}
                  className="pl-12 h-12 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 rounded-xl transition-all"
                  style={{ 
                    backgroundColor: inputBgColor || (isDark ? '#1E293B' : '#F8FAFC'),
                    color: textColor || (isDark ? '#FFFFFF' : '#0F172A')
                  }}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group"
              style={{
                backgroundColor: buttonBgColor || '#2563EB',
                color: buttonTextColor || '#FFFFFF',
                fontSize: buttonSize || '18px',
                fontWeight: buttonWeight || 'bold'
              }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {t('Login')}
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title={t('Recover Password')}
      >
        <div className="py-6 text-center space-y-6">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          
          <p className="text-lg font-medium text-slate-700 dark:text-slate-200 px-4">
            {t('Please contact the syndic to recover your password. Thank you.')}
          </p>

          <Button 
            onClick={() => setIsForgotModalOpen(false)} 
            className="w-full h-12 rounded-xl"
            style={{ backgroundColor: buttonBgColor || '#2563EB' }}
          >
            {t('OK')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
