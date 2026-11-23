#!/usr/bin/env bash
# ==============================================================================
# DESMISTIFICANDO — Pre-processamento de Imagens & Masterizacao Auxiliar FFmpeg
# ==============================================================================
# Normaliza fundos para 1080x1920 (9:16), aplica gradeamento escuro cinematico
# opcional e oferece comando de referencia para sidechain ducking standalone.

set -euo pipefail

PUBLIC_DIR="${1:-public}"

echo "[FFmpeg] Normalizando imagens de fundo em ${PUBLIC_DIR}..."
for idx in 1 2 3; do
  SRC="${PUBLIC_DIR}/fundo${idx}.jpg"
  OUT="${PUBLIC_DIR}/fundo${idx}_graded.jpg"
  if [[ -f "$SRC" ]]; then
    ffmpeg -y -loglevel error -i "$SRC" \
      -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=brightness=-0.12:contrast=1.22:saturation=0.78" \
      -q:v 2 "$OUT"
    echo "  -> Gerado: ${OUT}"
  fi
done

echo "[FFmpeg] Verificando duracao de narracao.mp3..."
if [[ -f "${PUBLIC_DIR}/narracao.mp3" ]]; then
  ffprobe -v error -show_entries format=duration \
    -of default=noprint_wrappers=1:nokey=1 "${PUBLIC_DIR}/narracao.mp3"
fi
