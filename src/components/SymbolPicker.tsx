import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { Company } from '../types';

interface SymbolPickerProps {
  companies: Company[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  isLoading: boolean;
  error?: string | null;
}

export const SymbolPicker: React.FC<SymbolPickerProps> = ({
  companies,
  selectedSymbol,
  onSelectSymbol,
  isLoading,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredCompanies = useMemo(() => {
    if (!searchTerm.trim()) {
      return companies;
    }
    const q = searchTerm.trim().toLowerCase();
    return companies.filter(
      (c) =>
        c.symbol.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.sector && c.sector.toLowerCase().includes(q))
    );
  }, [companies, searchTerm]);

  const selectedCompany = useMemo(() => {
    return companies.find((c) => c.symbol === selectedSymbol);
  }, [companies, selectedSymbol]);

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <div>
          <span className="font-semibold">Companies Query Failed:</span> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
        Stock Symbol
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        id="symbol-picker-trigger"
        onClick={() => !isLoading && setIsOpen(!isOpen)}
        disabled={isLoading || companies.length === 0}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white border border-neutral-300 hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 rounded-lg text-left shadow-xs transition-colors disabled:bg-neutral-100 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2.5 truncate">
          {isLoading ? (
            <span className="text-sm text-neutral-400">Loading companies from Supabase...</span>
          ) : selectedCompany ? (
            <>
              <span className="font-mono font-bold text-base text-neutral-900">
                {selectedCompany.symbol}
              </span>
              <span className="text-sm text-neutral-600 truncate">
                {selectedCompany.name}
              </span>
              {selectedCompany.sector && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-sm bg-neutral-100 text-neutral-600 font-medium whitespace-nowrap">
                  {selectedCompany.sector}
                </span>
              )}
            </>
          ) : companies.length === 0 ? (
            <span className="text-sm text-neutral-500">No companies found in database</span>
          ) : (
            <span className="text-sm text-neutral-500">Select a NEPSE symbol...</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-500 shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          id="symbol-picker-dropdown"
          className="absolute z-50 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden max-h-80 flex flex-col"
        >
          {/* Search bar */}
          <div className="p-2 border-b border-neutral-100 bg-neutral-50 flex items-center gap-2">
            <Search className="w-4 h-4 text-neutral-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              id="symbol-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search symbol, company name, or sector..."
              className="w-full text-sm bg-transparent border-none focus:outline-none text-neutral-900 placeholder-neutral-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-xs text-neutral-400 hover:text-neutral-700 px-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* List items */}
          <div className="overflow-y-auto flex-1 divide-y divide-neutral-100">
            {filteredCompanies.length === 0 ? (
              <div className="p-4 text-center text-sm text-neutral-500">
                No matching symbols found for &ldquo;{searchTerm}&rdquo;
              </div>
            ) : (
              filteredCompanies.map((c) => {
                const isSelected = c.symbol === selectedSymbol;
                return (
                  <button
                    key={c.symbol}
                    type="button"
                    onClick={() => {
                      onSelectSymbol(c.symbol);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-neutral-50 transition-colors ${
                      isSelected ? 'bg-neutral-100/80 font-medium' : ''
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-neutral-900">
                          {c.symbol}
                        </span>
                        {c.sector && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-neutral-200/60 text-neutral-700">
                            {c.sector}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-600 truncate mt-0.5">
                        {c.name}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-neutral-900 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="px-3 py-1.5 bg-neutral-50 border-t border-neutral-100 text-[11px] text-neutral-500 text-right">
            Showing {filteredCompanies.length} of {companies.length} companies
          </div>
        </div>
      )}
    </div>
  );
};
