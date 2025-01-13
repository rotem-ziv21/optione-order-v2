import axios from 'axios';

interface CardcomPaymentRequest {
  terminalNumber: number;
  apiName: string;
  amount: number;
  successUrl: string;
  failureUrl: string;
  customer: {
    name: string;
    email: string;
  };
  items: Array<{
    description: string;
    price: number;
    quantity: number;
  }>;
  payments?: number;
  orderId?: string;
}

interface CardcomResponse {
  Description: string;
  LowProfileId: string;
  ResponseCode: number;
  OK: string;
  Url: string;
  UrlToBit: string;
  UrlToPayPal: string;
}

export const createPaymentPage = async ({
  terminalNumber,
  apiName,
  amount,
  successUrl,
  failureUrl,
  customer,
  items,
  payments = 1,
  orderId
}: CardcomPaymentRequest): Promise<{ url: string; lowProfileId: string }> => {
  try {
    console.log('Creating payment page with data:', { amount, items }); // Debug log

    if (!customer.email) {
      throw new Error('נדרשת כתובת אימייל של הלקוח');
    }

    if (!items.length) {
      throw new Error('לא נבחרו מוצרים לתשלום');
    }

    // Format items with proper number handling and merge identical items
    const mergedItems = items.reduce((acc, curr) => {
      const price = Number(Number(curr.price).toFixed(2));
      const quantity = Number(curr.quantity);
      
      if (isNaN(price) || price <= 0) {
        throw new Error(`מחיר לא תקין עבור המוצר: ${curr.description}`);
      }
      
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error(`כמות לא תקינה עבור המוצר: ${curr.description}`);
      }

      const key = `${curr.description}-${price}`;
      if (!acc[key]) {
        acc[key] = {
          Description: curr.description,
          UnitCost: price,
          Quantity: quantity
        };
      } else {
        acc[key].Quantity += quantity;
      }
      return acc;
    }, {} as Record<string, { Description: string; UnitCost: number; Quantity: number }>);

    const formattedItems = Object.values(mergedItems);

    // Calculate total from items
    const calculatedTotal = Number(formattedItems.reduce((sum, item) => 
      sum + (item.UnitCost * item.Quantity), 0).toFixed(2));

    // Format the provided amount
    const formattedAmount = Number(Number(amount).toFixed(2));

    console.log('Amount verification:', { calculatedTotal, formattedAmount }); // Debug log

    // Verify totals match with a small tolerance for floating-point arithmetic
    if (Math.abs(calculatedTotal - formattedAmount) > 0.01) {
      console.error('Amount mismatch:', { itemsTotal: calculatedTotal, amount: formattedAmount });
      throw new Error(`סכום המוצרים (${calculatedTotal}) אינו תואם לסכום לחיוב (${formattedAmount})`);
    }

    const requestBody = {
      TerminalNumber: terminalNumber,
      ApiName: apiName,
      ReturnValue: "Z12332X",
      Amount: formattedAmount,
      MaxPayments: payments,
      SuccessRedirectUrl: successUrl,
      FailedRedirectUrl: failureUrl,
      WebHookUrl: `${window.location.origin}/.netlify/functions/cardcom-webhook`,
      Document: {
        To: customer.name,
        Email: customer.email,
        Products: formattedItems
      }
    };

    console.log('Sending request to Cardcom:', requestBody); // Debug log

    const response = await axios.post<CardcomResponse>(
      'https://secure.cardcom.solutions/api/v11/LowProfile/Create',
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 seconds timeout
      }
    );

    console.log('Cardcom response:', response.data); // Debug log

    if (!response.data?.Url) {
      throw new Error('לא התקבל URL לדף התשלום מקארדקום');
    }

    if (response.data.ResponseCode !== 0) {
      throw new Error(`שגיאה מקארדקום: ${response.data.Description}`);
    }

    return { 
      url: response.data.Url,
      lowProfileId: response.data.LowProfileId
    };
  } catch (error) {
    console.error('Error in createPaymentPage:', error);
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('תם הזמן הקצוב לחיבור לשרת קארדקום');
      }
      if (error.response) {
        throw new Error(`שגיאה מקארדקום: ${error.response.data?.Description || error.response.statusText}`);
      }
      throw new Error('שגיאה בתקשורת עם שרת קארדקום');
    }
    throw error instanceof Error ? error : new Error('שגיאה ביצירת דף תשלום');
  }
};