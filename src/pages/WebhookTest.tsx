import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { validateWebhooksTable, triggerProductPurchasedWebhooks } from '../services/webhookService';

interface Product {
  id: string;
  name: string;
  price: number;
  business_id: string;
  sku?: string;
  currency?: string;
}

interface Webhook {
  id: string;
  url: string;
  business_id: string;
  on_order_created: boolean;
  on_order_paid: boolean;
  on_product_purchased: boolean;
  product_id: string | null;
}

interface WebhookResponse {
  url: string;
  status: number | null;
  response: any;
  error: string | null;
}

export default function WebhookTest() {
  const { businessId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [testOrderId, setTestOrderId] = useState<string>('test-order-' + Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isTableValid, setIsTableValid] = useState<boolean | null>(null);
  const [webhookResponses, setWebhookResponses] = useState<WebhookResponse[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [customPayload, setCustomPayload] = useState('');
  const [directUrl, setDirectUrl] = useState('');

  useEffect(() => {
    if (!businessId) return;
    
    fetchProducts();
    fetchWebhooks();
    validateTable();
  }, [businessId]);

  const validateTable = async () => {
    const isValid = await validateWebhooksTable();
    setIsTableValid(isValid);
    
    if (!isValid) {
      addLog('שגיאה: טבלת ה-webhooks אינה תקינה. יש לבצע את העדכונים הנדרשים.');
    } else {
      addLog('טבלת ה-webhooks תקינה.');
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, business_id, sku, currency')
        .eq('business_id', businessId);
      
      if (error) throw error;
      setProducts(data || []);
      addLog(`נטענו ${data?.length || 0} מוצרים.`);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      toast.error('שגיאה בטעינת המוצרים');
      addLog(`שגיאה בטעינת מוצרים: ${error.message}`);
    }
  };

  const fetchWebhooks = async () => {
    try {
      const { data, error } = await supabase
        .from('business_webhooks')
        .select('*')
        .eq('business_id', businessId);
      
      if (error) throw error;
      setWebhooks(data || []);
      addLog(`נטענו ${data?.length || 0} webhooks.`);
      
      // בדיקה אם יש webhooks מוגדרים לרכישת מוצרים
      const productWebhooks = data?.filter(webhook => webhook.on_product_purchased) || [];
      if (productWebhooks.length === 0) {
        addLog('אזהרה: לא נמצאו webhooks מוגדרים לרכישת מוצרים.');
      } else {
        addLog(`נמצאו ${productWebhooks.length} webhooks לרכישת מוצרים.`);
      }
    } catch (error: any) {
      console.error('Error fetching webhooks:', error);
      toast.error('שגיאה בטעינת ה-Webhooks');
      addLog(`שגיאה בטעינת webhooks: ${error.message}`);
    }
  };

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const checkSystem = async () => {
    setIsLoading(true);
    addLog('בודק את מערכת ה-webhooks...');

    try {
      // בדיקת טבלת ה-webhooks
      const isValid = await validateWebhooksTable();
      if (isValid) {
        addLog('טבלת webhooks תקינה');
      } else {
        addLog('יש בעיה בטבלת webhooks. ראה הנחיות לתיקון.');
      }
      
      // בדיקת מוצרים
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .limit(10);
        
      if (productsError) {
        addLog(`שגיאה בבדיקת מוצרים: ${productsError.message}`);
      } else {
        addLog(`נמצאו ${productsData.length} מוצרים`);
      }
      
      // בדיקת webhooks
      const { data: webhooksData, error: webhooksError } = await supabase
        .from('business_webhooks')
        .select('*')
        .eq('business_id', businessId);
        
      if (webhooksError) {
        addLog(`שגיאה בבדיקת webhooks: ${webhooksError.message}`);
      } else {
        addLog(`נמצאו ${webhooksData.length} webhooks`);
        
        // בדיקת webhooks לרכישת מוצרים
        const productWebhooks = webhooksData.filter(webhook => webhook.on_product_purchased);
        if (productWebhooks.length === 0) {
          addLog('אזהרה: לא נמצאו webhooks מוגדרים לרכישת מוצרים');
        } else {
          addLog(`נמצאו ${productWebhooks.length} webhooks לרכישת מוצרים`);
          
          // בדיקת תקינות URLs
          let validUrls = 0;
          for (const webhook of productWebhooks) {
            try {
              new URL(webhook.url);
              validUrls++;
            } catch (error) {
              addLog(`אזהרה: URL לא תקין עבור webhook ${webhook.id}: ${webhook.url}`);
            }
          }
          addLog(`${validUrls} מתוך ${productWebhooks.length} URLs תקינים`);
        }
      }
      
      // בדיקת טבלת לוגים
      const { error: logsError } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('webhook_id', webhooksData?.[0]?.id)
        .limit(1);
        
      if (logsError) {
        addLog(`אזהרה: שגיאה בבדיקת טבלת לוגים: ${logsError.message}`);
        addLog('ייתכן שטבלת webhook_logs לא קיימת. יש ליצור אותה.');
      } else {
        addLog('טבלת לוגים תקינה');
      }
    } catch (error: any) {
      console.error('Error checking system:', error);
      addLog(`שגיאה בבדיקת המערכת: ${error.message}`);
    }
    
    setIsLoading(false);
  };

  // פונקציה לבדיקת webhook עם אפשרות להתאמה אישית של ה-payload
  const handleTestWebhook = async () => {
    if (!selectedProduct && !directUrl) {
      toast.error('יש לבחור מוצר או להזין כתובת URL ישירה');
      return;
    }

    setIsLoading(true);
    setWebhookResponses([]);
    addLog(`מתחיל בדיקת webhook...`);
    addLog(`מזהה הזמנה: ${testOrderId}`);
    addLog(`מזהה עסק: ${businessId}`);

    try {
      // יצירת payload עם הנתונים הנכונים
      const selectedProductObj = products.find(p => p.id === selectedProduct);
      const payload = {
        event: 'product_purchased',
        order_id: testOrderId,
        product_id: selectedProduct || 'test-product-id',
        business_id: businessId,
        timestamp: new Date().toISOString(),
        
        // פרטי מוצר
        product: {
          id: selectedProduct || 'test-product-id',
          name: selectedProductObj?.name || 'מוצר בדיקה',
          price: selectedProductObj?.price || 100,
          sku: selectedProductObj?.sku || 'SKU123',
          currency: selectedProductObj?.currency || 'ILS'
        },
        
        // פרטי לקוח - קבועים לפי הנתונים הנכונים
        customer: {
          id: 'customer-123',
          name: 'ישראל ישראלי',
          email: 'israel@example.com',
          phone: '0501234567',
          contact_id: 'contact-123'
        },
        
        // פרטי הזמנה - קבועים לפי הנתונים הנכונים
        order: {
          id: testOrderId,
          total_amount: selectedProductObj?.price || 100,
          status: 'pending',
          created_at: new Date().toISOString()
        },
        
        // פרטי פריט הזמנה - קבועים לפי הנתונים הנכונים
        order_item: {
          quantity: 1,
          price_at_time: selectedProductObj?.price || 100
        }
      };
      
      // אם יש payload מותאם אישית, נשתמש בו
      let finalPayload = payload;
      if (customPayload && customPayload.trim() !== '') {
        try {
          finalPayload = JSON.parse(customPayload);
          addLog('משתמש ב-payload מותאם אישית');
        } catch (error: any) {
          addLog(`שגיאה בפענוח ה-payload המותאם: ${error.message}`);
          toast.error('שגיאה בפענוח ה-payload המותאם');
          finalPayload = payload;
        }
      } else {
        addLog('משתמש ב-payload ברירת מחדל');
      }
      
      // אם יש URL ישיר, נשלח אליו
      if (directUrl) {
        addLog(`שולח webhook ישירות ל-${directUrl}...`);
        try {
          const response = await fetch(directUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(finalPayload)
          });
          
          // קריאת התגובה
          let responseData: any;
          let responseText = '';
          try {
            responseText = await response.text();
            if (responseText) {
              try {
                responseData = JSON.parse(responseText);
              } catch {
                responseData = responseText;
              }
            }
          } catch (error) {
            console.error('Error reading response:', error);
            responseData = 'Error reading response';
          }
          
          // הוספת התגובה לרשימת התגובות
          setWebhookResponses(prev => [
            ...prev,
            {
              url: directUrl,
              status: response.status,
              response: responseData || responseText || 'No response body',
              error: null
            }
          ]);
          
          addLog(`התקבלה תגובה מ-${directUrl} עם קוד סטטוס ${response.status}`);
        } catch (error: any) {
          console.error('Error sending webhook:', error);
          setWebhookResponses(prev => [
            ...prev,
            {
              url: directUrl,
              status: null,
              response: null,
              error: error.message || 'Unknown error'
            }
          ]);
          addLog(`שגיאה בשליחת webhook ל-${directUrl}: ${error.message || 'Unknown error'}`);
        }
      }
      
      // שליחת בקשות webhook מהרשימה המוגדרת
      if (selectedProduct) {
        const relevantWebhooks = webhooks.filter(
          webhook => webhook.on_product_purchased && 
          (webhook.product_id === null || webhook.product_id === selectedProduct)
        );

        if (relevantWebhooks.length === 0) {
          addLog(`אזהרה: לא נמצאו webhooks מוגדרים למוצר ${selectedProduct}.`);
        } else {
          addLog(`נמצאו ${relevantWebhooks.length} webhooks למוצר ${selectedProduct}.`);
          addLog(`URLs: ${relevantWebhooks.map(w => w.url).join(', ')}`);
          
          // שליחת בקשות webhook ישירות
          for (const webhook of relevantWebhooks) {
            try {
              addLog(`שולח webhook ל-${webhook.url}...`);
              
              // שליחת הבקשה
              const response = await fetch(webhook.url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(finalPayload)
              });
              
              // קריאת התגובה
              let responseData: any;
              let responseText = '';
              try {
                responseText = await response.text();
                if (responseText) {
                  try {
                    responseData = JSON.parse(responseText);
                  } catch {
                    responseData = responseText;
                  }
                }
              } catch (error) {
                console.error('Error reading response:', error);
                responseData = 'Error reading response';
              }
              
              // הוספת התגובה לרשימת התגובות
              setWebhookResponses(prev => [
                ...prev,
                {
                  url: webhook.url,
                  status: response.status,
                  response: responseData || responseText || 'No response body',
                  error: null
                }
              ]);
              
              addLog(`התקבלה תגובה מ-${webhook.url} עם קוד סטטוס ${response.status}`);
              
              // שמירת לוג של ה-webhook
              await supabase.from('webhook_logs').insert({
                webhook_id: webhook.id,
                order_id: testOrderId,
                product_id: selectedProduct,
                request_payload: finalPayload,
                response_status: response.status,
                response_body: responseText,
                sent_at: new Date().toISOString()
              });
            } catch (error: any) {
              console.error('Error sending webhook:', error);
              setWebhookResponses(prev => [
                ...prev,
                {
                  url: webhook.url,
                  status: null,
                  response: null,
                  error: error.message || 'Unknown error'
                }
              ]);
              addLog(`שגיאה בשליחת webhook ל-${webhook.url}: ${error.message || 'Unknown error'}`);
              
              // שמירת לוג של השגיאה
              try {
                await supabase.from('webhook_logs').insert({
                  webhook_id: webhook.id,
                  order_id: testOrderId,
                  product_id: selectedProduct,
                  request_payload: finalPayload,
                  response_status: null,
                  response_body: `Error: ${error.message || 'Unknown error'}`,
                  sent_at: new Date().toISOString()
                });
              } catch (logError) {
                console.error('Error saving webhook log:', logError);
              }
            }
          }
        }
      }
      
      // שימוש בפונקציה מהשירות
      if (selectedProduct) {
        addLog(`מפעיל את פונקציית triggerProductPurchasedWebhooks עם מזהה הזמנה ${testOrderId} ומזהה מוצר ${selectedProduct}...`);
        await triggerProductPurchasedWebhooks(testOrderId, selectedProduct, businessId || '');
        addLog('הפעלת הפונקציה הסתיימה');
      }
    } catch (error: any) {
      console.error('Error in handleTestWebhook:', error);
      addLog(`שגיאה כללית: ${error.message}`);
      toast.error('שגיאה בשליחת ה-webhook');
    } finally {
      setIsLoading(false);
    }
  };
  
  // פונקציה לניקוי הלוגים
  const clearLogs = () => {
    setLogs([]);
    setWebhookResponses([]);
    addLog('הלוגים נוקו');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">בדיקת Webhooks</h1>
        <a 
          href="/webhook-history" 
          className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors"
        >
          היסטוריית Webhooks
        </a>
      </div>
      
      {isTableValid === false && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p className="font-bold">שגיאה במבנה טבלת ה-webhooks</p>
          <p>יש לבצע את העדכון הבא בבסיס הנתונים:</p>
          <pre className="bg-gray-100 p-2 mt-1 rounded text-xs overflow-x-auto">
            {`ALTER TABLE business_webhooks 
ADD COLUMN on_product_purchased BOOLEAN DEFAULT FALSE,
ADD COLUMN product_id UUID REFERENCES products(id) NULL;`}
          </pre>
          <p className="mt-2">אם הטבלה לא קיימת כלל, יש ליצור אותה תחילה:</p>
          <pre className="bg-gray-100 p-2 mt-1 rounded text-xs overflow-x-auto">
            {`CREATE TABLE business_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) NOT NULL,
  url TEXT NOT NULL,
  on_order_created BOOLEAN DEFAULT FALSE,
  on_order_paid BOOLEAN DEFAULT FALSE,
  on_product_purchased BOOLEAN DEFAULT FALSE,
  product_id UUID REFERENCES products(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`}
          </pre>
          <p className="mt-2">כמו כן, יש ליצור טבלת לוגים:</p>
          <pre className="bg-gray-100 p-2 mt-1 rounded text-xs overflow-x-auto">
            {`CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID REFERENCES business_webhooks(id) NOT NULL,
  order_id TEXT,
  product_id UUID REFERENCES products(id),
  request_payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`}
          </pre>
        </div>
      )}
      
      <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6">
        <h3 className="font-bold mb-2">מדריך שימוש</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>בחר מוצר מהרשימה למטה</li>
          <li>הזן מזהה הזמנה לבדיקה או השאר את ברירת המחדל</li>
          <li>לחץ על "שלח webhook לבדיקה" כדי לשלוח webhook לכל ה-URLs המוגדרים</li>
          <li>צפה בתוצאות בלוג למטה</li>
        </ol>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">בדיקת מערכת</h2>
        <button
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          onClick={checkSystem}
          disabled={isLoading}
        >
          בדוק תקינות מערכת
        </button>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">שליחת Webhook לבדיקה</h2>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            בחר מוצר
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            disabled={isLoading}
          >
            <option value="">-- בחר מוצר --</option>
            {products.map(product => (
              <option key={product.id} value={product.id}>
                {product.name} - {product.price} ש"ח
              </option>
            ))}
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            מזהה הזמנה לבדיקה
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            type="text"
            value={testOrderId}
            onChange={(e) => setTestOrderId(e.target.value)}
            placeholder="מזהה הזמנה"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">השאר ריק כדי ליצור מזהה אקראי</p>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            URL ישיר (אופציונלי)
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            type="text"
            value={directUrl}
            onChange={(e) => setDirectUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">אם תזין URL ישיר, ה-webhook יישלח אליו במקום או בנוסף ל-URLs המוגדרים</p>
        </div>
        
        <div className="mb-4">
          <button
            className="text-blue-500 hover:text-blue-700 text-sm font-medium"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            disabled={isLoading}
          >
            {showAdvancedOptions ? 'הסתר אפשרויות מתקדמות' : 'הצג אפשרויות מתקדמות'}
          </button>
          
          {showAdvancedOptions && (
            <div className="mt-3">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Payload מותאם אישית (JSON)
              </label>
              <textarea
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-48 font-mono"
                value={customPayload}
                onChange={(e) => setCustomPayload(e.target.value)}
                placeholder={`{
  "event": "product_purchased",
  "order_id": "${testOrderId}",
  "product_id": "${selectedProduct || '[product_id]'}",
  "business_id": "${businessId || '[business_id]'}",
  "timestamp": "${new Date().toISOString()}",
  
  "product": {
    "id": "${selectedProduct || '[product_id]'}",
    "name": "שם המוצר",
    "price": 100,
    "sku": "SKU123",
    "currency": "ILS"
  },
  
  "order": {
    "id": "${testOrderId}",
    "total_amount": 100,
    "status": "pending",
    "created_at": "${new Date().toISOString()}"
  },
  
  "order_item": {
    "quantity": 1,
    "price_at_time": 100
  },
  
  "customer": {
    "id": "customer-123",
    "name": "ישראל ישראלי",
    "email": "israel@example.com",
    "phone": "0501234567",
    "contact_id": "contact-123"
  }
}`}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">השאר ריק כדי להשתמש ב-payload ברירת המחדל</p>
            </div>
          )}
        </div>
        
        <div className="flex space-x-2 space-x-reverse">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            onClick={handleTestWebhook}
            disabled={isLoading || (isTableValid === false && !directUrl)}
          >
            {isLoading ? 'שולח...' : 'שלח webhook לבדיקה'}
          </button>
          
          <button
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            onClick={clearLogs}
            disabled={isLoading}
          >
            נקה לוגים
          </button>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">לוג בדיקה</h2>
        <div className="bg-gray-100 p-4 rounded-lg h-64 overflow-y-auto text-sm font-mono">
          {logs.length === 0 ? (
            <p className="text-gray-500">אין לוגים להצגה...</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">
                {log}
              </div>
            ))
          )}
        </div>
        
        {webhookResponses.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-bold mb-3">תגובות Webhook</h3>
            <div className="space-y-4">
              {webhookResponses.map((resp, index) => (
                <div key={index} className="border rounded p-3">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium">{resp.url}</span>
                    {resp.status ? (
                      <span className={`px-2 py-1 rounded text-xs ${resp.status >= 200 && resp.status < 300 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {resp.status}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">שגיאה</span>
                    )}
                  </div>
                  
                  {resp.error ? (
                    <div className="bg-red-50 p-2 rounded text-xs font-mono overflow-x-auto">
                      {resp.error}
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-2 rounded text-xs font-mono overflow-x-auto">
                      {typeof resp.response === 'object' 
                        ? JSON.stringify(resp.response, null, 2)
                        : String(resp.response)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
