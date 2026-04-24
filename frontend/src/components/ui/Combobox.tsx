import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Check, ChevronDown, Plus } from 'lucide-react';

export interface ComboboxOption {
  label: string;
  value: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[] | string[];
  placeholder?: string;
  icon?: React.ReactNode;
}

export function Combobox({ value, onChange, options, placeholder = "Search or select...", icon }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Normalize options to object format
  const normalizedOptions: ComboboxOption[] = options.map(opt => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = query === '' 
    ? normalizedOptions 
    : normalizedOptions.filter(option => option.label.toLowerCase().includes(query.toLowerCase()));

  // The displayed value in the textbox if closed is the formal label, not the ID.
  const displayLabel = isOpen ? query : (normalizedOptions.find(o => o.value === value)?.label || value);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          {icon || <MapPin className="w-4 h-4" />}
        </div>
        
        <input
          type="text"
          value={displayLabel}
          onFocus={() => { setIsOpen(true); setQuery(displayLabel); }}
          onChange={(e) => {
            setQuery(e.target.value);
            // Allow raw typing to immediately reflect in state if they don't pick a list item
            onChange(e.target.value); 
          }}
          className="pl-10 input-field cursor-text bg-white w-full pr-10"
          placeholder={placeholder}
          autoComplete="off"
        />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-500' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-200/60 max-h-60 overflow-y-auto overflow-x-hidden p-1.5 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-[12px] text-slate-500 text-center flex flex-col items-center gap-1.5">
               <span className="font-medium text-slate-700">No matching places found.</span>
               <span className="text-slate-400">"{query}" will be used as a custom value.</span>
               <button 
                  onClick={() => setIsOpen(false)}
                  className="mt-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-md font-medium flex items-center hover:bg-emerald-100 transition"
               >
                 <Check className="w-3.5 h-3.5 mr-1" /> Use Custom Value
               </button>
            </div>
          ) : (
            filteredOptions.map((option, idx) => {
              const isSelected = value === option.value;
              return (
                <button
                  key={`${option.value}-${idx}`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-all flex items-center justify-between group ${
                    isSelected 
                      ? 'bg-emerald-50 text-emerald-700 font-medium' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate pr-4">{option.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
