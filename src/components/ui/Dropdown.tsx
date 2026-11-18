import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

export interface DropdownOption {
  value: string;
  label: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  className?: string;
  menuClassName?: string;
  selectedValue: string | null;
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onOpen?: () => void;
  /** Where the menu opens: below the button (default), or above it. */
  placement?: "below" | "above";
  /** Highlight colour for hover and selection. */
  tone?: "brand" | "neutral";
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  selectedValue,
  onSelect,
  className = "",
  menuClassName,
  placeholder = "Select an option...",
  disabled = false,
  onOpen,
  placement = "below",
  tone = "brand",
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Kothon: the menu is portaled to <body> with fixed coordinates, so frosted
  // cards (backdrop-filter makes a stacking context) can't clip or cover it.
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const gap = 4;
      const margin = 8;
      const below = window.innerHeight - r.bottom - gap - margin;
      const above = r.top - gap - margin;
      const wanted = 240;
      const up =
        placement === "above"
          ? above >= 120 || above > below
          : below < Math.min(wanted, 160) && above > below;
      // Keep a menu wider than its button inside the window.
      const menuWidth = menuRef.current?.offsetWidth ?? r.width;
      setPos({
        left: Math.max(
          margin,
          Math.min(r.left, window.innerWidth - menuWidth - margin),
        ),
        width: r.width,
        ...(up
          ? { bottom: window.innerHeight - r.top + gap }
          : { top: r.bottom + gap }),
        maxHeight: Math.max(120, Math.min(wanted, up ? above : below)),
      });
    };
    place();
    // Once more after the menu has rendered and has a width.
    const frame = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    // Capture scrolls of any ancestor, not just the window.
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isOpen, placement]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // The trigger's hover; in the menu, hover is grey so it never looks chosen.
  const hover =
    tone === "neutral" ? "hover:bg-wash" : "hover:bg-logo-primary/10";
  const chosen = tone === "neutral" ? "bg-line" : "bg-logo-primary/15";

  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );

  const handleSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) onOpen?.();
    setIsOpen(!isOpen);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !isOpen || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      className={`relative ${className}`}
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        ref={triggerRef}
        className={`px-3 py-[6px] text-sm font-medium bg-background/70 border border-line rounded-xl shadow-[0_1px_2px_rgba(40,10,70,0.06)] min-w-[200px] w-full text-start grid grid-cols-[1fr_auto] gap-2 items-center transition-all duration-150 ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : `${hover} cursor-pointer ${tone === "neutral" ? "hover:border-ink-3" : "hover:border-logo-primary"}`
        }`}
        onClick={handleToggle}
        disabled={disabled}
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "transform rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen &&
        !disabled &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            onKeyDown={handleKeyDown}
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              minWidth: pos.width,
              width: menuClassName ? undefined : pos.width,
              maxHeight: pos.maxHeight,
            }}
            className={`bg-background border border-line rounded-xl shadow-xl z-[1000] overflow-y-auto p-1 ${
              menuClassName ?? ""
            }`}
          >
            {options.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-ink-3">
                {t("common.noOptionsFound")}
              </div>
            ) : (
              options.map((option) => {
                const isChosen = selectedValue === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-md px-2 text-sm text-start transition-colors duration-150 ${
                      option.description ? "py-2" : "py-1.5"
                    } ${isChosen ? chosen : "hover:bg-wash"} ${
                      option.disabled ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    onClick={() => handleSelect(option.value)}
                    disabled={option.disabled}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block whitespace-normal break-words ${
                          isChosen ? "font-semibold" : ""
                        }`}
                      >
                        {option.label}
                      </span>
                      {option.description && (
                        <span className="mt-0.5 block whitespace-normal text-xs font-normal leading-snug text-ink-3">
                          {option.description}
                        </span>
                      )}
                    </span>
                    {isChosen && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="shrink-0 text-ink-2"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};
