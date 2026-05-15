#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
빌더 진입점: 9개 콘텐츠 모듈을 읽어 18개 HTML(KO+EN)을 생성.
"""

import sys
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from render import write_post  # noqa: E402

import content_A1, content_A2, content_A3, content_A4, content_A5, content_A6  # noqa: E402
import content_C1, content_C2, content_C3  # noqa: E402

MODULES = [
    content_A1, content_A2, content_A3, content_A4, content_A5, content_A6,
    content_C1, content_C2, content_C3,
]


def main():
    written = []
    for mod in MODULES:
        slug = mod.SLUG
        ko_path, en_path = write_post(slug, mod.KO_META, mod.KO_BODY, mod.EN_META, mod.EN_BODY)
        written.append((slug, ko_path, en_path))
        print(f"  ✓ {slug}")
        print(f"    KO: {ko_path}")
        print(f"    EN: {en_path}")
    print(f"\nTotal: {len(written)} slugs · {len(written)*2} files")


if __name__ == "__main__":
    main()
