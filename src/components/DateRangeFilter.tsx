import React from 'react';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import type { DateRange } from 'react-day-picker';

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
      return format(range.from, 'dd/MM/yyyy', { locale: he });
    }

    return `${format(range.from, 'dd/MM/yyyy', { locale: he })} - ${format(range.to, 'dd/MM/yyyy', { locale: he })}`;
  };

  return (
    <div className="relative">
      <button
        type="button"
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
            <DatePicker
              selected={dateRange?.from}
              onChange={(dates) => {
                const [start, end] = dates;
                if (start) {
                  setIsOpen(!end); // Close the picker when both dates are selected
                  onDateRangeChange({ from: start, to: end });
                } else {
                  onDateRangeChange(undefined);
                }
              }}
              startDate={dateRange?.from}
              endDate={dateRange?.to}
              selectsRange
              inline
              locale={he}
              dateFormat="dd/MM/yyyy"
            />
          </div>
        </div>
      )}
    </div>
  );
}
