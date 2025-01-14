import axios from 'axios';

export const addContactNote = async (contactId: string, note: string) => {
  try {
    const response = await axios.post(
      `https://services.leadconnectorhq.com/contacts/${contactId}/notes`,
      { note },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GO_HIGH_LEVEL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error adding note to contact:', error);
    throw error;
  }
};
