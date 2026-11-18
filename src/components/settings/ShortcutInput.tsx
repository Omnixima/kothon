import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { keyNeedsLabel, keySymbol } from "@/lib/utils/keySymbols";
import { formatKeyCombination } from "../../lib/utils/keyboard";
import { ResetButton } from "../ui/ResetButton";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";
import { useOsType } from "../../hooks/useOsType";
import { useShortcutCapture } from "../../hooks/useShortcutCapture";
import { usePressAway } from "../../hooks/usePressAway";

interface ShortcutInputProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  shortcutId: string;
  disabled?: boolean;
}

/**
 * A binding's shortcut; click to record a new one. Clicking elsewhere cancels;
 * Escape is recorded like any key (Cancel's default is Escape).
 */
export const ShortcutInput: React.FC<ShortcutInputProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
  shortcutId,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { getSetting, resetBinding, isUpdating, isLoading } = useSettings();
  const osType = useOsType();
  const { capturing, partial, start, cancel } = useShortcutCapture(
    shortcutId,
    osType,
  );
  const shortcutRef = useRef<HTMLDivElement | null>(null);

  const bindings = getSetting("bindings") || {};

  usePressAway(capturing, shortcutRef, cancel);

  // If still loading, show loading state
  if (isLoading) {
    return (
      <SettingContainer
        title={t("settings.general.shortcut.title")}
        description={t("settings.general.shortcut.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <div className="text-sm text-ink-3">
          {t("settings.general.shortcut.loading")}
        </div>
      </SettingContainer>
    );
  }

  // If no bindings are loaded, show empty state
  if (Object.keys(bindings).length === 0) {
    return (
      <SettingContainer
        title={t("settings.general.shortcut.title")}
        description={t("settings.general.shortcut.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <div className="text-sm text-ink-3">
          {t("settings.general.shortcut.none")}
        </div>
      </SettingContainer>
    );
  }

  const binding = bindings[shortcutId];
  if (!binding) {
    return (
      <SettingContainer
        title={t("settings.general.shortcut.title")}
        description={t("settings.general.shortcut.notFound")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <div className="text-sm text-ink-3">
          {t("settings.general.shortcut.none")}
        </div>
      </SettingContainer>
    );
  }

  // Get translated name and description for the binding
  const translatedName = t(
    `settings.general.shortcut.bindings.${shortcutId}.name`,
    binding.name,
  );
  const translatedDescription = t(
    `settings.general.shortcut.bindings.${shortcutId}.description`,
    binding.description,
  );

  return (
    <SettingContainer
      title={translatedName}
      description={translatedDescription}
      descriptionMode={descriptionMode}
      grouped={grouped}
      disabled={disabled}
      layout="horizontal"
    >
      <div className="flex items-center space-x-1">
        {capturing ? (
          <div
            ref={shortcutRef}
            className="px-2 py-1 text-sm font-semibold border border-logo-primary bg-logo-primary/20 rounded-md"
          >
            {partial
              ? formatKeyCombination(partial, osType)
              : t("settings.general.shortcut.pressKeys")}
          </div>
        ) : (
          <button
            type="button"
            title={formatKeyCombination(binding.current_binding, osType)}
            className="flex cursor-pointer items-center gap-1 rounded-lg p-0.5 hover:bg-logo-primary/10"
            onClick={start}
          >
            {/* Kothon: one keycap per key, as Mac symbols. */}
            {formatKeyCombination(binding.current_binding, osType)
              .split(" + ")
              .map((key) => (
                <kbd
                  key={key}
                  className="inline-flex min-w-8 items-center justify-center gap-1 rounded-[8px] border border-b-[3px] border-line-strong bg-background px-2 py-0.5 font-sans text-[15px] font-semibold text-text"
                >
                  {keySymbol(key)}
                  {keyNeedsLabel(key) && (
                    <span className="text-[11px] font-medium text-ink-2">
                      {key}
                    </span>
                  )}
                </kbd>
              ))}
          </button>
        )}
        <ResetButton
          ariaLabel={t("common.resetSetting", { setting: translatedName })}
          onClick={() => resetBinding(shortcutId)}
          disabled={isUpdating(`binding_${shortcutId}`)}
        />
      </div>
    </SettingContainer>
  );
};
