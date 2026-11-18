import React from "react";
import { useTranslation } from "react-i18next";
import { Cog, FlaskConical, History, Info, Sparkles, Cpu } from "lucide-react";
import HandyTextLogo from "./icons/HandyTextLogo";
import { BetaBadge } from "./shared/BetaBadge";
import HandyHand from "./icons/HandyHand";
import HandyMascot from "./icons/HandyMascot";
import { useSettings } from "../hooks/useSettings";
import {
  GeneralSettings,
  AdvancedSettings,
  HistorySettings,
  AboutSettings,
  PostProcessingSettings,
  ModelsSettings,
} from "./settings";

export type SidebarSection = keyof typeof SECTIONS_CONFIG;

interface IconProps {
  width?: number | string;
  height?: number | string;
  size?: number | string;
  className?: string;
  [key: string]: any;
}

interface SectionConfig {
  labelKey: string;
  icon: React.ComponentType<IconProps>;
  /** `null` when App renders the section itself (Debug, with its handlers). */
  component: React.ComponentType | null;
  enabled: (settings: any) => boolean;
}

export const SECTIONS_CONFIG = {
  home: {
    labelKey: "sidebar.home",
    icon: HandyHand,
    component: null,
    enabled: () => true,
  },
  general: {
    labelKey: "sidebar.general",
    icon: HandyHand,
    component: GeneralSettings,
    enabled: () => true,
  },
  history: {
    labelKey: "sidebar.history",
    icon: History,
    component: HistorySettings,
    enabled: () => true,
  },
  models: {
    labelKey: "sidebar.models",
    icon: Cpu,
    component: ModelsSettings,
    enabled: () => true,
  },
  advanced: {
    labelKey: "sidebar.advanced",
    icon: Cog,
    component: AdvancedSettings,
    enabled: () => true,
  },
  postprocessing: {
    labelKey: "sidebar.postProcessing",
    icon: Sparkles,
    component: PostProcessingSettings,
    enabled: (settings) => settings?.post_process_enabled ?? false,
  },
  debug: {
    labelKey: "sidebar.debug",
    icon: FlaskConical,
    component: null,
    enabled: (settings) => settings?.debug_mode ?? false,
  },
  about: {
    labelKey: "sidebar.about",
    icon: Info,
    component: AboutSettings,
    enabled: () => true,
  },
} as const satisfies Record<string, SectionConfig>;

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

/** Sections reached from the Settings tab, shown as its sub-tabs. */
export const SETTINGS_SECTIONS: SidebarSection[] = [
  "general",
  "advanced",
  "postprocessing",
  "debug",
  "about",
];

const TOP_TABS: { id: SidebarSection; labelKey: string }[] = [
  { id: "home", labelKey: "sidebar.home" },
  { id: "history", labelKey: "sidebar.history" },
  { id: "models", labelKey: "sidebar.models" },
  { id: "general", labelKey: "sidebar.settings" },
];

/**
 * Kothon's top bar: the logo, then pill tabs. (Kept under the Sidebar name so
 * App's imports stay put; it no longer sits at the side.)
 */
export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { t } = useTranslation();
  const inSettings = SETTINGS_SECTIONS.includes(activeSection);

  return (
    <header className="flex items-center gap-3.5 px-6 pt-4 pb-2.5">
      <HandyMascot className="h-[34px] w-[34px]" />
      <HandyTextLogo height={30} />
      <BetaBadge />
      <nav className="ms-auto flex gap-0.5 rounded-[14px] border border-logo-primary/10 bg-background/60 p-1 backdrop-blur-md">
        {TOP_TABS.map((tab) => {
          const active =
            tab.id === "general" ? inSettings : activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSectionChange(tab.id)}
              className={`cursor-pointer rounded-[10px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                active
                  ? "kothon-tab-active text-white"
                  : "text-ink-2 hover:text-text"
              }`}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </nav>
    </header>
  );
};

/** The Settings tab's own row of sub-tabs. */
export const SettingsSubTabs: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const sections = SETTINGS_SECTIONS.filter((id) =>
    SECTIONS_CONFIG[id].enabled(settings),
  );
  return (
    <div className="flex w-full max-w-3xl gap-1.5">
      {sections.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onSectionChange(id)}
          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            activeSection === id
              ? "bg-logo-primary/15 text-logo-primary"
              : "text-ink-3 hover:text-text"
          }`}
        >
          {t(SECTIONS_CONFIG[id].labelKey)}
        </button>
      ))}
    </div>
  );
};
