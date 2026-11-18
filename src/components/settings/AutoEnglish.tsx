import React from "react";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import { useModelStore } from "@/stores/modelStore";
import { getTranslatedModelName } from "@/lib/utils/modelTranslation";
import { Dropdown } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";

interface AutoEnglishProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

const OFF = "off";

/**
 * Kothon: pick an English model that Bengali dictations switch to when
 * they're spoken in English. Lists downloaded models that hear English.
 */
export const AutoEnglish: React.FC<AutoEnglishProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const models = useModelStore((s) => s.models);
    const selected = getSetting("kothon_english_model") ?? null;

    const english = models.filter(
      (m) =>
        m.is_downloaded &&
        !m.id.startsWith("kothon-bn-") &&
        m.supported_languages.some((l) => l.split("-")[0] === "en"),
    );
    const options = [
      { value: OFF, label: t("settings.advanced.autoEnglish.off") },
      ...english.map((m) => ({
        value: m.id,
        label: getTranslatedModelName(m, t),
      })),
    ];

    const onSelect = (value: string) => {
      const id = value === OFF ? null : value;
      updateSetting("kothon_english_model", id);
      // The switch needs the language detector; a no-op when it's there.
      if (id) void commands.downloadLanguageDetector();
    };

    return (
      <SettingContainer
        title={t("settings.advanced.autoEnglish.title")}
        description={
          english.length
            ? t("settings.advanced.autoEnglish.description")
            : t("settings.advanced.autoEnglish.noEnglishModel")
        }
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <Dropdown
          options={options}
          selectedValue={selected ?? OFF}
          onSelect={onSelect}
          disabled={isUpdating("kothon_english_model")}
        />
      </SettingContainer>
    );
  },
);
