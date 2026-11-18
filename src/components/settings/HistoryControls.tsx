import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { commands } from "@/bindings";
import { notify } from "@/stores/noticeStore";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { SettingContainer } from "../ui/SettingContainer";
import { Button } from "../ui/Button";
import { useSettings } from "../../hooks/useSettings";

interface Props {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

/** Kothon: keep dictations in History, or save nothing at all. */
export const HistoryToggle: React.FC<Props> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    return (
      <ToggleSwitch
        checked={getSetting("history_enabled") ?? true}
        onChange={(next) => updateSetting("history_enabled", next)}
        isUpdating={isUpdating("history_enabled")}
        label={t("settings.advanced.historyEnabled.title")}
        description={t("settings.advanced.historyEnabled.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);

/** A button that clears all history after a second, confirming click. */
export const ClearHistoryButton: React.FC<{ compact?: boolean }> = ({
  compact = false,
}) => {
  const { t } = useTranslation();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Disarm if the confirming click doesn't come soon.
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);

  const onClick = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    const result = await commands.clearHistory();
    setBusy(false);
    setArmed(false);
    if (result.status === "error") {
      notify({ title: t("settings.advanced.clearHistory.error") });
    }
  };

  return (
    <Button
      variant={armed ? "danger" : compact ? "ghost" : "secondary"}
      size="sm"
      onClick={() => void onClick()}
      disabled={busy}
      className="inline-flex items-center gap-1.5"
    >
      <Trash2 width={14} height={14} />
      {armed
        ? t("settings.advanced.clearHistory.confirm")
        : t("settings.advanced.clearHistory.button")}
    </Button>
  );
};

/** Kothon: the clear-history row for settings. */
export const ClearHistory: React.FC<Props> = ({
  descriptionMode = "tooltip",
  grouped = false,
}) => {
  const { t } = useTranslation();
  return (
    <SettingContainer
      title={t("settings.advanced.clearHistory.title")}
      description={t("settings.advanced.clearHistory.description")}
      descriptionMode={descriptionMode}
      grouped={grouped}
    >
      <ClearHistoryButton />
    </SettingContainer>
  );
};
