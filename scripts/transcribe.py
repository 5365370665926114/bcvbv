#!/usr/bin/env python3
"""
DESMISTIFICANDO — Word-Level Audio Transcription & Alignment Pipeline
=====================================================================
Gera `public/transcript.json` com timestamps exatos em milissegundos para CADA
PALAVRA falada em `public/narracao.mp3`.

Motores suportados:
  - faster-whisper (padrao, rapido com CTranslate2 + VAD)
  - whisperx (alinhamento forcado wav2vec2 em nivel de fonema/palavra)

Uso:
  python3 scripts/transcribe.py --audio public/narracao.mp3 --output public/transcript.json --engine faster-whisper
  python3 scripts/transcribe.py --audio public/narracao.mp3 --output public/transcript.json --engine whisperx --device cuda
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List


def probe_audio_duration_ms(audio_path: Path) -> int:
    """Retorna a duracao exata do arquivo de audio em milissegundos via ffprobe."""
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(audio_path),
            ],
            text=True,
        ).strip()
        return int(round(float(out) * 1000))
    except Exception:
        return 0


def transcribe_faster_whisper(
    audio_path: Path, model_size: str, device: str, compute_type: str, language: str
) -> List[Dict[str, Any]]:
    from faster_whisper import WhisperModel

    print(f"[faster-whisper] Carregando modelo '{model_size}' ({device}/{compute_type})...")
    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    segments, info = model.transcribe(
        str(audio_path),
        language=language,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 220},
        beam_size=5,
    )
    print(f"[faster-whisper] Idioma detectado: {info.language} (prob={info.language_probability:.2f})")

    words: List[Dict[str, Any]] = []
    for segment in segments:
        if not segment.words:
            continue
        for w in segment.words:
            cleaned = w.word.strip()
            if not cleaned:
                continue
            start_ms = max(0, int(round(w.start * 1000)))
            end_ms = max(start_ms + 80, int(round(w.end * 1000)))
            words.append(
                {
                    "word": cleaned,
                    "startMs": start_ms,
                    "endMs": end_ms,
                    "confidence": round(float(getattr(w, "probability", 1.0)), 3),
                }
            )
    return words


def transcribe_whisperx(
    audio_path: Path, model_size: str, device: str, compute_type: str, language: str
) -> List[Dict[str, Any]]:
    import whisperx

    print(f"[whisperx] Carregando modelo '{model_size}' ({device}/{compute_type})...")
    model = whisperx.load_model(model_size, device, compute_type=compute_type, language=language)
    audio = whisperx.load_audio(str(audio_path))
    result = model.transcribe(audio, batch_size=16, language=language)

    print("[whisperx] Executando alinhamento forcado wav2vec2 (word-level)...")
    align_model, metadata = whisperx.load_align_model(language_code=language, device=device)
    aligned = whisperx.align(
        result["segments"],
        align_model,
        metadata,
        audio,
        device,
        return_char_alignments=False,
    )

    words: List[Dict[str, Any]] = []
    for seg in aligned.get("segments", []):
        for w in seg.get("words", []):
            text = str(w.get("word", "")).strip()
            if not text or "start" not in w or "end" not in w:
                continue
            start_ms = max(0, int(round(float(w["start"]) * 1000)))
            end_ms = max(start_ms + 80, int(round(float(w["end"]) * 1000)))
            words.append(
                {
                    "word": text,
                    "startMs": start_ms,
                    "endMs": end_ms,
                    "confidence": round(float(w.get("score", 1.0)), 3),
                }
            )
    return words


def parse_srt_timestamp_ms(ts: str) -> int:
    h, m, s, ms = re.split(r"[:,]", ts.strip())
    return ((int(h) * 3600 + int(m) * 60 + int(s)) * 1000) + int(ms)


def transcribe_from_srt(srt_path: Path, target_duration_ms: int = 0) -> List[Dict[str, Any]]:
    """Fallback deterministico que converte um arquivo .srt em timestamps word-level."""
    content = srt_path.read_text(encoding="utf-8")
    blocks = re.split(r"\r?\n\r?\n", content.strip())
    raw_words: List[Dict[str, Any]] = []

    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if len(lines) < 3 or "-->" not in lines[1]:
            continue
        start_str, end_str = lines[1].split("-->")
        seg_start = parse_srt_timestamp_ms(start_str)
        seg_end = parse_srt_timestamp_ms(end_str)
        text = " ".join(lines[2:])
        tokens = [t for t in text.split() if t.strip()]
        if not tokens:
            continue

        weights = [max(2, len(re.sub(r"[^\wÀ-ÿ]", "", t))) for t in tokens]
        total_weight = sum(weights)
        span = max(120, seg_end - seg_start)
        cursor = float(seg_start)

        for tok, w in zip(tokens, weights):
            dur = span * (w / total_weight)
            raw_words.append(
                {
                    "word": tok,
                    "startMs": int(round(cursor)),
                    "endMs": int(round(cursor + dur)),
                    "confidence": 0.92,
                }
            )
            cursor += dur

    if target_duration_ms > 0 and raw_words:
        last_ms = raw_words[-1]["endMs"]
        if last_ms > 0 and abs(last_ms - target_duration_ms) > 5000:
            scale = (target_duration_ms - 800) / float(last_ms)
            for item in raw_words:
                item["startMs"] = int(round(item["startMs"] * scale))
                item["endMs"] = max(item["startMs"] + 80, int(round(item["endMs"] * scale)))

    return raw_words


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera transcript.json word-level para o Remotion.")
    parser.add_argument("--audio", default="public/narracao.mp3", help="Caminho do MP3 de narracao")
    parser.add_argument("--output", default="public/transcript.json", help="Caminho do JSON de saida")
    parser.add_argument(
        "--engine",
        choices=["faster-whisper", "whisperx", "srt"],
        default="faster-whisper",
        help="Motor de transcricao word-level",
    )
    parser.add_argument("--srt", default="", help="Arquivo .srt opcional quando --engine srt")
    parser.add_argument("--model", default="large-v3", help="Modelo Whisper (small, medium, large-v3)")
    parser.add_argument("--device", default="cpu", help="Dispositivo: cpu ou cuda")
    parser.add_argument("--compute-type", default="int8", help="int8 (CPU) ou float16 (CUDA)")
    parser.add_argument("--language", default="pt", help="Codigo ISO do idioma")
    parser.add_argument("--fps", type=int, default=30, help="FPS do projeto Remotion")
    args = parser.parse_args()

    audio_path = Path(args.audio)
    output_path = Path(args.output)
    duration_ms = probe_audio_duration_ms(audio_path) if audio_path.exists() else 0

    if args.engine == "faster-whisper":
        words = transcribe_faster_whisper(audio_path, args.model, args.device, args.compute_type, args.language)
    elif args.engine == "whisperx":
        words = transcribe_whisperx(audio_path, args.model, args.device, args.compute_type, args.language)
    else:
        if not args.srt:
            print("Erro: informe --srt ao usar --engine srt", file=sys.stderr)
            sys.exit(1)
        words = transcribe_from_srt(Path(args.srt), duration_ms)

    # Garante ordem cronologica e sem sobreposicao
    words.sort(key=lambda item: item["startMs"])
    for i in range(len(words) - 1):
        if words[i]["endMs"] > words[i + 1]["startMs"]:
            words[i]["endMs"] = max(words[i]["startMs"] + 60, words[i + 1]["startMs"] - 10)

    final_duration_ms = max(duration_ms, (words[-1]["endMs"] + 1500) if words else 15000)
    payload = {
        "audioFile": audio_path.name,
        "language": args.language,
        "engine": args.engine,
        "fps": args.fps,
        "durationMs": final_duration_ms,
        "totalFrames": int(round((final_duration_ms / 1000.0) * args.fps)),
        "wordCount": len(words),
        "words": words,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] {len(words)} palavras salvas em {output_path} ({final_duration_ms / 1000:.2f}s)")


if __name__ == "__main__":
    main()
