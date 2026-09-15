#!/usr/bin/env python3
"""fixaud.py — repair the D-3 audio overlap in the v13 master narration.

CEO-10 (verbatim): "2분 20초 안팎으로 오디오 겹침이 있어요.
                    갑자기 다른 목소리가 불쑥 튀어나왔어요."

WHY FIVE TOOLS MISSED IT (lesson 50):
  I was hunting for a seam in MY edit. splice.py proved 93.6% of windows map
  v14 -> v13 at offset exactly 0.000s, and 125-155s maps perfectly -> my edit is
  clean. The defect was already in the material I was GIVEN (v13's TTS render).

HOW IT WAS FINALLY LOCALISED (triangulation, not signal thresholds):
  Three transcription engines heard the SAME 3 syllables differently:
     elevenlabs_scribe_v2 -> "일단은"      whisper-1 -> (nothing)
     gemini-3-flash       -> "있다면"   (correct)
  Three engines disagreeing on one spot = two voices are stacked there.
  Then a 10 ms RMS profile confirmed it physically:
     135.90 - 136.14s sits FLAT at about -40 dB.
     A real sentence tail decays to the noise floor (-65 dB), as it does at
     136.16-136.24s. A 240 ms plateau at -40 dB is the tail of sentence A still
     ringing UNDER the head of sentence B.

FIX: duck that 240 ms window to the noise floor with short raised-cosine ramps,
     so sentence A ends cleanly and sentence B starts on silence. No resampling,
     no re-render of the whole track, nothing else in the 500 s is touched.
"""
import numpy as np, wave, subprocess, os, sys

SRC   = "../v13.mp4"
OUT   = "v13_audio_fixed.wav"
RAW   = "_v13_full.wav"

# measured overlap window (seconds, v13 master timeline)
LO, HI = 135.90, 136.14
RAMP   = 0.030          # 30 ms raised-cosine in/out so there is no click
FLOOR  = 0.030          # residual gain (keeps room tone, kills the ringing voice)

if not os.path.exists(RAW):
    print("+ decode master audio")
    subprocess.run(["ffmpeg","-v","error","-y","-i",SRC,"-vn",
                    "-ac","2","-ar","48000","-c:a","pcm_s16le",RAW], check=True)

w = wave.open(RAW,"rb")
sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32).reshape(-1, ch)
w.close()
print(f"master audio {a.shape[0]/sr:.3f}s  sr={sr}  ch={ch}")

def rms_db(t0, t1):
    s = a[int(t0*sr):int(t1*sr)]
    return 20*np.log10(np.sqrt((s**2).mean())/32768 + 1e-12)

print(f"BEFORE  overlap window {LO}-{HI}s : {rms_db(LO,HI):6.1f} dB")
print(f"        clean tail 136.16-136.24s : {rms_db(136.16,136.24):6.1f} dB  <- target")

# build the gain envelope
i0, i1 = int(LO*sr), int(HI*sr)
r = int(RAMP*sr)
g = np.ones(a.shape[0], dtype=np.float32)
core0, core1 = i0 + r, i1 - r
g[core0:core1] = FLOOR
ramp = 0.5*(1 + np.cos(np.linspace(0, np.pi, r)))          # 1 -> 0
g[i0:core0] = FLOOR + (1.0 - FLOOR)*ramp
g[core1:i1] = FLOOR + (1.0 - FLOOR)*ramp[::-1]

a *= g[:, None]
print(f"AFTER   overlap window {LO}-{HI}s : {rms_db(LO,HI):6.1f} dB")

out = np.clip(a, -32768, 32767).astype(np.int16)
w = wave.open(OUT,"wb"); w.setnchannels(ch); w.setsampwidth(2); w.setframerate(sr)
w.writeframes(out.tobytes()); w.close()
print(f"wrote {OUT} {os.path.getsize(OUT):,} B")

# also emit a short mp3 the CEO can audition
subprocess.run(["ffmpeg","-v","error","-y","-ss","130","-i",OUT,"-t","12",
                "-c:a","libmp3lame","-b:a","192k","d3_fixed_130_142.mp3"], check=True)
subprocess.run(["ffmpeg","-v","error","-y","-ss","130","-i",RAW,"-t","12",
                "-c:a","libmp3lame","-b:a","192k","d3_before_130_142.mp3"], check=True)
print("wrote d3_before_130_142.mp3 / d3_fixed_130_142.mp3")
