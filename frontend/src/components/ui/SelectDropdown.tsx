import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | string)[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
}

export function SelectDropdown({
  value, onChange, options, placeholder = 'Select...', className = '', icon
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const normalized: SelectOption[] = options.map(o =>
    typeof o === 'string' ? { label: o, value: o } : o
  );

  const selected = normalized.find(o => o.value === value);
  const displayLabel = selected?.label || placeholder;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className={`input-field w-full flex items-center justify-between gap-2 text-left cursor-pointer select-none ${!selected ? 'text-textSecondary' : 'text-textPrimary'}`}
      >
        <span className="flex items-center gap-2 truncate">
          {icon && <span className="text-textSecondary shrink-0">{icon}</span>}
          <span className="truncate text-[13px]">{displayLabel}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-textSecondary shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-500' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-emerald-50/95 backdrop-blur-2xl rounded-xl shadow-2xl shadow-emerald-900/10 border border-emerald-200/70 p-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {normalized.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-[10px] text-[13px] flex items-center justify-between transition-all ${
                  isSelected
                    ? 'bg-emerald-600 text-white font-medium shadow-lg shadow-emerald-600/30'
                    : 'text-emerald-950 font-medium hover:bg-bgSecondary hover:shadow-sm border border-transparent hover:border-emerald-100/50'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
