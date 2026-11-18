#!/usr/bin/env bash
# Copy the Kothon Bengali GGUF models into the app's models directory so they
# appear in the model picker, plus the Bengali punctuation model.
# Usage: install-bengali-models.sh [SOURCE_DIR] [PUNCT_DIR]
set -euo pipefail
SRC="${1:-$HOME/Desktop/kothon-mac/convert/out}"
DEST="$HOME/Library/Application Support/com.kothon.dictation/models"
mkdir -p "$DEST"
for f in bengali-whisper-medium-Q8_0.gguf bangla-fastconformer-ctc-116m/bangla-fastconformer-ctc-116m-Q8_0.gguf; do
  if [ -f "$SRC/$f" ]; then cp -v "$SRC/$f" "$DEST/"; else echo "missing: $SRC/$f" >&2; fi
done
# Bengali punctuation model (a folder).
PUNCT="${2:-$HOME/Desktop/kothon-mac/punct/out/bn-punct-muril6-bn}"
if [ -d "$PUNCT" ]; then
  mkdir -p "$DEST/bn-punct-muril6"
  cp -v "$PUNCT"/config.json "$PUNCT"/model.safetensors "$PUNCT"/tokenizer.json "$DEST/bn-punct-muril6/"
else
  echo "missing: $PUNCT" >&2
fi
