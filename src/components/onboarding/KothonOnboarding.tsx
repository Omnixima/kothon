import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Keyboard, Mic, Download, RefreshCw } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { commands } from "@/bindings";
import { useSettings } from "@/hooks/useSettings";
import { useOsType } from "@/hooks/useOsType";
import { useModelStore } from "@/stores/modelStore";
import { formatKeyCombination } from "@/lib/utils/keyboard";
import { keyNeedsLabel, keySymbol } from "@/lib/utils/keySymbols";
import wordmark from "../../assets/kothon-wordmark.png";
import HandyMascot from "../icons/HandyMascot";
import { ShortcutInput } from "../settings/ShortcutInput";
import {
  clearOnboardingProgress,
  useOnboardingStore,
  type OnboardingStep,
} from "./onboardingStore";
import { usePermissions } from "./usePermissions";
import { useOnboardingModels } from "./useOnboardingModels";
import { downloadPick } from "./downloadPick";
import { BetaBadge } from "../shared/BetaBadge";

interface KothonOnboardingProps {
  /** Debug preview: inert (no prompts, downloads or setting writes). */
  preview?: boolean;
  previewStep?: OnboardingStep;
  /** Show only the permissions step (a returning user with access revoked). */
  permissionsOnly?: boolean;
  onComplete: () => void;
}

/** Kothon's own first-run flow: language, model, permissions, first words. */
const STEPS = ["welcome", "model", "permissions", "try"] as const;
type Step = (typeof STEPS)[number];

const asStep = (s: OnboardingStep): Step =>
  (STEPS as readonly string[]).includes(s) ? (s as Step) : "welcome";

const formatBytes = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.round(n / 1e6)} MB`;

export const KothonOnboarding: React.FC<KothonOnboardingProps> = ({
  preview = false,
  previewStep,
  permissionsOnly = false,
  onComplete,
}) => {
  const { t } = useTranslation();
  const store = useOnboardingStore();
  const { settings, updateSetting } = useSettings();
  const permissions = usePermissions(preview);
  const osType = useOsType();
  // Windows and Linux wording for the few lines that name the computer.
  const osContext =
    osType === "windows" || osType === "linux" ? osType : undefined;
  const [english, setEnglish] = useState(
    store.languages.some((l) => l.startsWith("en")),
  );
  const languages = english ? ["bn", "en"] : ["bn"];
  const models = useOnboardingModels(languages);
  const currentModel = useModelStore((s) => s.currentModel);
  const selectModel = useModelStore((s) => s.selectModel);
  const [tried, setTried] = useState("");

  useLayoutEffect(() => {
    if (permissionsOnly) return;
    store.reset(preview);
    if (preview && previewStep) store.set({ step: previewStep });
    // Once per mount.
  }, []);

  // Hold-or-tap is what the try step teaches.
  const activationSet = useRef(false);
  useEffect(() => {
    const activation = settings?.shortcut_activation;
    if (preview || !activation || activationSet.current) return;
    activationSet.current = true;
    if (activation !== "hold_or_toggle")
      updateSetting("shortcut_activation", "hold_or_toggle");
  }, [preview, settings?.shortcut_activation]);

  const picks = models.picks.slice(0, 2);
  const chosen =
    models.offered.find((m) => m.id === store.downloadId) ?? picks[0]?.model;
  const chosenInfo = chosen && models.infoFor(chosen);
  const download = preview
    ? ({ state: "ready" } as const)
    : models.downloadState(chosen);

  // Select the chosen model once it's on disk.
  useEffect(() => {
    if (preview || !chosenInfo?.is_downloaded) return;
    if (currentModel !== chosenInfo.id) selectModel(chosenInfo.id);
  }, [preview, chosenInfo?.id, chosenInfo?.is_downloaded, currentModel]);

  if (!permissions.checked) return null;

  const step = permissionsOnly ? "permissions" : asStep(store.step);
  const index = STEPS.indexOf(step);
  const go = (s: Step) => store.set({ step: s });

  const choose = (id: string) => {
    if (!preview) downloadPick(models, id, store.downloadId);
    store.set({ modelId: id, downloadId: id });
  };

  const finish = async () => {
    if (!preview) {
      await updateSetting("autostart_enabled", store.atLogin);
      await commands.completeOnboarding();
    }
    onComplete();
    if (!preview) clearOnboardingProgress();
  };

  const shortcut = formatKeyCombination(
    settings?.bindings?.transcribe?.current_binding ?? "",
    osType,
  );

  const stepLabels: Record<Step, string> = {
    welcome: t("kothonOnboarding.steps.language"),
    model: t("kothonOnboarding.steps.model"),
    permissions: t("kothonOnboarding.steps.permissions"),
    try: t("kothonOnboarding.steps.try"),
  };

  return (
    <div className="kothon-backdrop flex h-screen select-none">
      {/* Brand rail: logo, the steps, and the promise. */}
      <aside className="m-4 flex w-[260px] shrink-0 flex-col rounded-[26px] bg-gradient-to-br from-[#4a0b6b] to-[#2a0040] p-6 text-white shadow-[0_20px_50px_-24px_rgba(63,1,89,0.9)]">
        <div className="flex items-center gap-3">
          <HandyMascot className="h-11 w-11 ring-2 ring-white/20" />
          <span
            role="img"
            aria-label="Kothon"
            className="block h-9 w-24 bg-white"
            style={{
              maskImage: `url(${wordmark})`,
              WebkitMaskImage: `url(${wordmark})`,
              maskSize: "contain",
              WebkitMaskSize: "contain",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
            }}
          />
        </div>
        <p className="mt-6 text-[22px] font-bold leading-snug">
          {t("kothonOnboarding.tagline")}
        </p>
        <p className="mt-2 text-sm text-white/70">
          {t("kothonOnboarding.taglineSub", { context: osContext })}
        </p>
        <ol className="mt-8 flex flex-col gap-1">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold ${
                i === index ? "bg-white/15" : "text-white/60"
              }`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
                  i < index
                    ? "bg-[#d8b4fe] text-[#2a0040]"
                    : i === index
                      ? "bg-white text-[#2a0040]"
                      : "border border-white/30"
                }`}
              >
                {i < index ? <Check width={14} height={14} /> : i + 1}
              </span>
              {stepLabels[s]}
            </li>
          ))}
        </ol>
        <div className="mt-auto flex flex-col gap-2">
          <p data-beta className="text-[11px] leading-snug text-white/60">
            {t("beta.onboarding")}
          </p>
          <div className="flex items-center gap-2">
            <VersionButton preview={preview} />
            <BetaBadge tone="light" />
          </div>
        </div>
      </aside>

      {/* The step itself. */}
      <main className="flex flex-1 flex-col justify-center py-6 pe-8 ps-4">
        <div className="glass-card flex min-h-[440px] flex-col p-8">
          {step === "welcome" && (
            <>
              <Eyebrow>{t("kothonOnboarding.welcome.eyebrow")}</Eyebrow>
              <h1 className="mt-2 text-[28px] font-bold leading-tight">
                {t("kothonOnboarding.welcome.title")}
              </h1>
              <p className="mt-2 text-sm text-ink-2">
                {t("kothonOnboarding.welcome.body")}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Choice
                  selected
                  locked
                  title="বাংলা"
                  subtitle={t("kothonOnboarding.welcome.bengali")}
                />
                <Choice
                  selected={english}
                  onClick={() => setEnglish(!english)}
                  title="English"
                  subtitle={t("kothonOnboarding.welcome.english")}
                />
              </div>
              <Footer>
                <Primary
                  onClick={() => {
                    store.set({ languages });
                    if (!preview) updateSetting("spoken_languages", languages);
                    go("model");
                  }}
                >
                  {t("kothonOnboarding.continue")}
                </Primary>
              </Footer>
            </>
          )}

          {step === "model" && (
            <>
              <Eyebrow>{t("kothonOnboarding.model.eyebrow")}</Eyebrow>
              <h1 className="mt-2 text-[26px] font-bold leading-tight">
                {t("kothonOnboarding.model.title")}
              </h1>
              <p className="mt-2 text-sm text-ink-2">
                {t("kothonOnboarding.model.body")}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {picks.map(({ model, role }) => {
                  const info = models.infoFor(model);
                  return (
                    <Choice
                      key={model.id}
                      selected={chosen?.id === model.id}
                      onClick={() => choose(model.id)}
                      badge={
                        role === "pick"
                          ? t("kothonOnboarding.model.recommended")
                          : t("kothonOnboarding.model.accurate")
                      }
                      title={info?.name ?? model.name}
                      subtitle={
                        role === "pick"
                          ? t("kothonOnboarding.model.fastNote")
                          : t("kothonOnboarding.model.accurateNote")
                      }
                      meta={info ? `${info.size_mb} MB` : undefined}
                    />
                  );
                })}
              </div>
              <DownloadBar state={download} />
              <Footer onBack={() => go("welcome")}>
                <Primary
                  disabled={!chosen}
                  onClick={() => {
                    if (chosen && !store.downloadId) choose(chosen.id);
                    go("permissions");
                  }}
                >
                  {t("kothonOnboarding.continue")}
                </Primary>
              </Footer>
            </>
          )}

          {step === "permissions" && (
            <>
              <Eyebrow>{t("kothonOnboarding.permissions.eyebrow")}</Eyebrow>
              <h1 className="mt-2 text-[26px] font-bold leading-tight">
                {t("kothonOnboarding.permissions.title", {
                  context: osContext,
                })}
              </h1>
              <p className="mt-2 text-sm text-ink-2">
                {t("kothonOnboarding.permissions.body", { context: osContext })}
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Permission
                  icon={<Mic width={18} height={18} />}
                  title={t("kothonOnboarding.permissions.mic")}
                  body={t("kothonOnboarding.permissions.micWhy", {
                    context: osContext,
                  })}
                  status={permissions.microphone}
                  onAllow={permissions.requestMicrophone}
                />
                {permissions.platform === "macos" && (
                  <Permission
                    icon={<Keyboard width={18} height={18} />}
                    title={t("kothonOnboarding.permissions.accessibility")}
                    body={t("kothonOnboarding.permissions.accessibilityWhy")}
                    status={permissions.accessibility}
                    onAllow={permissions.requestAccessibility}
                  />
                )}
              </div>
              <Footer onBack={permissionsOnly ? undefined : () => go("model")}>
                <Primary
                  disabled={!preview && !permissions.allGranted}
                  onClick={() => (permissionsOnly ? onComplete() : go("try"))}
                >
                  {t("kothonOnboarding.continue")}
                </Primary>
              </Footer>
            </>
          )}

          {step === "try" && (
            <>
              <Eyebrow>{t("kothonOnboarding.try.eyebrow")}</Eyebrow>
              <h1 className="mt-2 text-[26px] font-bold leading-tight">
                {t("kothonOnboarding.try.title")}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                {t("kothonOnboarding.try.hold")}
                {shortcut.split(" + ").map((k) => (
                  <kbd
                    key={k}
                    title={k}
                    className="inline-flex min-w-9 items-center justify-center gap-1.5 rounded-[9px] border border-b-[3px] border-line-strong bg-background px-2.5 py-1 font-sans text-base font-semibold text-text"
                  >
                    {keySymbol(k, osType)}
                    {keyNeedsLabel(k, osType) && (
                      <span className="text-xs font-medium text-ink-2">
                        {k}
                      </span>
                    )}
                  </kbd>
                ))}
                {t("kothonOnboarding.try.say")}
              </div>
              <textarea
                autoFocus
                value={tried}
                onChange={(e) => setTried(e.target.value)}
                placeholder={t("kothonOnboarding.try.placeholder")}
                className="mt-4 h-28 w-full resize-none rounded-2xl border border-line bg-background/70 px-4 py-3 text-[17px] leading-relaxed text-text outline-none focus:border-logo-primary"
              />
              <DownloadBar state={download} compact />
              <div className="mt-3 divide-y divide-line rounded-2xl border border-line">
                <ShortcutInput shortcutId="transcribe" grouped />
                <label className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm">
                  {t("kothonOnboarding.try.atLogin")}
                  <input
                    type="checkbox"
                    checked={store.atLogin}
                    onChange={(e) => store.set({ atLogin: e.target.checked })}
                    className="h-4 w-4 accent-[var(--color-logo-primary)]"
                  />
                </label>
              </div>
              <Footer onBack={() => go("permissions")}>
                <Primary onClick={() => void finish()}>
                  {tried.trim()
                    ? t("kothonOnboarding.try.done")
                    : t("kothonOnboarding.try.skip")}
                </Primary>
              </Footer>
            </>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-ink-3">
          {t("kothonOnboarding.stepOf", {
            current: index + 1,
            total: STEPS.length,
          })}
        </p>
      </main>
    </div>
  );
};

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-xs font-semibold uppercase tracking-[1.2px] text-logo-primary">
    {children}
  </span>
);

const Footer: React.FC<{ children: React.ReactNode; onBack?: () => void }> = ({
  children,
  onBack,
}) => {
  const { t } = useTranslation();
  return (
    <div className="mt-auto flex items-center justify-between pt-6">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer text-sm font-semibold text-ink-2 hover:text-text"
        >
          ← {t("kothonOnboarding.back")}
        </button>
      ) : (
        <span />
      )}
      {children}
    </div>
  );
};

const Primary: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}> = ({ children, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="kothon-tab-active cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
  >
    {children}
  </button>
);

const Choice: React.FC<{
  title: string;
  subtitle: string;
  selected: boolean;
  locked?: boolean;
  badge?: string;
  meta?: string;
  onClick?: () => void;
}> = ({ title, subtitle, selected, locked, badge, meta, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={locked}
    className={`relative flex flex-col items-start rounded-2xl border p-4 text-start transition-colors ${
      selected
        ? "border-logo-primary bg-logo-primary/8 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-logo-primary)_18%,transparent)]"
        : "border-line bg-background/60 hover:border-logo-primary/50"
    } ${locked ? "cursor-default" : "cursor-pointer"}`}
  >
    {badge && (
      <span className="mb-2 rounded-full bg-logo-primary/15 px-2 py-0.5 text-[11px] font-bold text-logo-primary">
        {badge}
      </span>
    )}
    <span className="text-lg font-bold">{title}</span>
    <span className="mt-1 text-xs leading-relaxed text-ink-2">{subtitle}</span>
    {meta && <span className="mt-2 text-xs text-ink-3">{meta}</span>}
    <span
      className={`absolute end-3 top-3 grid h-5 w-5 place-items-center rounded-full ${
        selected ? "bg-logo-primary text-white" : "border border-line-strong"
      }`}
    >
      {selected && <Check width={12} height={12} />}
    </span>
  </button>
);

const DownloadBar: React.FC<{
  state: ReturnType<ReturnType<typeof useOnboardingModels>["downloadState"]>;
  compact?: boolean;
}> = ({ state, compact }) => {
  const { t } = useTranslation();
  if (state.state === "none") return null;
  const pct =
    state.state === "downloading"
      ? Math.round(state.progress * 100)
      : state.state === "ready" || state.state === "checking"
        ? 100
        : 0;
  const label =
    state.state === "downloading"
      ? state.total
        ? t("kothonOnboarding.download.progress", {
            done: formatBytes(state.downloaded),
            total: formatBytes(state.total),
          })
        : t("kothonOnboarding.download.starting")
      : state.state === "checking"
        ? t("kothonOnboarding.download.checking")
        : state.state === "ready"
          ? t("kothonOnboarding.download.ready")
          : t("kothonOnboarding.download.failed");
  return (
    <div className={compact ? "mt-3" : "mt-5"}>
      <div className="flex items-center gap-2 text-xs font-semibold text-ink-2">
        <Download width={13} height={13} />
        {label}
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-logo-primary/12">
        <div
          className={`h-full rounded-full ${state.state === "failed" ? "bg-error" : "bg-logo-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const Permission: React.FC<{
  icon: React.ReactNode;
  title: string;
  body: string;
  status: string;
  onAllow: () => Promise<void>;
}> = ({ icon, title, body, status, onAllow }) => {
  const { t } = useTranslation();
  const granted = status === "granted";
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-background/60 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-logo-primary/12 text-logo-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs leading-relaxed text-ink-2">{body}</div>
      </div>
      {granted ? (
        <span className="flex items-center gap-1 text-xs font-bold text-moss">
          <Check width={14} height={14} />
          {t("kothonOnboarding.permissions.allowed")}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => void onAllow()}
          disabled={status === "checking"}
          className="cursor-pointer rounded-lg border border-logo-primary px-3 py-1.5 text-xs font-bold text-logo-primary hover:bg-logo-primary/10"
        >
          {status === "waiting"
            ? t("kothonOnboarding.permissions.waiting")
            : t("kothonOnboarding.permissions.allow")}
        </button>
      )}
    </div>
  );
};

/**
 * The app's version in the rail; clicking it checks for an update, and a
 * second click installs one if found.
 */
const VersionButton: React.FC<{ preview: boolean }> = ({ preview }) => {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");
  const [state, setState] = useState<
    "idle" | "checking" | "latest" | "available" | "installing" | "error"
  >("idle");
  const update = useRef<Update | null>(null);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(""));
  }, []);

  const onClick = async () => {
    if (preview) return;
    if (state === "available" && update.current) {
      setState("installing");
      try {
        await update.current.downloadAndInstall();
        await relaunch();
      } catch {
        setState("error");
      }
      return;
    }
    setState("checking");
    try {
      update.current = await check();
      setState(update.current ? "available" : "latest");
    } catch {
      setState("error");
    }
  };

  const label =
    state === "checking"
      ? t("kothonOnboarding.version.checking")
      : state === "latest"
        ? t("kothonOnboarding.version.latest")
        : state === "available"
          ? t("kothonOnboarding.version.available", {
              version: update.current?.version ?? "",
            })
          : state === "installing"
            ? t("kothonOnboarding.version.installing")
            : state === "error"
              ? t("kothonOnboarding.version.error")
              : t("kothonOnboarding.version.check");

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      title={label}
      className={`flex w-fit cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        state === "available"
          ? "bg-[#d8b4fe] text-[#2a0040]"
          : "bg-white/10 text-white/75 hover:bg-white/20"
      }`}
    >
      <RefreshCw
        width={12}
        height={12}
        className={
          state === "checking" || state === "installing" ? "animate-spin" : ""
        }
      />
      {version ? `v${version}` : "Kothon"}
      {state !== "idle" && (
        <span className="font-normal opacity-80">· {label}</span>
      )}
    </button>
  );
};
