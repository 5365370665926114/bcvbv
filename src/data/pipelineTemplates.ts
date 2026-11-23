export const PROJECT_TREE = `desmistificando-pipeline/
├── public/
│   ├── config.json          # Metadados do episódio + palavras_vermelhas
│   ├── transcript.json      # Timestamps word-level (startMs / endMs)
│   ├── narracao.mp3         # Voz ElevenLabs (volume 1.0 / 0dB)
│   ├── trilha.mp3           # Little Dark Age Slowed + Reverb (ducking automático)
│   ├── personagem.png       # Narrador 2.5D com olhos e contorno vermelho neon
│   ├── fundo1.jpg           # Imagem temática 01
│   ├── fundo2.jpg           # Imagem temática 02
│   ├── fundo3.jpg           # Imagem temática 03
│   ├── sub_bass.mp3         # SFX Sub-Bass Drop (frames 0 e 90)
│   └── whoosh.mp3           # SFX Whip Pan (frames 240, 270, 300, 330)
├── scripts/
│   ├── transcribe.py        # Faster-Whisper / WhisperX -> transcript.json
│   ├── generate_sfx.py      # Síntese NumPy/SciPy (ou stdlib) -> sub_bass/whoosh
│   └── preprocess_media.sh  # Normalização FFmpeg 1080x1920 + gradeamento
├── src/
│   └── remotion/
│       ├── index.ts         # registerRoot(RemotionRoot)
│       ├── Root.tsx         # <Composition id="DesmistificandoEpisode" 1080x1920 30fps />
│       ├── MainVideo.tsx    # Orquestração 3 Fases + Engenharia de Áudio
│       ├── timeline.ts      # Matemática pura: sync word-level, ducking, Ken Burns, shake
│       ├── fonts.ts         # @remotion/google-fonts (Cinzel, Anton, Cormorant)
│       └── components/
│           ├── Intro.tsx            # Fase 1 (00:00–00:08)
│           ├── WhipPanSequence.tsx  # Fase 2 (00:08–00:12) com @remotion/transitions
│           ├── BackgroundLoop.tsx   # Fase 3 Camada 1 (loop 2.5s + Ken Burns)
│           ├── Character.tsx        # Fase 3 Camada 2 (@remotion/noise + spring)
│           ├── SpeechBubble.tsx     # Fase 3 Camada 3 (balão HQ + 1 palavra/vez)
│           └── Particles.tsx        # Brasas vermelhas + névoa cinematográfica
└── remotion.config.ts       # Configuração H.264 yuv420p para renderização MP4`;

export const TERMINAL_COMMANDS = {
  installNode: `npm install remotion @remotion/cli @remotion/renderer @remotion/player \\
  @remotion/transitions @remotion/noise @remotion/google-fonts motion`,
  installPython: `# Opção A — Faster-Whisper (leve, rápido em CPU/GPU) + gerador de SFX
pip install faster-whisper numpy scipy

# Opção B — WhisperX (alinhamento forçado wav2vec2 em nível de fonema)
pip install git+https://github.com/m-bain/whisperX.git numpy scipy`,
  runPipeline: `# 1. Gerar SFX procedurais caso sub_bass.mp3 / whoosh.mp3 não existam
python3 scripts/generate_sfx.py --out-dir public

# 2. Gerar transcript.json word-level a partir da narração ElevenLabs
python3 scripts/transcribe.py \\
  --audio public/narracao.mp3 \\
  --output public/transcript.json \\
  --engine faster-whisper \\
  --model large-v3 \\
  --language pt`,
  renderMp4: `# Preview no Remotion Studio (opcional)
npx remotion studio src/remotion/index.ts

# Renderização final MP4 H.264 1080x1920 30fps (alta fidelidade CRF 18)
npx remotion render src/remotion/index.ts DesmistificandoEpisode \\
  out/desmistificando_ep01.mp4 \\
  --codec=h264 \\
  --crf=18 \\
  --pixel-format=yuv420p \\
  --audio-bitrate=320k`,
};

export const TRANSCRIBE_PY_SNIPPET = `#!/usr/bin/env python3
# scripts/transcribe.py — Faster-Whisper / WhisperX Word-Level Alignment
# Uso: python3 scripts/transcribe.py --audio public/narracao.mp3 --output public/transcript.json

from faster_whisper import WhisperModel
import json, subprocess
from pathlib import Path

def transcribe(audio="public/narracao.mp3", output="public/transcript.json", model_size="large-v3"):
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio, language="pt", word_timestamps=True, vad_filter=True)
    words = []
    for seg in segments:
        for w in (seg.words or []):
            text = w.word.strip()
            if text:
                words.append({
                    "word": text,
                    "startMs": int(round(w.start * 1000)),
                    "endMs": max(int(round(w.start * 1000)) + 80, int(round(w.end * 1000))),
                    "confidence": round(float(w.probability), 3),
                })
    dur_s = float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", audio
    ], text=True).strip())
    Path(output).write_text(json.dumps({
        "audioFile": Path(audio).name,
        "fps": 30,
        "durationMs": int(round(dur_s * 1000)),
        "totalFrames": int(round(dur_s * 30)),
        "wordCount": len(words),
        "words": words,
    }, ensure_ascii=False, indent=2), encoding="utf-8")`;

export const GENERATE_SFX_PY_SNIPPET = `#!/usr/bin/env python3
# scripts/generate_sfx.py — Síntese procedural de sub_bass.mp3 e whoosh.mp3
# Usa NumPy + SciPy + FFmpeg (com fallback automático para stdlib wave/math)

import numpy as np
from scipy import signal
from scipy.io import wavfile
import subprocess

SR = 44100

def build_sub_bass():
    t = np.linspace(0, 2.6, int(SR * 2.6), endpoint=False)
    freq = 28.0 + 44.0 * np.exp(-3.2 * t)
    phase = 2.0 * np.pi * np.cumsum(freq) / SR
    sub = np.sin(phase) + 0.28 * np.sin(2.0 * phase) * np.exp(-4.5 * t)
    env = (1.0 - np.exp(-t / 0.012)) * np.exp(-1.55 * t)
    mono = np.tanh(sub * 1.35) * env * 0.92
    wavfile.write("/tmp/sub_bass.wav", SR, (np.stack([mono, mono], 1) * 32767).astype(np.int16))
    subprocess.run(["ffmpeg", "-y", "-i", "/tmp/sub_bass.wav", "-b:a", "192k", "public/sub_bass.mp3"], check=True)`;
