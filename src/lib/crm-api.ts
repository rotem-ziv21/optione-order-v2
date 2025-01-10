import axios from 'axios';
import { supabase } from './supabase';

const API_BASE_URL = 'https://services.leadconnectorhq.com';

interface CRMSettings {
  location_id: string;
  api_token: string;
}

const getSettings = async (): Promise<CRMSettings> => {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .single();

  if (error) throw error;
  if (!data) throw new Error('No settings found');

  return {
    location_id: data.location_id,
    api_token: data.api_token
  };
};

const createApi = async () => {
  const settings = await getSettings();
  
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${settings.api_token}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    }
  });
};

export interface CRMContact {
  id: string;
  email: string;
  firstNameLowerCase: string;
  lastNameLowerCase: string;
  phone: string;
  locationId: string;
}

export const searchContacts = async (searchTerm: string) => {
  try {
    const settings = await getSettings();
    const api = await createApi();

    const response = await api.post('/contacts/search', {
      locationId: settings.location_id,
      page: 1,
      pageLimit: 10,
      filters: [
        {
          group: 'OR',
          filters: [
            {
              field: 'firstNameLowerCase',
              operator: 'contains',
              value: searchTerm.toLowerCase()
            },
            {
              field: 'lastNameLowerCase',
              operator: 'contains',
              value: searchTerm.toLowerCase()
            },
            {
              field: 'email',
              operator: 'eq',
              value: searchTerm.toLowerCase()
            }
          ]
        }
      ]
    });

    return response.data.contacts;
  } catch (error) {
    console.error('Error searching contacts:', error);
    throw error;
  }
};