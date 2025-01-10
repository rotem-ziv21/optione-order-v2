import React, { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Settings {
  id?: string;
  location_id: string;
  api_token: string;
  cardcom_terminal: string;
  cardcom_api_name: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings>({
    location_id: '',
    api_token: '',
    cardcom_terminal: '',
    cardcom_api_name: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          location_id: data.location_id || '',
          api_token: data.api_token || '',
          cardcom_terminal: data.cardcom_terminal || '',
          cardcom_api_name: data.cardcom_api_name || ''
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage({ type: 'error', text: 'שגיאה בטעינת ההגדרות' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase
        .from('settings')
        .upsert([settings]);

      if (error) throw error;

      setMessage({ type: 'success', text: 'ההגדרות נשמרו בהצלחה' });
      fetchSettings(); // Refresh settings after save
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'שגיאה בשמירת ההגדרות' });
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
          <div className="flex items-center space-x-3">
            <SettingsIcon className="w-6 h-6 text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900">הגדרות מערכת</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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

            {/* Cardcom Settings */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">הגדרות סליקה - Cardcom</h3>
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

          {message.text && (
            <div className={`p-4 rounded-md ${
              message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}>
              {message.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
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