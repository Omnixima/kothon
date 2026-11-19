import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, events, type HistoryEntry } from "@/bindings";
import { useSettings } from "@/hooks/useSettings";
import { useOsType } from "@/hooks/useOsType";
import { useModelStore } from "@/stores/modelStore";
import { formatKeyCombination } from "@/lib/utils/keyboard";
import { keyNeedsLabel, keySymbol } from "@/lib/utils/keySymbols";
import { getTranslatedModelName } from "@/lib/utils/modelTranslation";
import { BengaliPunctuation } from "../settings/BengaliPunctuation";
import { AudioFeedback } from "../settings/AudioFeedback";
import { AutostartToggle } from "../settings/AutostartToggle";
import { LearnFromCorrectionsToggle } from "../settings/LearnedCorrections";

/** Average typing speed used for "typing saved" (words per minute). */
const TYPING_WPM = 35;
/** Entries read for the stats; a week of heavy dictation fits easily. */
const STATS_ENTRIES = 500;

// Decorative waveform heights (px), drawn once; no animation, no cost.
const WAVE = [14, 28, 44, 30, 52, 36, 20, 40, 26, 12, 34, 48, 22, 16];

const dayStart = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000;
const wordCount = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

interface HomeViewProps {
  onOpenModels: () => void;
  onOpenHistory: () => void;
}

/** Kothon's Home: ready-to-listen hero, today's stats and quick settings. */
export const HomeView: React.FC<HomeViewProps> = ({
  onOpenModels,
  onOpenHistory,
}) => {
  const { t, i18n } = useTranslation();
  const { settings } = useSettings();
  const osType = useOsType();
  const { models, currentModel } = useModelStore();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      const result = await commands.getHistoryEntries(null, STATS_ENTRIES);
      if (result.status === "ok") setEntries(result.data.entries);
    };
    void load();
    const unlisten = events.historyUpdatePayload.listen(() => void load());
    return () => {
      void unlisten.then((f) => f());
    };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const today = dayStart(now);
    const days = Array.from({ length: 7 }, (_, i) => today - (6 - i) * 86400);
    const perDay = days.map(() => 0);
    let todayWords = 0;
    for (const e of entries) {
      const n = wordCount(e.post_processed_text ?? e.transcription_text);
      if (e.timestamp >= today) todayWords += n;
      const idx = days.findIndex((d, i) =>
        i === 6
          ? e.timestamp >= d
          : e.timestamp >= d && e.timestamp < days[i + 1],
      );
      if (idx >= 0) perDay[idx] += n;
    }
    const max = Math.max(1, ...perDay);
    return {
      todayWords,
      savedMinutes: Math.round(todayWords / TYPING_WPM),
      bars: perDay.map((n) => Math.max(8, Math.round((n / max) * 100))),
    };
  }, [entries]);

  const last = entries.find((e) => e.transcription_text.trim());
  const shortcut = formatKeyCombination(
    settings?.bindings?.transcribe?.current_binding ?? "",
    osType,
  );
  const model = models.find((m) => m.id === currentModel);
  const numberFormat = new Intl.NumberFormat(i18n.language);

  return (
    <div className="grid w-full max-w-4xl grid-cols-[1.35fr_1fr] grid-rows-[auto_1fr] gap-4">
      {/* Hero: how to dictate, and what was said last. */}
      <section className="row-span-2 flex min-h-[420px] flex-col gap-3.5 rounded-[22px] bg-gradient-to-br from-[#4a0b6b] to-[#2a0040] p-5 text-white shadow-[0_18px_40px_-20px_rgba(63,1,89,0.8)]">
        <span className="text-xs font-semibold uppercase tracking-[1.2px] text-white/65">
          {t("home.ready")}
        </span>
        <h1 className="text-[30px] font-bold leading-tight">
          {t("home.headline")}
        </h1>
        {shortcut && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/90">
            {t("home.hold")}
            {shortcut.split(" + ").map((key) => (
              <kbd
                key={key}
                title={key}
                className="inline-flex min-w-9 items-center justify-center gap-1.5 rounded-[9px] border border-b-[3px] border-white/25 bg-white/15 px-2.5 py-1 font-sans text-base font-semibold"
              >
                {keySymbol(key, osType)}
                {keyNeedsLabel(key, osType) && (
                  <span className="text-xs font-medium opacity-80">{key}</span>
                )}
              </kbd>
            ))}
            {t("home.inAnyApp")}
          </div>
        )}
        <div className="my-1.5 flex h-[54px] items-center gap-1" aria-hidden>
          {WAVE.map((h, i) => (
            <i
              key={i}
              className="block w-1.5 rounded bg-[#d8b4fe]/90"
              style={{ height: h }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenHistory}
          className="mt-auto cursor-pointer rounded-2xl bg-white/10 p-3.5 text-start transition-colors hover:bg-white/15"
        >
          <small className="mb-1 block text-[11px] text-white/60">
            {t("home.lastDictation")}
          </small>
          <span className="text-base leading-relaxed">
            {last
              ? (last.post_processed_text ?? last.transcription_text)
              : t("home.nothingYet")}
          </span>
        </button>
      </section>

      {/* Today: words, time saved, the week, and the model in use. */}
      <section className="glass-card flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.8px] text-ink-3">
            {t("home.today")}
          </span>
          <button
            type="button"
            onClick={onOpenHistory}
            className="cursor-pointer text-xs font-semibold text-logo-primary"
          >
            {t("home.history")} ›
          </button>
        </div>
        <div className="grid grid-cols-[auto_auto_1fr] items-end gap-[18px]">
          <div>
            <b className="block text-[28px] leading-none tracking-tight">
              {numberFormat.format(stats.todayWords)}
            </b>
            <small className="mt-1 block text-xs text-ink-3">
              {t("home.words")}
            </small>
          </div>
          <div>
            <b className="block text-[28px] leading-none tracking-tight">
              {numberFormat.format(stats.savedMinutes)}
              <em className="ms-0.5 text-sm font-semibold not-italic text-ink-2">
                {t("home.min")}
              </em>
            </b>
            <small className="mt-1 block text-xs text-ink-3">
              {t("home.typingSaved")}
            </small>
          </div>
          <div
            className="flex h-11 items-end justify-end gap-1"
            title={t("home.lastSevenDays")}
          >
            {stats.bars.map((h, i) => (
              <i
                key={i}
                className={`block w-[9px] rounded-[3px] ${i === 6 ? "bg-logo-primary" : "bg-logo-primary/20"}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-[14px] bg-logo-primary/8 px-3 py-2.5">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${model ? "bg-moss shadow-[0_0_0_4px_var(--color-moss-wash)]" : "bg-ink-3"}`}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {model ? getTranslatedModelName(model, t) : t("home.noModel")}
            </div>
            <small className="block text-[11px] text-ink-3">
              {t("home.onDevice")}
            </small>
          </div>
          <button
            type="button"
            onClick={onOpenModels}
            className="ms-auto cursor-pointer text-xs font-bold text-logo-primary"
          >
            {t("home.change")}
          </button>
        </div>
      </section>

      {/* Quick settings: the toggles people reach for most. */}
      <section className="glass-card overflow-hidden">
        <h2 className="px-5 pt-4 pb-1 text-xs font-semibold uppercase tracking-[0.8px] text-ink-3">
          {t("home.quickSettings")}
        </h2>
        <div className="divide-y divide-line">
          <BengaliPunctuation descriptionMode="tooltip" grouped />
          <LearnFromCorrectionsToggle descriptionMode="tooltip" grouped />
          <AudioFeedback descriptionMode="tooltip" grouped />
          <AutostartToggle descriptionMode="tooltip" grouped />
        </div>
      </section>
    </div>
  );
};
