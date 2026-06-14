"use client";

import type { ReactNode } from "react";

import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "@/components/ui/autocomplete";

export type ComboboxOption = {
  // Stable value handed back to onSelect.
  value: string;
  // Text used both for type-to-filter matching and the committed input text.
  // Fold any extra searchable terms (e.g. a file number) in here.
  label: string;
  // Optional rich row content for the dropdown; falls back to `label`.
  node?: ReactNode;
};

// A searchable single-select built on Base UI's Autocomplete, so arrow-key
// navigation and Enter-to-select work out of the box (same primitive as the ⌘K
// command palette). Filtering matches the option `label`. `onSelect` fires for
// both mouse clicks and keyboard Enter.
export function Combobox({
  options,
  onSelect,
  placeholder,
  emptyText,
  autoFocus,
  value,
  defaultValue,
  onValueChange,
  inputClassName,
}: {
  options: ComboboxOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  autoFocus?: boolean;
  // Optionally control (value) or seed (defaultValue) the input text.
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  inputClassName?: string;
}) {
  return (
    <Autocomplete
      defaultValue={defaultValue}
      items={options}
      onValueChange={onValueChange}
      value={value}
    >
      <AutocompleteInput
        autoFocus={autoFocus}
        className={inputClassName}
        placeholder={placeholder}
        showTrigger
      />
      <AutocompletePopup>
        {emptyText ? <AutocompleteEmpty>{emptyText}</AutocompleteEmpty> : null}
        <AutocompleteList>
          {(opt: ComboboxOption) => (
            <AutocompleteItem
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              value={opt.label}
            >
              {opt.node ?? opt.label}
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompletePopup>
    </Autocomplete>
  );
}
