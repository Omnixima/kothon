import React from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";

interface BengaliNumbersProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

/** Kothon: how spoken numbers are written in Bengali text. */
export const BengaliNumbers: React.FC<BengaliNumbersProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const options = [
      {
        value: "bengali",
        label: t("settings.advanced.bengaliNumbers.bengali"),
      },
      { value: "latin", label: t("settings.advanced.bengaliNumbers.latin") },
      { value: "off", label: t("settings.advanced.bengaliNumbers.off") },
    ];
    return (
      <SettingContainer
        title={t("settings.advanced.bengaliNumbers.title")}
        description={t("settings.advanced.bengaliNumbers.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <Dropdown
          options={options}
          selectedValue={getSetting("bengali_numbers") ?? "bengali"}
          onSelect={(value) => updateSetting("bengali_numbers", value)}
          disabled={isUpdating("bengali_numbers")}
        />
      </SettingContainer>
    );
  },
);
