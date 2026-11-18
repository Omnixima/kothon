/**
 * Kothon's Bengali models, which live outside the @handy-computer/models
 * catalog. Registering their measured accuracy and speed lets the model table
 * grade them like catalog models instead of showing "?".
 * Measured on an M2 Max over 200 FLEURS bn clips (see kothon.rs).
 */
import { catalog, type CatalogModel } from "@handy-computer/models";

const base = catalog.curatedModels.find(
  (m) => m.role === "asr",
) as CatalogModel;

const entry = (
  id: string,
  name: string,
  description: string,
  parameters: string,
  family: string,
  repository: string,
): CatalogModel =>
  ({
    ...base,
    id,
    name,
    description,
    parameters,
    family,
    repository,
    license: "apache-2.0",
    languages: ["bn"],
    capabilities: {
      streaming: false,
      translate: false,
      languageDetection: false,
      timestamps: false,
    },
    curated: true,
  }) as CatalogModel;

export const KOTHON_MODELS: Record<string, CatalogModel> = {
  "kothon-bn-fastconformer-116m": entry(
    "kothon-bn-fastconformer-116m",
    "Bangla FastConformer (দ্রুত)",
    "Fast Bengali dictation",
    "116M",
    "parakeet",
    "omnixima/bangla-fastconformer-ctc-116m-gguf",
  ),
  "kothon-bn-whisper-medium": entry(
    "kothon-bn-whisper-medium",
    "Bangla Whisper Medium (নিখুঁত)",
    "Most accurate Bengali",
    "764M",
    "whisper",
    "omnixima/bengaliai-whisper-medium-gguf",
  ),
};

type Results = Record<
  string,
  {
    accuracy: Record<string, { error: number }>;
    performance: { accelerated: number; cpu: number };
  }
>;
const results = (catalog.data as unknown as { results: Results }).results;
results["kothon-bn-fastconformer-116m"] = {
  accuracy: { bn: { error: 9.0 } },
  performance: { accelerated: 325, cpu: 110 },
};
results["kothon-bn-whisper-medium"] = {
  accuracy: { bn: { error: 8.2 } },
  performance: { accelerated: 20, cpu: 4 },
};
