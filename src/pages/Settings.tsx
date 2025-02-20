import React, { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Settings {
  id?: string;
  business_id: string;
  location_id: string;
  api_token: string;
  cardcom_terminal: string;
  cardcom_api_name: string;
}

interface WebhookSettings {
  id?: string;
  url: string;
  on_order_created: boolean;
  on_order_paid: boolean;
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings>({
    business_id: '',
    location_id: '',
    api_token: '',
    cardcom_terminal: '',
    cardcom_api_name: ''
  });
  const [webhookSettings, setWebhookSettings] = useState<WebhookSettings>({
    url: '',
    on_order_created: false,
    on_order_paid: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const checkUserAndLoadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // בדוק אם המשתמש הוא אדמין
        const isAdminUser = user.email === 'rotemziv7766@gmail.com' || user.email === 'rotem@optionecrm.com';
        setIsAdmin(isAdminUser);

        if (isAdminUser) {
          // טען את כל העסקים עבור אדמין
          const { data: businessesData, error: businessesError } = await supabase
            .from('businesses')
            .select('id, name')
            .order('name');

          if (businessesError) throw businessesError;
          setBusinesses(businessesData || []);

          // אם יש עסקים, בחר את הראשון כברירת מחדל
          if (businessesData && businessesData.length > 0) {
            setSelectedBusiness(businessesData[0].id);
            fetchSettings(businessesData[0].id);
          }
        } else {
          // עבור משתמש רגיל, קבל את העסק שלו
          const { data: staffData, error: staffError } = await supabase
            .from('business_staff')
            .select('business_id, businesses(id, name)')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single();

          if (staffError) throw staffError;
          if (staffData) {
            setBusinessId(staffData.business_id);
            fetchSettings(staffData.business_id);
          }
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
        setMessage({ type: 'error', text: 'שגיאה בטעינת נתונים' });
      } finally {
        setLoading(false);
      }
    };

    checkUserAndLoadData();
  }, []);

  const fetchSettings = async (bid: string) => {
    try {
      const [{ data: settingsData, error: settingsError }, { data: webhookData, error: webhookError }] = await Promise.all([
        supabase
          .from('settings')
          .select('*')
          .eq('business_id', bid)
          .maybeSingle(),
        supabase
          .from('business_webhooks')
          .select('*')
          .eq('business_id', bid)
          .maybeSingle()
      ]);

      if (settingsError) throw settingsError;
      if (webhookError) throw webhookError;

      if (settingsData) {
        setSettings({
          id: settingsData.id,
          business_id: settingsData.business_id,
          location_id: settingsData.location_id || '',
          api_token: settingsData.api_token || '',
          cardcom_terminal: settingsData.cardcom_terminal || '',
          cardcom_api_name: settingsData.cardcom_api_name || ''
        });
      }

      if (webhookData) {
        setWebhookSettings({
          id: webhookData.id,
          url: webhookData.url || '',
          on_order_created: webhookData.on_order_created || false,
          on_order_paid: webhookData.on_order_paid || false
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage({ type: 'error', text: 'שגיאה בטעינת הגדרות' });
    }
  };

  const handleBusinessChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newBusinessId = event.target.value;
    setSelectedBusiness(newBusinessId);
    fetchSettings(newBusinessId);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const bid = isAdmin ? selectedBusiness : businessId;
      if (!bid) throw new Error('לא נבחר עסק');

      // שמירת הגדרות CRM
      const settingsData = {
        business_id: bid,
        location_id: settings.location_id,
        api_token: settings.api_token,
        cardcom_terminal: settings.cardcom_terminal,
        cardcom_api_name: settings.cardcom_api_name
      };

      const { error: settingsError } = settings.id
        ? await supabase
            .from('settings')
            .update(settingsData)
            .eq('id', settings.id)
        : await supabase
            .from('settings')
            .insert([settingsData]);

      if (settingsError) throw settingsError;

      // שמירת הגדרות Webhook
      const webhookData = {
        business_id: bid,
        url: webhookSettings.url,
        on_order_created: webhookSettings.on_order_created,
        on_order_paid: webhookSettings.on_order_paid
      };

      const { error: webhookError } = webhookSettings.id
        ? await supabase
            .from('business_webhooks')
            .update(webhookData)
            .eq('id', webhookSettings.id)
        : await supabase
            .from('business_webhooks')
            .insert([webhookData]);

      if (webhookError) throw webhookError;

      setMessage({ type: 'success', text: 'ההגדרות נשמרו בהצלחה' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'שגיאה בשמירת הגדרות' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">טוען...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SettingsIcon className="w-6 h-6 text-gray-400" />
              <h2 className="text-xl font-semibold text-gray-900">הגדרות מערכת</h2>
            </div>
            {isAdmin && businesses.length > 0 && (
              <div className="flex items-center space-x-2">
                <label htmlFor="business-select" className="text-sm font-medium text-gray-700">
                  בחר עסק:
                </label>
                <select
                  id="business-select"
                  value={selectedBusiness || ''}
                  onChange={handleBusinessChange}
                  className="block w-48 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  {businesses.map(business => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {message.text && (
          <div className={`p-4 ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={(e) => e.preventDefault()} className="p-6 space-y-6">
          <div className="space-y-6">
            {/* CRM Settings */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">הגדרות CRM</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="location_id" className="block text-sm font-medium text-gray-700">
                    Location ID
                  </label>
                  <input
                    type="text"
                    id="location_id"
                    value={settings.location_id}
                    onChange={(e) => setSettings(prev => ({ ...prev, location_id: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="הכנס את ה-Location ID"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    ניתן למצוא את ה-Location ID בהגדרות ה-CRM
                  </p>
                </div>

                <div>
                  <label htmlFor="api_token" className="block text-sm font-medium text-gray-700">
                    API Token
                  </label>
                  <input
                    type="password"
                    id="api_token"
                    value={settings.api_token}
                    onChange={(e) => setSettings(prev => ({ ...prev, api_token: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="הכנס את ה-API Token"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    ניתן למצוא את ה-API Token בהגדרות ה-CRM תחת API Tokens
                  </p>
                </div>
              </div>
            </div>

            {/* Webhook Settings */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">הגדרות Webhook</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="webhook_url" className="block text-sm font-medium text-gray-700">
                    Webhook URL
                  </label>
                  <input
                    type="text"
                    id="webhook_url"
                    value={webhookSettings.url}
                    onChange={(e) => setWebhookSettings(prev => ({ ...prev, url: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="https://your-webhook-url.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={webhookSettings.on_order_created}
                      onChange={(e) => setWebhookSettings(prev => ({ ...prev, on_order_created: e.target.checked }))}
                    />
                    <span className="text-sm">שלח webhook כשנוצרת הזמנה חדשה</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={webhookSettings.on_order_paid}
                      onChange={(e) => setWebhookSettings(prev => ({ ...prev, on_order_paid: e.target.checked }))}
                    />
                    <span className="text-sm">שלח webhook כשהזמנה שולמה</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Cardcom Settings */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">הגדרות Cardcom</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="cardcom_terminal" className="block text-sm font-medium text-gray-700">
                    מספר טרמינל
                  </label>
                  <input
                    type="text"
                    id="cardcom_terminal"
                    value={settings.cardcom_terminal}
                    onChange={(e) => setSettings(prev => ({ ...prev, cardcom_terminal: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="הכנס את מספר הטרמינל"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    מספר הטרמינל שקיבלת מחברת קארדקום
                  </p>
                </div>

                <div>
                  <label htmlFor="cardcom_api_name" className="block text-sm font-medium text-gray-700">
                    שם API
                  </label>
                  <input
                    type="password"
                    id="cardcom_api_name"
                    value={settings.cardcom_api_name}
                    onChange={(e) => setSettings(prev => ({ ...prev, cardcom_api_name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="הכנס את שם ה-API"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    שם ה-API שקיבלת מחברת קארדקום
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'שומר...' : 'שמור הגדרות'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}