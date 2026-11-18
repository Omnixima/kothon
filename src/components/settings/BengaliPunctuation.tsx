import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface BengaliPunctuationProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const BengaliPunctuation: React.FC<BengaliPunctuationProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const enabled = getSetting("bengali_punctuation_enabled") ?? true;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(nextEnabled) =>
          updateSetting("bengali_punctuation_enabled", nextEnabled)
        }
        isUpdating={isUpdating("bengali_punctuation_enabled")}
        label={t("settings.advanced.bengaliPunctuation.title")}
        description={t("settings.advanced.bengaliPunctuation.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);
