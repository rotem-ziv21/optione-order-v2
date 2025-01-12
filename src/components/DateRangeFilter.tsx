import React from 'react';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { DateRange, DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

interface DateRangeFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

export default function DateRangeFilter({ dateRange, onDateRangeChange }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  console.log('DateRangeFilter props:', { dateRange, isOpen });

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) {
      return 'בחר תאריכים';
    }

    if (!range.to) {
      return format(range.from, 'd בMMMM yyyy', { locale: he });
    }

    return `${format(range.from, 'd בMMMM yyyy', { locale: he })} - ${format(range.to, 'd בMMMM yyyy', { locale: he })}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <CalendarIcon className="w-4 h-4" />
        <span>{formatDateRange(dateRange)}</span>
      </button>

      {isOpen && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-lg border border-gray-200" style={{ width: '400px' }}>
          <div className="p-6">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-2 left-2 text-gray-400 hover:text-gray-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <DayPicker
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                onDateRangeChange(range);
                if (range?.to) {
                  setIsOpen(false);
                }
              }}
              locale={he}
              showOutsideDays
              fixedWeeks
              className="bg-white rdp-dir-rtl"
              dir="rtl"
              styles={{
                root: { width: '100%', fontSize: '1.1rem' },
                months: { width: '100%' },
                month: { width: '100%' },
                table: { width: '100%' },
                day: { width: '48px', height: '48px', margin: '2px' },
                caption: { fontSize: '1.2rem', marginBottom: '12px' },
                head_cell: { width: '48px', padding: '8px 0', fontSize: '1rem' }
              }}
              modifiersStyles={{
                selected: {
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontWeight: 'bold'
                },
                today: {
                  color: '#3b82f6',
                  fontWeight: 'bold',
                  border: '2px solid #3b82f6'
                }
              }}
              footer={
                <div className="mt-4 text-sm text-gray-500 text-center">
                  לחץ על תאריך התחלה וסיום
                </div>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
