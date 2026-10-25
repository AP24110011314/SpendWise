import { useAuth } from '@/context/AuthContext';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { User, Key, Moon, Sun } from 'lucide-react';
import { CURRENCIES, TIMEZONES } from '@/lib/constants';

export default function Settings() {
  const { user, updateUser } = useAuth();

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Profile
        </h2>
        <div className="space-y-4">
          <Input
            label="Name"
            defaultValue={user?.name}
            onChange={(e) => updateUser({ name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            defaultValue={user?.email}
            disabled
          />
          <Select
            label="Currency"
            options={CURRENCIES.map(c => ({ value: c.code, label: c.name }))}
            defaultValue={user?.currency}
            onChange={(e) => updateUser({ currency: e.target.value })}
          />
          <Select
            label="Timezone"
            options={TIMEZONES.map(tz => ({ value: tz, label: tz }))}
            defaultValue={user?.timezone}
            onChange={(e) => updateUser({ timezone: e.target.value })}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Key className="w-5 h-5" />
          Change Password
        </h2>
        <div className="space-y-4">
          <Input label="Current Password" type="password" />
          <Input label="New Password" type="password" />
          <Input label="Confirm New Password" type="password" />
          <Button>Update Password</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Moon className="w-5 h-5" />
          <Sun className="w-5 h-5" />
          Appearance
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Theme support coming soon</p>
      </Card>
    </div>
  );
}