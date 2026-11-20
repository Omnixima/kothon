import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { BetaBadge, ISSUES_URL } from "../../shared/BetaBadge";
import { SettingContainer } from "../../ui/SettingContainer";
import { Button } from "../../ui/Button";
import wordmark from "../../../assets/kothon-wordmark.png";

type LinkKey = "website" | "code" | "models" | "privacy" | "report";

/** Who makes Kothon, and where its code, models and privacy policy live. */
const LINKS: { key: LinkKey; url: string }[] = [
  { key: "website", url: "https://omnixima.com" },
  { key: "code", url: "https://github.com/Omnixima/kothon" },
  { key: "models", url: "https://huggingface.co/omnixima" },
  {
    key: "privacy",
    url: "https://github.com/Omnixima/kothon/blob/main/PRIVACY.md",
  },
  { key: "report", url: ISSUES_URL },
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
      {/* Who makes Kothon: the mark, the version, and Omnixima's few words. */}
      <div className="px-4">
        <div className="min-w-0">
          <div className="flex items-end gap-3">
            {/* The কথন wordmark in the brand purple, as in onboarding. */}
            <span
              role="img"
              aria-label={t("settings.about.omnixima.appName")}
              className="block h-12 w-[126px] bg-logo-primary"
              style={{
                maskImage: `url(${wordmark})`,
                WebkitMaskImage: `url(${wordmark})`,
                maskSize: "contain",
                WebkitMaskSize: "contain",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskPosition: "left bottom",
                WebkitMaskPosition: "left bottom",
              }}
            />
            <span className="mb-1 flex items-center gap-2">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="text-sm font-mono text-ink-3">v{version}</span>
              <BetaBadge />
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-logo-primary">
            {t("settings.about.omnixima.by")}
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            {t("settings.about.omnixima.body")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-3">
            {t("settings.about.omnixima.open")}
          </p>
        </div>
      </div>

      <SettingsGroup title={t("settings.about.omnixima.title")}>
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
