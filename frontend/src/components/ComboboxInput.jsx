import { useEffect, useId, useMemo, useRef, useState } from 'react';

const baseInputClass = 'w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 pr-9 text-sm text-gray-200 placeholder:text-gray-600 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function ComboboxInput({
  label,
  name,
  value,
  suggestions = [],
  onChange,
  onCommit,
  placeholder = '',
  fullWidth = false,
}) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const wrapperRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredSuggestions = useMemo(() => {
    const query = normalize(value);
    const uniqueSuggestions = [...new Set((suggestions || []).map((item) => String(item).trim()).filter(Boolean))];

    if (!query) return uniqueSuggestions.slice(0, 8);

    return uniqueSuggestions
      .filter((item) => normalize(item).includes(query))
      .slice(0, 8);
  }, [suggestions, value]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const commitValue = (nextValue) => {
    onChange(name, nextValue);
    onCommit?.(name, nextValue);
    setIsOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredSuggestions.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    const currentActiveIndex = Math.min(activeIndex, Math.max(filteredSuggestions.length - 1, 0));

    if (event.key === 'Enter' && isOpen && filteredSuggestions[currentActiveIndex]) {
      event.preventDefault();
      commitValue(filteredSuggestions[currentActiveIndex]);
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const safeActiveIndex = Math.min(activeIndex, Math.max(filteredSuggestions.length - 1, 0));
  const showDropdown = Boolean(isOpen && (filteredSuggestions.length > 0 || String(value || '').trim()));

  return (
    <div ref={wrapperRef} className={`relative flex flex-col gap-1.5 ${fullWidth ? 'col-span-2' : 'col-span-1'}`}>
      <label htmlFor={inputId} className="text-xs font-semibold text-gray-400">{label}</label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          name={name}
          value={value || ''}
          onChange={(event) => {
            onChange(name, event.target.value);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onFocus={() => {
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onBlur={() => onCommit?.(name, value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={baseInputClass}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={showDropdown && filteredSuggestions[safeActiveIndex] ? `${listboxId}-${safeActiveIndex}` : undefined}
        />
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200"
          aria-label={`Abrir sugestões de ${label}`}
          tabIndex={-1}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-56 overflow-auto rounded-xl border border-gray-700 bg-gray-800/98 py-1 shadow-2xl shadow-black/40 backdrop-blur"
        >
          {filteredSuggestions.length > 0 ? filteredSuggestions.map((suggestion, index) => (
            <button
              key={`${suggestion}-${index}`}
              id={`${listboxId}-${index}`}
              type="button"
              role="option"
              aria-selected={index === safeActiveIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commitValue(suggestion)}
              className={`w-full px-3.5 py-2 text-left text-sm transition-colors ${
                index === safeActiveIndex
                  ? 'bg-blue-600/80 text-white'
                  : 'text-gray-200 hover:bg-gray-700/70'
              }`}
            >
              {suggestion}
            </button>
          )) : (
            <div className="px-3.5 py-3 text-sm text-gray-400">Sem sugestões para este texto.</div>
          )}
        </div>
      )}
    </div>
  );
}
