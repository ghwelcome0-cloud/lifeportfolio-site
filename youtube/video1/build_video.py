# -*- coding: utf-8 -*-
"""슬라이드 -> 구간별 영상클립(미세 줌+페이드) -> concat -> 자막+오디오+BGM 합성.
갭 없는 연속 타임라인: 각 클립은 [현재 섹션 시작 ~ 다음 섹션 시작]을 채운다."""
import json, os, subprocess

TOTAL = 342.62
FPS = 30
with open("sections.json", encoding="utf-8") as f:
    SECTIONS = json.load(f)

os.makedirs("clips", exist_ok=True)

# 갭 제거: 각 클립 길이 = 다음 섹션 시작 - 현재 섹션 시작 (마지막은 TOTAL까지)
starts = [s[0] for s in SECTIONS]
bounds = starts[1:] + [TOTAL]

# 등급 A: 데이터 구간(research1)은 차트 카운트업 애니메이션 클립을 사용
ANIM_CLIPS = {"research1": "clips_anim/research1.mp4"}

clip_list = []
for i, (st, en, key) in enumerate(SECTIONS):
    dur = round(bounds[i] - st, 3)
    out = f"clips/clip_{i:02d}.mp4"
    fade_out_st = max(dur - 0.5, 0)

    if key in ANIM_CLIPS:
        # --- 차트 애니메이션 클립: 정확한 구간 길이로 자르고 fade out만 추가 ---
        # (애니메이션 자체에 fade in 포함됨. 길이를 dur로 정밀 트림)
        anim_src = ANIM_CLIPS[key]
        vf = f"fade=t=out:st={fade_out_st:.3f}:d=0.5"
        cmd = ["ffmpeg", "-y", "-i", anim_src, "-t", f"{dur}",
               "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p",
               "-r", str(FPS), out]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print("ERR anim clip", i, r.stderr[-800:])
            raise SystemExit(1)
        clip_list.append(out)
        print(f"clip {i:02d} [{key}] {dur:.2f}s OK (CHART ANIM)")
        continue

    # --- 모션 제거: 시각적 불편 방지. 정지 슬라이드 + 부드러운 페이드 전환만 사용 ---
    # zoompan 줌/팬을 완전히 제거(사용자 요청). 다큐멘터리 표준대로
    # 차분한 정지 화면 + 짧은 fade in/out 전환만 적용한다.
    src = f"slides/{key}.png"
    vf = (f"scale=1920:1080:flags=lanczos,"
          f"fade=t=in:st=0:d=0.5,fade=t=out:st={fade_out_st:.3f}:d=0.5")
    cmd = ["ffmpeg", "-y", "-loop", "1", "-i", src, "-t", f"{dur}",
           "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), out]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("ERR clip", i, r.stderr[-800:])
        raise SystemExit(1)
    clip_list.append(out)
    print(f"clip {i:02d} [{key}] {dur:.2f}s OK")

with open("concat.txt", "w") as f:
    for c in clip_list:
        f.write(f"file '{c}'\n")
print("clips done:", len(clip_list))
