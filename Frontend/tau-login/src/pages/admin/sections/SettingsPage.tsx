import { t } from "@/shared/i18n";

export default function SettingsPage() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{t('admin.nav.settings')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-md p-4">
          <div className="font-medium mb-2">General</div>
          <div className="text-sm text-slate-600">Placeholder</div>
        </div>
        <div className="border rounded-md p-4">
          <div className="font-medium mb-2">Security</div>
          <div className="text-sm text-slate-600">Placeholder</div>
        </div>
      </div>
    </div>
  );
}
