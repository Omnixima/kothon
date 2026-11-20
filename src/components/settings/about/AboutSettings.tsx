import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { BetaBadge, ISSUES_URL } from "../../shared/BetaBadge";
import { SettingContainer } from "../../ui/SettingContainer";
import { Button } from "../../ui/Button";
import { AppDataDirectory } from "../AppDataDirectory";
import { AppLanguageSelector } from "../AppLanguageSelector";
import { ShowWhatsNewOnUpdate } from "../ShowWhatsNewOnUpdate";
import { ThemeSelector } from "../ThemeSelector";
import { LogDirectory } from "../debug";

type LinkKey = "website" | "models" | "privacy";

/** Who makes Kothon, and where its code, models and privacy policy live. */
const LINKS: { key: LinkKey; url: string }[] = [
  { key: "website", url: "https://omnixima.com" },
  { key: "models", url: "https://huggingface.co/omnixima" },
  {
    key: "privacy",
    url: "https://github.com/Omnixima/kothon/blob/main/PRIVACY.md",
  },
];

type CreditKey =
  | "handy"
  | "transcribe"
  | "candle"
  | "silero"
  | "tauri"
  | "noto"
  | "accurate"
  | "fast"
  | "punctuation"
  | "whisper";

interface Credit {
  key: CreditKey;
  /** A proper name, the same in every language. */
  name: string;
  license: string;
}

/** Open-source software and models Kothon is built on (as in the mobile app). */
const SOFTWARE: Credit[] = [
  { key: "handy", name: "Handy", license: "MIT" },
  {
    key: "transcribe",
    name: "transcribe.cpp, whisper.cpp, ggml",
    license: "MIT",
  },
  { key: "candle", name: "Candle, Tokenizers", license: "MIT / Apache-2.0" },
  { key: "silero", name: "Silero VAD", license: "MIT" },
  { key: "tauri", name: "Tauri", license: "MIT / Apache-2.0" },
  {
    key: "noto",
    name: "Noto Sans Bengali",
    license: "SIL Open Font License 1.1",
  },
];

const MODELS: Credit[] = [
  {
    key: "accurate",
    name: "BengaliAI Whisper Medium (নিখুঁত)",
    license: "Apache-2.0",
  },
  {
    key: "fast",
    name: "Bangla FastConformer CTC 116M (দ্রুত)",
    license: "Apache-2.0",
  },
  {
    key: "punctuation",
    name: "MuRIL punctuation, 6 layers (যতিচিহ্ন)",
    license: "Apache-2.0",
  },
  { key: "whisper", name: "Whisper", license: "MIT" },
];

const CreditList: React.FC<{ title: string; credits: Credit[] }> = ({
  title,
  credits,
}) => {
  const { t } = useTranslation();
  return (
    <div className="px-4 py-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="space-y-2">
        {credits.map((c) => (
          <li key={c.key} className="text-sm">
            <div className="font-medium">{c.name}</div>
            <div className="text-ink-3">
              {t(`settings.about.acknowledgments.credits.${c.key}`)}
            </div>
            <div className="text-xs font-medium text-logo-primary">
              {c.license}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const AboutSettings: React.FC = () => {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const appVersion = await getVersion();
        setVersion(appVersion);
      } catch (error) {
        console.error("Failed to get app version:", error);
        setVersion("0.1.2");
      }
    };

    fetchVersion();
  }, []);

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title={t("settings.about.title")}>
        <AppLanguageSelector descriptionMode="tooltip" grouped={true} />
        <ThemeSelector descriptionMode="tooltip" grouped={true} />
        <SettingContainer
          title={t("settings.about.version.title")}
          description={t("settings.about.version.description")}
          grouped={true}
        >
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="text-sm font-mono">v{version}</span>
            <BetaBadge />
          </span>
        </SettingContainer>
        <SettingContainer
          title={t("beta.reportTitle")}
          description={t("beta.reportDescription")}
          grouped={true}
        >
          <button
            type="button"
            onClick={() => void openUrl(ISSUES_URL)}
            className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:border-logo-primary hover:text-logo-primary"
          >
            {t("beta.reportButton")}
          </button>
        </SettingContainer>

        <ShowWhatsNewOnUpdate descriptionMode="tooltip" grouped={true} />

        <SettingContainer
          title={t("settings.about.sourceCode.title")}
          description={t("settings.about.sourceCode.description")}
          grouped={true}
        >
          <Button
            variant="secondary"
            size="md"
            onClick={() => openUrl("https://github.com/Omnixima/kothon")}
          >
            {t("settings.about.sourceCode.button")}
          </Button>
        </SettingContainer>

        <AppDataDirectory descriptionMode="tooltip" grouped={true} />
        <LogDirectory grouped={true} />
      </SettingsGroup>

      <SettingsGroup title={t("settings.about.omnixima.title")}>
        <div className="px-4 py-3 text-sm leading-relaxed">
          <p>{t("settings.about.omnixima.body")}</p>
          <p className="mt-2 text-ink-3">{t("settings.about.omnixima.open")}</p>
        </div>
        {LINKS.map((link) => (
          <SettingContainer
            key={link.key}
            title={t(`settings.about.omnixima.links.${link.key}.title`)}
            description={t(
              `settings.about.omnixima.links.${link.key}.description`,
            )}
            grouped={true}
          >
            <Button
              variant="secondary"
              size="md"
              onClick={() => void openUrl(link.url)}
            >
              {t(`settings.about.omnixima.links.${link.key}.button`)}
            </Button>
          </SettingContainer>
        ))}
      </SettingsGroup>

      <SettingsGroup title={t("settings.about.acknowledgments.title")}>
        <CreditList
          title={t("settings.about.acknowledgments.software")}
          credits={SOFTWARE}
        />
        <CreditList
          title={t("settings.about.acknowledgments.models")}
          credits={MODELS}
        />
        <p className="px-4 py-3 text-sm text-ink-3">
          {t("settings.about.acknowledgments.footer", {
            year: new Date().getFullYear(),
          })}
        </p>
      </SettingsGroup>
    </div>
  );
};
