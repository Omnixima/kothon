import React from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { commands } from "@/bindings";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";

interface LearnedCorrectionsProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

/** Kothon: just the on/off switch for learning from History fixes. */
export const LearnFromCorrectionsToggle: React.FC<LearnedCorrectionsProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    return (
      <ToggleSwitch
        checked={getSetting("learn_from_corrections_enabled") ?? true}
        onChange={(next) =>
          updateSetting("learn_from_corrections_enabled", next)
        }
        isUpdating={isUpdating("learn_from_corrections_enabled")}
        label={t("settings.advanced.learnFromCorrections.title")}
        description={t("settings.advanced.learnFromCorrections.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  });

/** Kothon: the toggle for learning from History fixes, and what was learned. */
export const LearnedCorrections: React.FC<LearnedCorrectionsProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating, refreshSettings } =
      useSettings();
    const enabled = getSetting("learn_from_corrections_enabled") ?? true;
    const learned = getSetting("learned_corrections") ?? [];

    const remove = async (from: string) => {
      await commands.removeLearnedCorrection(from);
      await refreshSettings();
    };

    return (
      <>
        <ToggleSwitch
          checked={enabled}
          onChange={(next) =>
            updateSetting("learn_from_corrections_enabled", next)
          }
          isUpdating={isUpdating("learn_from_corrections_enabled")}
          label={t("settings.advanced.learnFromCorrections.title")}
          description={t("settings.advanced.learnFromCorrections.description")}
          descriptionMode={descriptionMode}
          grouped={grouped}
        />
        {enabled && (
          <SettingContainer
            title={t("settings.advanced.learnedCorrections.title")}
            description={t("settings.advanced.learnedCorrections.description")}
            descriptionMode={descriptionMode}
            grouped={grouped}
            layout="stacked"
          >
            {learned.length === 0 ? (
              <p className="text-sm text-ink-3">
                {t("settings.advanced.learnedCorrections.empty")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {[...learned].reverse().map((c) => (
                  <span
                    key={c.from}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-wash px-2 py-1 text-sm"
                  >
                    <span className="text-ink-3 line-through">{c.from}</span>
                    <span className="text-ink-3">→</span>
                    <span className="font-medium text-text">{c.to}</span>
                    <button
                      type="button"
                      onClick={() => void remove(c.from)}
                      title={t("settings.advanced.learnedCorrections.remove")}
                      className="ms-0.5 cursor-pointer rounded text-ink-3 hover:text-error"
                    >
                      <X width={13} height={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </SettingContainer>
        )}
      </>
    );
  },
);
