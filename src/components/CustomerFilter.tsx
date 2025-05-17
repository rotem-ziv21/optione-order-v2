import React, { useState, useEffect, useRef } from 'react';
import { Filter, X } from 'lucide-react';

interface CustomerFilterProps {
  onFilterChange: (filters: CustomerFilterCriteria) => void;
  activeFilters: CustomerFilterCriteria;
}

export interface CustomerFilterCriteria {
  totalAmountGreaterThan?: number;
  totalAmountLessThan?: number;
  totalAmountEqualTo?: number;
}

const CustomerFilter: React.FC<CustomerFilterProps> = ({ onFilterChange, activeFilters }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [greaterThan, setGreaterThan] = useState<string>(activeFilters.totalAmountGreaterThan?.toString() || '');
  const [lessThan, setLessThan] = useState<string>(activeFilters.totalAmountLessThan?.toString() || '');
  const [equalTo, setEqualTo] = useState<string>(activeFilters.totalAmountEqualTo?.toString() || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // עדכון ערכי הטופס כאשר הפילטרים הפעילים משתנים
  useEffect(() => {
    setGreaterThan(activeFilters.totalAmountGreaterThan?.toString() || '');
    setLessThan(activeFilters.totalAmountLessThan?.toString() || '');
    setEqualTo(activeFilters.totalAmountEqualTo?.toString() || '');
  }, [activeFilters]);

  // סגירת התפריט בלחיצה מחוץ לאלמנט
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleApplyFilter = () => {
    const filters: CustomerFilterCriteria = {};
    
    if (greaterThan && !isNaN(Number(greaterThan))) {
      // Make sure we're storing a number, not a string
      filters.totalAmountGreaterThan = Number(greaterThan);
      console.log(`Setting filter: greater than ${filters.totalAmountGreaterThan}`);
    }
    
    if (lessThan && !isNaN(Number(lessThan))) {
      // Make sure we're storing a number, not a string
      filters.totalAmountLessThan = Number(lessThan);
      console.log(`Setting filter: less than ${filters.totalAmountLessThan}`);
    }
    
    if (equalTo && !isNaN(Number(equalTo))) {
      // Make sure we're storing a number, not a string
      filters.totalAmountEqualTo = Number(equalTo);
      console.log(`Setting filter: equal to ${filters.totalAmountEqualTo}`);
    }
    
    onFilterChange(filters);
    setIsOpen(false);
  };

  const handleClearFilter = () => {
    setGreaterThan('');
    setLessThan('');
    setEqualTo('');
    onFilterChange({});
  };

  // בדיקה אם יש פילטרים פעילים
  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200 ${hasActiveFilters 
          ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
      >
        <Filter className="w-5 h-5" />
        {hasActiveFilters && (
          <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
            {Object.keys(activeFilters).length}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="absolute z-20 left-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium text-gray-800">סינון לפי סכום הזמנות</h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">גדול מ:</label>
              <input
                type="number"
                min="0"
                value={greaterThan}
                onChange={(e) => setGreaterThan(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="הזן סכום"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">קטן מ:</label>
              <input
                type="number"
                min="0"
                value={lessThan}
                onChange={(e) => setLessThan(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="הזן סכום"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שווה ל:</label>
              <input
                type="number"
                min="0"
                value={equalTo}
                onChange={(e) => setEqualTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="הזן סכום"
              />
            </div>
            
            <div className="flex justify-between pt-3 mt-2 border-t border-gray-100">
              <button
                onClick={handleClearFilter}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                נקה הכל
              </button>
              
              <button
                onClick={handleApplyFilter}
                className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-md hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
              >
                החל סינון
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerFilter;
