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

  // פונקציה לבדיקת מערכת ה-webhooks
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
      addLog(`שגיאה לא צפויה: ${error.message}`);
    }
    
    setIsLoading(false);
  };

  // פונקציה לבדיקת webhook ישירות
  const handleTestWebhook = async () => {
    if (!selectedProduct && !directUrl) {
      toast.error('יש לבחור מוצר או להזין URL ישיר');
      return;
    }
    
    setIsLoading(true);
    setWebhookResponses([]);
    addLog('מתחיל בדיקת webhook...');
    addLog(`מזהה הזמנה לבדיקה: ${testOrderId}`);
    addLog(`מזהה עסק: ${businessId}`);
    
    try {
      // בדיקה אם יש מוצר נבחר
      const productToTest = products.find(p => p.id === selectedProduct);
      
      if (productToTest) {
        // שליחת webhook למוצר ספציפי
        addLog(`שולח webhook עבור מוצר: ${productToTest.name}`);
        
        // הכנת נתוני המוצר לשליחה
        const orderData = {
          order_id: testOrderId,
          product: {
            id: productToTest.id,
            name: productToTest.name,
            price: productToTest.price,
            sku: productToTest.sku || '',
            currency: productToTest.currency || 'ILS'
          },
          business_id: businessId
        };
        
        // שימוש בפיילוד מותאם אישית אם קיים
        if (customPayload && customPayload.trim() !== '') {
          try {
            const customData = JSON.parse(customPayload);
            addLog('משתמש בפיילוד מותאם אישית');
            addLog(`פיילוד: ${customPayload}`);
            
            const results = await triggerProductPurchasedWebhooks(testOrderId, customData);
            
            if (results && results.length > 0) {
              addLog(`נשלחו ${results.length} webhooks בהצלחה`);
              
              results.forEach((result: any) => {
                setWebhookResponses(prev => [
                  ...prev,
                  {
                    url: result.url,
                    status: result.status,
                    response: result.response,
                    error: result.error
                  }
                ]);
                
                addLog(`תוצאה עבור ${result.url}: ${result.status} ${result.error ? '(שגיאה: ' + result.error + ')' : '(הצלחה)'}`);
              });
            } else {
              addLog('לא נשלחו webhooks. ייתכן שאין webhooks מוגדרים למוצר זה.');
            }
          } catch (error) {
            addLog(`שגיאה בפיילוד מותאם אישית: ${error instanceof Error ? error.message : String(error)}`);
            toast.error('שגיאה בפיילוד מותאם אישית');
          }
        } else {
          // שליחת webhook עם נתוני ברירת מחדל
          const results = await triggerProductPurchasedWebhooks(testOrderId, orderData);
          
          if (results && results.length > 0) {
            addLog(`נשלחו ${results.length} webhooks בהצלחה`);
            
            results.forEach((result: any) => {
              setWebhookResponses(prev => [
                ...prev,
                {
                  url: result.url,
                  status: result.status,
                  response: result.response,
                  error: result.error
                }
              ]);
              
              addLog(`תוצאה עבור ${result.url}: ${result.status} ${result.error ? '(שגיאה: ' + result.error + ')' : '(הצלחה)'}`);
            });
          } else {
            addLog('לא נשלחו webhooks. ייתכן שאין webhooks מוגדרים למוצר זה.');
          }
        }
      } else if (directUrl) {
        // שליחה ישירה ל-URL
        addLog(`שולח webhook ישירות ל-URL: ${directUrl}`);
        
        // הכנת נתוני ברירת מחדל לשליחה
        const defaultData = {
          order_id: testOrderId,
          product: selectedProduct ? {
            id: selectedProduct,
            name: 'Test Product',
            price: 100,
            sku: 'TEST-SKU',
            currency: 'ILS'
          } : null,
          business_id: businessId,
          event: 'product_purchased',
          timestamp: new Date().toISOString()
        };
        
        try {
          addLog(`שולח בקשה ל-${directUrl} עם מזהה הזמנה ${testOrderId} ומזהה מוצר ${selectedProduct || 'ללא'} ומזהה עסק ${businessId}`);
          
          // שליחת בקשה ישירה
          const response = await fetch(directUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Source': 'optione-webhook-test'
            },
            body: JSON.stringify(customPayload ? JSON.parse(customPayload) : defaultData)
          });
          
          const responseData = await response.text();
          
          addLog(`תשובה מ-${directUrl}: ${response.status} ${response.statusText}`);
          
          setWebhookResponses(prev => [
            ...prev,
            {
              url: directUrl,
              status: response.status,
              response: responseData,
              error: response.ok ? null : 'HTTP Error: ' + response.status
            }
          ]);
          
          if (response.ok) {
            addLog(`הבקשה נשלחה בהצלחה ל-${directUrl}`);
            toast.success('Webhook נשלח בהצלחה');
          } else {
            addLog(`שגיאה בשליחת בקשה ל-${directUrl}: ${response.status} ${response.statusText}`);
            toast.error(`שגיאה בשליחת Webhook: ${response.status} ${response.statusText}`);
          }
        } catch (error: any) {
          console.error('Error sending direct webhook:', error);
          addLog(`שגיאה בשליחת webhook ישיר: ${error.message}`);
          toast.error(`שגיאה בשליחת webhook ישיר: ${error.message}`);
          
          setWebhookResponses(prev => [
            ...prev,
            {
              url: directUrl,
              status: null,
              response: null,
              error: error.message
            }
          ]);
        }
      }
    } catch (error: any) {
      console.error('Error testing webhook:', error);
      addLog(`שגיאה לא צפויה: ${error.message}`);
      toast.error(`שגיאה: ${error.message}`);
    }
    
    setIsLoading(false);
  };

  const clearLogs = () => {
    setLogs([]);
    setWebhookResponses([]);
    addLog('הלוגים נוקו');
  };

  return (
    <div className="container mx-auto p-4 rtl">
      <h1 className="text-2xl font-bold mb-4">בדיקת Webhooks</h1>
      
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">בחר מוצר לבדיקה</h2>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">מוצר:</label>
          <select 
            className="w-full p-2 border rounded"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
          >
            <option value="">בחר מוצר...</option>
            {products.map(product => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.price} ₪)
              </option>
            ))}
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">מזהה הזמנה לבדיקה:</label>
          <input 
            type="text" 
            className="w-full p-2 border rounded"
            value={testOrderId}
            onChange={(e) => setTestOrderId(e.target.value)}
          />
          <p className="text-sm text-gray-500 mt-1">מזהה זה ישמש לזיהוי ההזמנה בלוגים ובמערכת</p>
        </div>
        
        <div className="flex items-center mb-4">
          <input 
            type="checkbox" 
            id="showAdvanced" 
            className="mr-2"
            checked={showAdvancedOptions}
            onChange={() => setShowAdvancedOptions(!showAdvancedOptions)}
          />
          <label htmlFor="showAdvanced" className="text-gray-700">הצג אפשרויות מתקדמות</label>
        </div>
        
        {showAdvancedOptions && (
          <div className="bg-gray-50 p-3 rounded mb-4">
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">URL ישיר (לשליחה ישירה):</label>
              <input 
                type="text" 
                className="w-full p-2 border rounded"
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                placeholder="https://example.com/webhook"
              />
              <p className="text-sm text-gray-500 mt-1">אם תזין URL כאן, הבקשה תישלח ישירות אליו במקום דרך מערכת ה-webhooks</p>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">פיילוד מותאם אישית (JSON):</label>
              <textarea 
                className="w-full p-2 border rounded font-mono text-sm h-32"
                value={customPayload}
                onChange={(e) => setCustomPayload(e.target.value)}
                placeholder='{"order_id": "test-123", "product": {"id": "prod-123", "name": "Test Product"}}'
              />
              <p className="text-sm text-gray-500 mt-1">אם תזין JSON כאן, הוא יישלח במקום הפיילוד הרגיל</p>
            </div>
          </div>
        )}
        
        <div className="flex space-x-2 rtl:space-x-reverse">
          <button 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            onClick={handleTestWebhook}
            disabled={isLoading || (!selectedProduct && !directUrl)}
          >
            {isLoading ? 'שולח...' : 'שלח Webhook'}
          </button>
          
          <button 
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 disabled:opacity-50"
            onClick={checkSystem}
            disabled={isLoading}
          >
            בדוק מערכת
          </button>
          
          <button 
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
            onClick={clearLogs}
          >
            נקה לוגים
          </button>
        </div>
      </div>
      
      {/* תוצאות */}
      {webhookResponses.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-xl font-semibold mb-2">תוצאות</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr>
                  <th className="py-2 px-4 border">URL</th>
                  <th className="py-2 px-4 border">סטטוס</th>
                  <th className="py-2 px-4 border">תגובה</th>
                </tr>
              </thead>
              <tbody>
                {webhookResponses.map((response, index) => (
                  <tr key={index} className={response.error ? 'bg-red-50' : 'bg-green-50'}>
                    <td className="py-2 px-4 border text-sm break-all">{response.url}</td>
                    <td className="py-2 px-4 border text-center">
                      {response.status ? (
                        <span className={`font-mono ${response.status >= 200 && response.status < 300 ? 'text-green-600' : 'text-red-600'}`}>
                          {response.status}
                        </span>
                      ) : (
                        <span className="text-red-600">שגיאה</span>
                      )}
                    </td>
                    <td className="py-2 px-4 border text-sm">
                      {response.error ? (
                        <div className="text-red-600">{response.error}</div>
                      ) : (
                        <div className="font-mono text-xs break-all max-h-20 overflow-y-auto">
                          {typeof response.response === 'object' 
                            ? JSON.stringify(response.response, null, 2) 
                            : response.response}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* לוגים */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-semibold mb-2">לוגים</h2>
        
        <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">אין לוגים להצגה</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))
          )}
        </div>
      </div>
      
      {isTableValid === false && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded mt-4">
          <h3 className="font-bold mb-2">שגיאה בטבלת Webhooks</h3>
          <p>נראה שיש בעיה במבנה טבלת ה-Webhooks. יש לוודא שהטבלה כוללת את העמודות הבאות:</p>
          <ul className="list-disc list-inside mt-2">
            <li>id (UUID, Primary Key)</li>
            <li>business_id (UUID, Foreign Key)</li>
            <li>url (Text)</li>
            <li>on_order_created (Boolean)</li>
            <li>on_order_paid (Boolean)</li>
            <li>on_product_purchased (Boolean)</li>
            <li>product_id (UUID, יכול להיות null)</li>
            <li>created_at (Timestamp)</li>
          </ul>
        </div>
      )}
    </div>
  );
}
