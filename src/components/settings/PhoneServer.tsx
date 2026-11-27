import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, RefreshCw } from "lucide-react";
import { commands, type PhonePairing } from "@/bindings";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { SettingContainer } from "../ui/SettingContainer";
import { Button } from "../ui/Button";
import { useSettings } from "../../hooks/useSettings";
import { notify } from "@/stores/noticeStore";

interface Props {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

/** Kothon: let a phone send its dictations to this computer, paired by QR. */
export const PhoneServer: React.FC<Props> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const enabled = getSetting("phone_server_enabled") ?? false;
    const [pairing, setPairing] = useState<PhonePairing | null>(null);
    const [resetting, setResetting] = useState(false);

    const refresh = useCallback(async () => {
      setPairing(await commands.getPhonePairing());
    }, []);

    useEffect(() => {
      if (!enabled) {
        setPairing(null);
        return;
      }
      void refresh();
      // The computer's address can change (another Wi-Fi, Tailscale on/off).
      const id = setInterval(() => void refresh(), 15000);
      return () => clearInterval(id);
    }, [enabled, refresh]);

    const pairAgain = async () => {
      setResetting(true);
      setPairing(await commands.resetPhoneServerKey());
      setResetting(false);
    };

    const copyLink = async () => {
      if (!pairing) return;
      try {
        await navigator.clipboard.writeText(pairing.link);
        notify({ title: t("settings.advanced.phoneServer.linkCopied") });
      } catch {
        // Nothing to tell: the QR code still pairs.
      }
    };

    return (
      <>
        <ToggleSwitch
          checked={enabled}
          onChange={(next) => updateSetting("phone_server_enabled", next)}
          isUpdating={isUpdating("phone_server_enabled")}
          label={t("settings.advanced.phoneServer.title")}
          description={t("settings.advanced.phoneServer.description")}
          descriptionMode={descriptionMode}
          grouped={grouped}
        />
        {enabled && pairing && (
          <SettingContainer
            title={t("settings.advanced.phoneServer.pairTitle")}
            description={t("settings.advanced.phoneServer.pairDescription")}
            descriptionMode={descriptionMode}
            grouped={grouped}
            layout="stacked"
          >
            {!pairing.running ? (
              <p className="text-sm text-red-500">
                {t("settings.advanced.phoneServer.notRunning")}
              </p>
            ) : pairing.urls.length === 0 ? (
              <p className="text-sm text-ink-3">
                {t("settings.advanced.phoneServer.noNetwork")}
              </p>
            ) : (
              <div className="flex flex-wrap items-start gap-4">
                <img
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(pairing.qr_svg)}`}
                  alt={t("settings.advanced.phoneServer.qrAlt")}
                  width={180}
                  height={180}
                  className="rounded-lg bg-white p-2"
                />
                <div className="flex flex-col gap-2 text-sm min-w-0">
                  <p className="text-ink-2">
                    {t("settings.advanced.phoneServer.steps")}
                  </p>
                  <p className="text-ink-2">
                    {t("settings.advanced.phoneServer.modelNote")}
                  </p>
                  <p className="text-ink-3">
                    {t("settings.advanced.phoneServer.computer", {
                      name: pairing.name,
                    })}
                  </p>
                  <ul className="text-ink-3 font-mono text-xs break-all">
                    {pairing.urls.map((url) => (
                      <li key={url}>{url}</li>
                    ))}
                  </ul>
                  <p className="text-ink-3">
                    {t("settings.advanced.phoneServer.away")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void copyLink()}
                      className="inline-flex items-center gap-1.5"
                    >
                      <Copy width={14} height={14} />
                      {t("settings.advanced.phoneServer.copyLink")}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void pairAgain()}
                      disabled={resetting}
                      className="inline-flex items-center gap-1.5"
                    >
                      <RefreshCw width={14} height={14} />
                      {t("settings.advanced.phoneServer.pairAgain")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </SettingContainer>
        )}
      </>
    );
  },
);
