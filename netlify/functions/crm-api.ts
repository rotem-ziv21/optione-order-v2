import axios from 'axios';

export const addContactNote = async (contactId: string, note: string) => {
  console.log('Adding note to contact:', { contactId, note });
  
  try {
    if (!process.env.GO_HIGH_LEVEL_API_KEY) {
      throw new Error('GO_HIGH_LEVEL_API_KEY is not set');
    }

    const url = `https://services.leadconnectorhq.com/contacts/${contactId}/notes`;
    console.log('Sending request to:', url);

    const response = await axios.post(
      url,
      { note },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GO_HIGH_LEVEL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );

    console.log('CRM API response:', response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('CRM API error:', {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers
      });
    }
    console.error('Error adding note to contact:', error);
    throw error;
  }
};
