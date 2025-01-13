import axios from 'axios';
import { supabase } from './supabase';

const API_BASE_URL = 'https://services.leadconnectorhq.com';

interface CRMSettings {
  location_id: string;
  api_token: string;
}

const getSettings = async (businessId: string): Promise<CRMSettings> => {
  console.log('Fetching CRM settings for business:', businessId);
  
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('business_id', businessId)
    .single();

  if (error) {
    console.error('Error fetching CRM settings:', error);
    throw error;
  }
  
  if (!data) {
    console.error('No CRM settings found for business:', businessId);
    throw new Error('לא נמצאו הגדרות CRM לעסק זה');
  }

  if (!data.api_token) {
    console.error('Missing API token in CRM settings for business:', businessId);
    throw new Error('הגדרות CRM חסרות. אנא הגדר את ה-API Token בהגדרות');
  }

  console.log('Found CRM settings:', {
    businessId,
    hasToken: !!data.api_token,
    tokenLength: data.api_token?.length
  });

  return {
    location_id: data.location_id,
    api_token: data.api_token
  };
};

const createApi = async (businessId: string) => {
  const settings = await getSettings(businessId);
  
  if (!settings.api_token) {
    throw new Error('Missing API token');
  }

  console.log('Creating API client with token length:', settings.api_token.length);

  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.api_token}`,
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

export const searchContacts = async (searchTerm: string, businessId: string) => {
  try {
    const settings = await getSettings(businessId);
    const api = await createApi(businessId);

    const response = await api.post('/contacts/search', {
      locationId: settings.location_id,
      query: searchTerm,
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
              operator: 'contains',
              value: searchTerm.toLowerCase()
            },
            {
              field: 'phone',
              operator: 'contains',
              value: searchTerm
            }
          ]
        }
      ]
    });

    if (!response.data || !Array.isArray(response.data.contacts)) {
      console.error('Unexpected API response:', response.data);
      throw new Error('תגובה לא תקינה מה-API');
    }

    return response.data.contacts;
  } catch (error) {
    console.error('Error searching contacts:', error);
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('שגיאת הרשאות מול ה-CRM. אנא בדוק את הגדרות ה-API Token');
      } else if (error.response?.status === 422) {
        console.error('API Validation Error:', error.response.data);
        throw new Error('שגיאה בפרמטרים של החיפוש. אנא נסה שוב');
      }
    }
    throw error;
  }
};

interface AddNoteParams {
  contactId: string;
  body: string;
  businessId: string;
}

export const addContactNote = async ({ contactId, body, businessId }: AddNoteParams) => {
  try {
    console.log('Getting CRM settings for business:', businessId);
    const settings = await getSettings(businessId);
    console.log('Creating API client with settings');
    const api = await createApi(businessId);

    const url = `/contacts/${contactId}/notes`;
    const data = {
      userId: contactId,  
      body
    };

    console.log('Sending note to CRM API:', {
      url: API_BASE_URL + url,
      data,
      locationId: settings.location_id
    });

    const response = await api.post(url, data, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      }
    });

    console.log('CRM API Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error adding contact note:', error);
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        console.error('CRM API 401 Error:', error.response.data);
        throw new Error('שגיאת הרשאות מול ה-CRM. אנא בדוק את הגדרות ה-API Token');
      } else if (error.response?.status === 422) {
        console.error('CRM API 422 Error:', {
          data: error.response.data,
          requestData: data
        });
        throw new Error('שגיאת וולידציה מול ה-CRM. אנא בדוק את פרטי ההערה');
      } else if (!error.response) {
        console.error('CRM API Network Error:', error.message);
        throw new Error('שגיאת תקשורת מול ה-CRM. אנא נסה שוב מאוחר יותר');
      } else {
        console.error('CRM API Other Error:', {
          status: error.response.status,
          data: error.response.data
        });
        throw new Error('שגיאה בתקשורת מול ה-CRM. אנא נסה שוב');
      }
    }
    throw error;
  }
};