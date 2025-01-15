import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFViewer, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
}

interface PriceQuoteProps {
  customerName: string;
  products: Product[];
  notes?: string;
  businessDetails: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

// הוספת פונט עברית
Font.register({
  family: 'Heebo',
  src: 'https://fonts.gstatic.com/s/heebo/v21/NGSpv5_NC0k9P_v6ZUCbLRAHxK1EiSysdUmj.ttf'
});

// הגדרות עיצוב
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Heebo',
    padding: 30,
    direction: 'rtl',
  },
  header: {
    marginBottom: 20,
  },
  businessName: {
    fontSize: 24,
    marginBottom: 10,
  },
  businessDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  customerInfo: {
    marginBottom: 20,
  },
  table: {
    display: 'table',
    width: '100%',
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
    alignItems: 'center',
    height: 30,
  },
  tableHeader: {
    backgroundColor: '#f8f9fa',
    fontWeight: 'bold',
  },
  tableCol: {
    width: '20%',
    textAlign: 'right',
    paddingRight: 8,
  },
  total: {
    marginTop: 20,
    textAlign: 'left',
    fontSize: 16,
    fontWeight: 'bold',
  },
  notes: {
    marginTop: 30,
    fontSize: 12,
    color: '#666',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 10,
    color: '#666',
  },
});

const PriceQuotePDF: React.FC<PriceQuoteProps> = ({ customerName, products, notes, businessDetails }) => {
  const total = products.reduce((sum, product) => sum + (product.price * product.quantity), 0);
  const currentDate = format(new Date(), 'dd/MM/yyyy');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* כותרת עם פרטי העסק */}
        <View style={styles.header}>
          <Text style={styles.businessName}>{businessDetails.name}</Text>
          {businessDetails.address && (
            <Text style={styles.businessDetails}>{businessDetails.address}</Text>
          )}
          {businessDetails.phone && (
            <Text style={styles.businessDetails}>טלפון: {businessDetails.phone}</Text>
          )}
          {businessDetails.email && (
            <Text style={styles.businessDetails}>אימייל: {businessDetails.email}</Text>
          )}
        </View>

        <Text style={styles.title}>הצעת מחיר</Text>

        {/* פרטי לקוח ותאריך */}
        <View style={styles.customerInfo}>
          <Text>תאריך: {currentDate}</Text>
          <Text>לכבוד: {customerName}</Text>
        </View>

        {/* טבלת מוצרים */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={styles.tableCol}>
              <Text>מוצר</Text>
            </View>
            <View style={styles.tableCol}>
              <Text>כמות</Text>
            </View>
            <View style={styles.tableCol}>
              <Text>מחיר ליחידה</Text>
            </View>
            <View style={styles.tableCol}>
              <Text>מטבע</Text>
            </View>
            <View style={styles.tableCol}>
              <Text>סה"כ</Text>
            </View>
          </View>

          {products.map((product, index) => (
            <View key={index} style={styles.tableRow}>
              <View style={styles.tableCol}>
                <Text>{product.name}</Text>
              </View>
              <View style={styles.tableCol}>
                <Text>{product.quantity}</Text>
              </View>
              <View style={styles.tableCol}>
                <Text>{product.price}</Text>
              </View>
              <View style={styles.tableCol}>
                <Text>{product.currency}</Text>
              </View>
              <View style={styles.tableCol}>
                <Text>{product.price * product.quantity}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* סה"כ */}
        <View style={styles.total}>
          <Text>סה"כ: {total} ₪</Text>
        </View>

        {/* הערות */}
        {notes && (
          <View style={styles.notes}>
            <Text>הערות:</Text>
            <Text>{notes}</Text>
          </View>
        )}

        {/* כותרת תחתונה */}
        <View style={styles.footer}>
          <Text>תוקף ההצעה: 14 ימים • המחירים כוללים מע"מ • ט.ל.ח</Text>
        </View>
      </Page>
    </Document>
  );
};

export default PriceQuotePDF;
