#!/usr/bin/env python3
"""
Recorta o fundo preto exterior de `public/assets/aistudio/image_ead20321.png`
usando envoltorio de silhueta por scanline (do contorno neon esquerdo ao direito
em cada linha y, com fechamento morfologico nas frestas da manga), mantendo
100% do rosto preto sombreado e do terno preto completamente opacos!
"""

from __future__ import annotations

import subprocess
from pathlib import Path

SRC = Path("public/assets/aistudio/image_ead20321.png")
OUT = Path("public/personagem.png")


def main() -> None:
    probe = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0:s=x",
            str(SRC),
        ],
        text=True,
    ).strip()
    w, h = map(int, probe.split("x"))

    raw = bytearray(
        subprocess.check_output(
            [
                "ffmpeg",
                "-loglevel",
                "error",
                "-i",
                str(SRC),
                "-f",
                "rawvideo",
                "-pix_fmt",
                "rgba",
                "-",
            ]
        )
    )

    # 1. Encontra o pixel iluminado mais a esquerda e mais a direita em cada linha y
    left_edge = [-1] * h
    right_edge = [-1] * h
    thresh = 11

    for y in range(h):
        row_off = y * w * 4
        lx = -1
        for x in range(w):
            o = row_off + x * 4
            if raw[o] > thresh or raw[o + 1] > thresh or raw[o + 2] > thresh:
                lx = x
                break
        if lx == -1:
            continue
        rx = lx
        for x in range(w - 1, lx - 1, -1):
            o = row_off + x * 4
            if raw[o] > thresh or raw[o + 1] > thresh or raw[o + 2] > thresh:
                rx = x
                break
        left_edge[y] = lx
        right_edge[y] = rx

    # 2. Fecha pequenas lacunas escuras verticais no contorno das mangas/pescoco
    #    usando interpolacao linear entre linhas validas + envelope suave local
    valid_ys = [y for y in range(h) if left_edge[y] != -1]
    if not valid_ys:
        raise RuntimeError("Nenhum pixel iluminado encontrado no avatar.")
    top_y, bot_y = valid_ys[0], valid_ys[-1]

    # Interpola linhas vazias internas se houver
    for y in range(top_y, bot_y + 1):
        if left_edge[y] == -1:
            prev_y = y - 1
            while prev_y >= top_y and left_edge[prev_y] == -1:
                prev_y -= 1
            next_y = y + 1
            while next_y <= bot_y and left_edge[next_y] == -1:
                next_y += 1
            if prev_y >= top_y and next_y <= bot_y:
                t = (y - prev_y) / float(next_y - prev_y)
                left_edge[y] = int(round(left_edge[prev_y] * (1 - t) + left_edge[next_y] * t))
                right_edge[y] = int(round(right_edge[prev_y] * (1 - t) + right_edge[next_y] * t))

    # Na regiao do torso/mangas (abaixo do ombro, y > 54% da altura), garante que
    # pequenos recuos escuros entre os brilhos vermelhos da manga nao criem dentes
    smooth_l = list(left_edge)
    smooth_r = list(right_edge)
    for y in range(top_y, bot_y + 1):
        if left_edge[y] == -1:
            continue
        if y > int(h * 0.56):
            # Janela vertical para fechar reentrancias escuras na borda da manga
            win_l = [left_edge[k] for k in range(max(top_y, y - 42), min(bot_y, y + 42) + 1) if left_edge[k] != -1]
            win_r = [right_edge[k] for k in range(max(top_y, y - 42), min(bot_y, y + 42) + 1) if right_edge[k] != -1]
            # Usa percentil externo para envolver a manga suavemente sem vazar
            win_l.sort()
            win_r.sort()
            smooth_l[y] = min(left_edge[y], win_l[max(0, int(len(win_l) * 0.12))])
            smooth_r[y] = max(right_edge[y], win_r[min(len(win_r) - 1, int(len(win_r) * 0.88))])

    # 3. Aplica alpha = 0 fora de [smooth_l[y], smooth_r[y]] e 255 dentro (com feather 3px)
    feather = 3
    for y in range(h):
        row_off = y * w * 4
        lx = smooth_l[y]
        rx = smooth_r[y]
        if lx == -1:
            for x in range(w):
                raw[row_off + x * 4 + 3] = 0
            continue
        for x in range(w):
            o = row_off + x * 4
            if x < lx - feather or x > rx + feather:
                raw[o + 3] = 0
            elif x < lx:
                dist = lx - x
                raw[o + 3] = int(round(255 * (1.0 - dist / float(feather + 1))))
            elif x > rx:
                dist = x - rx
                raw[o + 3] = int(round(255 * (1.0 - dist / float(feather + 1))))
            else:
                raw[o + 3] = 255

    proc = subprocess.Popen(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-s",
            f"{w}x{h}",
            "-i",
            "-",
            str(OUT),
        ],
        stdin=subprocess.PIPE,
    )
    proc.communicate(input=bytes(raw))
    if proc.returncode != 0:
        raise RuntimeError("Falha ao salvar public/personagem.png")
    print(f"[OK] Silhueta solida recortada com sucesso em {OUT} ({w}x{h})")


if __name__ == "__main__":
    main()
