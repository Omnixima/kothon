import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface EnglishWordsProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const EnglishWords: React.FC<EnglishWordsProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const enabled = getSetting("english_words_in_english") ?? false;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(nextEnabled) =>
          updateSetting("english_words_in_english", nextEnabled)
        }
        isUpdating={isUpdating("english_words_in_english")}
        label={t("settings.advanced.englishWords.title")}
        description={t("settings.advanced.englishWords.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);
