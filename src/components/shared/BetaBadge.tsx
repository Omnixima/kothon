import React from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";

export const ISSUES_URL =
  "https://github.com/Omnixima/kothon/issues/new/choose";

/** Kothon is early-access: a small badge that opens the issue tracker. */
export const BetaBadge: React.FC<{ tone?: "brand" | "light" }> = ({
  tone = "brand",
}) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => void openUrl(ISSUES_URL)}
      title={t("beta.tooltip")}
      className={`cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        tone === "light"
          ? "bg-white/15 text-white hover:bg-white/25"
          : "bg-warning-wash text-warning hover:brightness-95"
      }`}
    >
      {t("beta.label")}
    </button>
  );
};
