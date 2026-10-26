import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, parseISO, startOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';

const parseValueToDate = (val) => {
  if (!val) return startOfMonth(new Date());
  if (val instanceof Date) return startOfMonth(val);
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}$/.test(val)) {
      try {
        return parseISO(`${val}-01`);
      } catch {}
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return startOfMonth(parsed);
    }
  }
  return startOfMonth(new Date());
};

const MonthPicker = ({ value, onChange, className = '' }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const currentDate = parseValueToDate(value);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const months = Array.from({ length: 24 }, (_, i) => {
    const date = subMonths(startOfMonth(new Date()), 11 - i);
    return format(date, 'yyyy-MM');
  });

  const handleSelect = (month) => {
    onChange(month);
    setOpen(false);
  };

  const handlePrev = () => {
    const newDate = subMonths(currentDate, 1);
    onChange(format(newDate, 'yyyy-MM'));
  };

  const handleNext = () => {
    const newDate = addMonths(currentDate, 1);
    onChange(format(newDate, 'yyyy-MM'));
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrev}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 w-full sm:w-40"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>{format(currentDate, 'MMM yyyy')}</span>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        <button
          onClick={handleNext}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
          role="listbox"
          aria-label="Select month"
        >
          {months.map((month) => {
            const date = parseISO(`${month}-01`);
            const isSelected = isSameMonth(date, currentDate);
            return (
              <button
                key={month}
                onClick={() => handleSelect(month)}
                className={`w-full px-4 py-2 text-left text-sm ${
                  isSelected
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                {format(date, 'MMMM yyyy')}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MonthPicker;