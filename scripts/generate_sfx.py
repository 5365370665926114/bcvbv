#!/usr/bin/env python3
"""
DESMISTIFICANDO — Procedural Cinematic SFX Synthesizer
======================================================
Sintetiza `public/sub_bass.mp3` (sub-drop cinematografico escuro 68Hz -> 26Hz)
e `public/whoosh.mp3` (arrasto whip-pan estereo com varredura bandpass) caso os
arquivos ainda nao existam em `/public`.

Usa NumPy + SciPy quando instalados, com fallback automatico para Python stdlib
(`math` + `wave`) + FFmpeg para funcionar em qualquer ambiente Linux/macOS/Windows.
"""

from __future__ import annotations

import argparse
import math
import random
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

SAMPLE_RATE = 44100


def write_wav_stereo(path: Path, left: list[float], right: list[float]) -> None:
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for l_sample, r_sample in zip(left, right):
            li = max(-32767, min(32767, int(l_sample * 32767)))
            ri = max(-32767, min(32767, int(r_sample * 32767)))
            frames += struct.pack("<hh", li, ri)
        wf.writeframes(frames)


def encode_mp3(wav_path: Path, mp3_path: Path) -> None:
    mp3_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(wav_path),
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "192k",
            str(mp3_path),
        ],
        check=True,
    )


def synthesize_with_numpy_scipy(out_dir: Path, force: bool) -> bool:
    try:
        import numpy as np
        from scipy import signal
        from scipy.io import wavfile
    except ImportError:
        return False

    sub_mp3 = out_dir / "sub_bass.mp3"
    whoosh_mp3 = out_dir / "whoosh.mp3"

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        if force or not sub_mp3.exists():
            dur = 2.6
            t = np.linspace(0, dur, int(SAMPLE_RATE * dur), endpoint=False)
            # Pitch sweep exponencial de 72Hz ate 28Hz (cinematic trailer boom)
            freq = 28.0 + 44.0 * np.exp(-3.2 * t)
            phase = 2.0 * np.pi * np.cumsum(freq) / SAMPLE_RATE
            sub = np.sin(phase)
            harmonic = 0.28 * np.sin(2.0 * phase) * np.exp(-4.5 * t)
            transient = 0.35 * np.random.default_rng(42).normal(0, 1, len(t)) * np.exp(-45.0 * t)
            b, a = signal.butter(4, 180 / (SAMPLE_RATE / 2), btype="low")
            transient = signal.lfilter(b, a, transient)

            env = (1.0 - np.exp(-t / 0.012)) * np.exp(-1.55 * t)
            mono = np.tanh((sub + harmonic + transient) * 1.35) * env * 0.92
            stereo = np.stack([mono, mono], axis=1)
            wav_file = tmp_path / "sub_bass.wav"
            wavfile.write(wav_file, SAMPLE_RATE, (stereo * 32767).astype(np.int16))
            encode_mp3(wav_file, sub_mp3)
            print(f"[NumPy/SciPy] Gerado: {sub_mp3}")

        if force or not whoosh_mp3.exists():
            dur = 0.72
            n = int(SAMPLE_RATE * dur)
            t = np.linspace(0, dur, n, endpoint=False)
            rng = np.random.default_rng(7)
            noise = rng.normal(0, 1, n)

            # Envelopes sobrepostos para varredura de ar (low -> mid -> high -> low)
            b_low, a_low = signal.butter(3, [140 / (SAMPLE_RATE / 2), 680 / (SAMPLE_RATE / 2)], btype="band")
            b_mid, a_mid = signal.butter(3, [550 / (SAMPLE_RATE / 2), 2400 / (SAMPLE_RATE / 2)], btype="band")
            b_hi, a_hi = signal.butter(3, [1800 / (SAMPLE_RATE / 2), 6400 / (SAMPLE_RATE / 2)], btype="band")

            w_low = signal.lfilter(b_low, a_low, noise) * np.exp(-((t - 0.16) / 0.12) ** 2)
            w_mid = signal.lfilter(b_mid, a_mid, noise) * np.exp(-((t - 0.28) / 0.11) ** 2) * 1.4
            w_hi = signal.lfilter(b_hi, a_hi, noise) * np.exp(-((t - 0.34) / 0.08) ** 2) * 1.1
            sub_hit = np.sin(2.0 * np.pi * (95.0 - 55.0 * (t / dur)) * t) * np.exp(-((t - 0.27) / 0.07) ** 2) * 0.55

            mix = np.tanh((w_low + w_mid + w_hi + sub_hit) * 1.2) * 0.85
            pan = np.clip(t / 0.55, 0.0, 1.0)
            left = mix * np.cos(pan * np.pi * 0.5)
            right = mix * np.sin(pan * np.pi * 0.5)
            stereo = np.stack([left, right], axis=1)
            wav_file = tmp_path / "whoosh.wav"
            wavfile.write(wav_file, SAMPLE_RATE, (stereo * 32767).astype(np.int16))
            encode_mp3(wav_file, whoosh_mp3)
            print(f"[NumPy/SciPy] Gerado: {whoosh_mp3}")

    return True


def synthesize_stdlib_fallback(out_dir: Path, force: bool) -> None:
    sub_mp3 = out_dir / "sub_bass.mp3"
    whoosh_mp3 = out_dir / "whoosh.mp3"
    rng = random.Random(42)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        if force or not sub_mp3.exists():
            dur = 2.6
            total = int(SAMPLE_RATE * dur)
            left: list[float] = []
            right: list[float] = []
            phase = 0.0
            lp_noise = 0.0
            for i in range(total):
                t = i / SAMPLE_RATE
                freq = 28.0 + 46.0 * math.exp(-3.2 * t)
                phase += 2.0 * math.pi * freq / SAMPLE_RATE
                raw_n = rng.uniform(-1.0, 1.0)
                lp_noise = 0.94 * lp_noise + 0.06 * raw_n
                punch = lp_noise * 0.65 * math.exp(-28.0 * t)
                core = math.sin(phase) + 0.26 * math.sin(2.0 * phase) * math.exp(-4.0 * t) + punch
                env = (1.0 - math.exp(-t / 0.012)) * math.exp(-1.55 * t)
                sample = math.tanh(core * 1.35) * env * 0.90
                left.append(sample)
                right.append(sample)
            wav_file = tmp_path / "sub_bass.wav"
            write_wav_stereo(wav_file, left, right)
            encode_mp3(wav_file, sub_mp3)
            print(f"[Stdlib+FFmpeg] Gerado: {sub_mp3}")

        if force or not whoosh_mp3.exists():
            dur = 0.72
            total = int(SAMPLE_RATE * dur)
            left = []
            right = []
            lp1 = 0.0
            lp2 = 0.0
            sub_phase = 0.0
            for i in range(total):
                t = i / SAMPLE_RATE
                # Varredura dinamica de corte do filtro acompanhando a curva do whip pan
                peak = math.exp(-((t - 0.28) / 0.13) ** 2)
                cutoff = 0.05 + 0.42 * peak
                n = rng.uniform(-1.0, 1.0)
                lp1 += cutoff * (n - lp1)
                lp2 += (cutoff * 0.35) * (lp1 - lp2)
                band = (lp1 - lp2) * 2.4

                sub_freq = 105.0 - 65.0 * (t / dur)
                sub_phase += 2.0 * math.pi * sub_freq / SAMPLE_RATE
                sub_body = math.sin(sub_phase) * math.exp(-((t - 0.27) / 0.08) ** 2) * 0.45

                env = math.sin(min(1.0, t / dur) * math.pi) ** 1.6
                val = math.tanh((band * peak * 1.6 + sub_body) * env) * 0.85
                pan = min(1.0, t / 0.55)
                left.append(val * math.cos(pan * math.pi * 0.5))
                right.append(val * math.sin(pan * math.pi * 0.5))
            wav_file = tmp_path / "whoosh.wav"
            write_wav_stereo(wav_file, left, right)
            encode_mp3(wav_file, whoosh_mp3)
            print(f"[Stdlib+FFmpeg] Gerado: {whoosh_mp3}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sintetiza sub_bass.mp3 e whoosh.mp3 para a pasta /public.")
    parser.add_argument("--out-dir", default="public", help="Diretorio de destino dos arquivos MP3")
    parser.add_argument("--force", action="store_true", help="Sobrescreve arquivos existentes")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    if not synthesize_with_numpy_scipy(out_dir, args.force):
        synthesize_stdlib_fallback(out_dir, args.force)


if __name__ == "__main__":
    main()
