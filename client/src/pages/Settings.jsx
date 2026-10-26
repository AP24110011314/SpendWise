import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { User, Key, Moon, Sun, CheckCircle, AlertCircle, Monitor } from 'lucide-react';
import { CURRENCIES, TIMEZONES } from '@/lib/constants';
import toast from 'react-hot-toast';

const profileSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .regex(/^[a-zA-Z0-9\s\-']+$/, 'Name can only contain letters, numbers, spaces, hyphens, and apostrophes'),
  currency: z.string().min(1, 'Currency is required'),
  timezone: z.string().min(1, 'Timezone is required'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or less')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export default function Settings() {
  const { user, updateUser, changePassword } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);

  const { register: registerProfile, handleSubmit: handleSubmitProfile, reset: resetProfile, formState: { errors: profileErrors, isSubmitted: profileSubmitted } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      currency: user?.currency || 'INR',
      timezone: user?.timezone || 'Asia/Kolkata',
    },
  });

  const { register: registerPassword, handleSubmit: handleSubmitPassword, reset: resetPassword, formState: { errors: passwordErrors } } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmitProfile = async (data) => {
    setIsLoading(true);
    try {
      await updateUser(data);
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const [securityStatus, setSecurityStatus] = useState({ success: '', error: '' });

  const onSubmitPassword = async (data) => {
    setIsLoading(true);
    setSecurityStatus({ success: '', error: '' });
    try {
      await changePassword(data.currentPassword, data.newPassword);
      setSecurityStatus({ success: 'Password changed successfully!', error: '' });
      toast.success('Password changed successfully!');
      resetPassword();
    } catch (err) {
      const errMsg = err.message || err.details?.body?.[0] || 'Failed to change password';
      setSecurityStatus({ success: '', error: errMsg });
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {[
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'security', label: 'Security', icon: Key },
          { id: 'appearance', label: 'Appearance', icon: Moon },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile</h2>
          <form onSubmit={handleSubmitProfile(onSubmitProfile)} className="space-y-4">
            <Input
              label="Name"
              {...registerProfile('name')}
              disabled={isLoading}
            />
            {profileSubmitted && profileErrors.name && (
              <p className="text-sm text-red-600 dark:text-red-400">{profileErrors.name.message}</p>
            )}

            <Input
              label="Email"
              type="email"
              defaultValue={user?.email}
              disabled
              helperText="Email cannot be changed"
            />

            <Select
              label="Currency"
              options={CURRENCIES.map(c => ({ value: c.code, label: `${c.name} (${c.symbol})` }))}
              {...registerProfile('currency')}
              disabled={isLoading}
            />
            {profileSubmitted && profileErrors.currency && (
              <p className="text-sm text-red-600 dark:text-red-400">{profileErrors.currency.message}</p>
            )}

            <Select
              label="Timezone"
              options={TIMEZONES.map(tz => ({ value: tz, label: tz }))}
              {...registerProfile('timezone')}
              disabled={isLoading}
            />
            {profileSubmitted && profileErrors.timezone && (
              <p className="text-sm text-red-600 dark:text-red-400">{profileErrors.timezone.message}</p>
            )}

            <Button type="submit" loading={isLoading} className="w-full sm:w-auto">
              Save Changes
            </Button>
          </form>
        </Card>
      )}

      {activeTab === 'security' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Change Password</h2>

          {securityStatus.success && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-300 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{securityStatus.success}</span>
            </div>
          )}

          {securityStatus.error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{securityStatus.error}</span>
            </div>
          )}

          <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              {...registerPassword('currentPassword')}
              disabled={isLoading}
              error={passwordErrors.currentPassword?.message}
            />

            <Input
              label="New Password"
              type="password"
              {...registerPassword('newPassword')}
              disabled={isLoading}
              helperText="Must be at least 8 characters with uppercase, lowercase, number, and special character"
              error={passwordErrors.newPassword?.message}
            />

            <Input
              label="Confirm New Password"
              type="password"
              {...registerPassword('confirmPassword')}
              disabled={isLoading}
              error={passwordErrors.confirmPassword?.message}
            />

            <Button type="submit" loading={isLoading} className="w-full sm:w-auto">
              Update Password
            </Button>
          </form>
        </Card>
      )}

      {activeTab === 'appearance' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Moon className="w-5 h-5" />
            <Sun className="w-5 h-5" />
            Appearance
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {['light', 'dark', 'system'].map((t) => {
              const isActive = theme === t;
              return (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`p-4 rounded-xl border-2 transition-all text-center ${
                    isActive
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center"
                    style={{
                      backgroundColor: t === 'dark' ? '#1f2937' : t === 'light' ? '#f3f4f6' : 'linear-gradient(to right, #f3f4f6, #1f2937)',
                    }}
                  >
                    {t === 'dark' && <Moon className="w-5 h-5 text-yellow-400" />}
                    {t === 'light' && <Sun className="w-5 h-5 text-yellow-500" />}
                    {t === 'system' && (
                      <>
                        <Sun className="w-5 h-5 text-yellow-500 mr-1" />
                        <Moon className="w-5 h-5 text-blue-400 ml-1" />
                      </>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">{t}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t === 'system' ? 'Matches system' : `${t.charAt(0).toUpperCase() + t.slice(1)} mode`}
                  </p>
                  {isActive && (
                    <div className="mt-2 flex items-center justify-center gap-1 text-indigo-600 dark:text-indigo-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Active</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}