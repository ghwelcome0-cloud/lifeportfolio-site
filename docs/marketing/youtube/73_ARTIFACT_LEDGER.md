# 73. 산출물 원장 (ARTIFACT LEDGER)

> **이 문서의 지위**: 지금까지 생성·회수된 모든 산출물 URL 을 **판정 태그와 함께** 보존한다.
>
> **왜 만들었나 (CEO-72)**: URL 200여 개를 매 세션 대화 요약에 들고 다니면서 압축
> 시간이 병목이 되었다. URL 과 판정은 **확정되어 변하지 않는다** — 파일로 외부화한다.
>
> **URL 베이스**: 별도 표기가 없으면 `https://www.genspark.ai/api/files/s/<id>`
>
> **태그 규약**
> | 태그 | 의미 |
> |---|---|
> | `★accepted★` | 대표님이 명시적으로 승인 |
> | `★rejected★` | 대표님이 명시적으로 반려 |
> | `superseded` | 후속본으로 대체됨 (재사용 금지) |
> | `none` | 판정 없음 (중간 산물) |
> | `⚠` | 주의 사항 있음 |

---

## 1. 최우선 참조 — 승인 기준 정본 (CEO-65)

**이 3장이 「승인된 퀄리티」의 유일한 정본이다.** 로컬 사본 `lf/std/std{1,2,3}.png`.

| ID | 문구 | 태그 |
|---|---|---|
| `38yRwQ69` | "정답은 없습니다" | **★accepted quality standard★** |
| `qBuuJwmc` | "남기고 싶은 변화" | **★accepted quality standard★** |
| `rZtpY8xF` | "선택지는 늘고 기준은 흐려집니다" | **★accepted quality standard★** |

### 픽셀 계측 정본 (1024x576 기준)

| 항목 | std1 | std2 | std3 |
|---|---|---|---|
| 패널 bbox | 296,66..728,184 | 376,168..834,316 | 224,148..872,380 |
| **panel_w / frame_w** | **0.422** | **0.447** | **0.633** |
| panel_h / frame_h | 0.205 | 0.257 | 0.403 |
| **glyph_h / frame_h** | **0.0885** | **0.1390** | **0.1893** |
| glyph_h / panel_h | 0.432 | 0.541 | 0.470 |
| stroke / glyph_h | 0.157 | 0.087 | 0.055 |
| 패널 채움 median RGB | (20,27,25) | (31,41,38) | (17,23,24) |
| 네온 림 median / 코어 | (125,191,197)/(210,255,255) | (140,201,206)/(211,252,255) | (72,191,210)/(173,255,255) |
| 흰 한글 median RGB | (241,241,241) | (232,236,238) | (245,245,245) |

**공통 문법**
- `B >= G > R` 항상
- 흰 글자는 순백이 아니다 (240 전후, 채널 편차 <= 6)
- **★문구가 「문장」 단위★** ← 교훈 191 의 근거 1

---

## 2. 참조 영상 — 목표 정본 (CEO-66/67)

| URL | 태그 | 역할 |
|---|---|---|
| `youtube.com/watch?v=fUpBnpzL0co` | **★최소 달성 목표 정본 (CEO-67 #5)★** | 28s 9:16 상하분할, 상단 실사 머스탱/하단 Rough Previs, 저폴리+무텍스처, **인물=단색 마네킹**(남 녹색/여 청색), 샷 1~3초 하드컷 |
| `youtube.com/watch?v=Awl_Uv2ZJ6k` | ★목표 씬 수준★ | 귀공자 PREVIS 2:22 16:9 좌우분할, 고속추격, 인물=의상·표정까지 모델링, 샷 2~3초 |
| `youtube.com/watch?v=LomMGF7kcBU` | ★학습 완료·CEO 승인★ | CEO-53 |
| `youtube.com/shorts/Sp8XFlq4s-g` | none | CEO-50 깜빡거림 지적 · ⚠yt-dlp 불가 |

**분석 산출물**

| ID | 태그 | 내용 |
|---|---|---|
| `w6RIXJmZ` | none | fUpBnpzL0co 분석 |
| `cGy7TW5V` | none | Awl_Uv2ZJ6k 귀공자 PREVIS 분석 |
| `R7Jwtxpn` | none | **★CEO-53 분석 = 핵심 해법 정본★** |
| `vAn9kt73` | none | **★벤치마크 해부★** |
| `P345qKmp` | none | **★목표 기법 정본 `_ref/vitc.mp4`★** |
| `GsO1jg40` | none | ⚠미재독 |
| `Njo3LNHs` · `1nAsjwhu` · `YgxSHwI5` · `gOm7Wngp` · `KBbNqw0B` | none | 학습·조사 |

**오픈소스 임포트 — 미채택 확정**

| URL | 태그 |
|---|---|
| `huggingface.co/onnx-community/depth-anything-v2-small` | **★accepted★** (사용 중, `r3d/dav2s.onnx`) |
| `github.com/BrokenSource/DepthFlow` | 조사 완료 · 미채택 |
| `github.com/provos/parallax-maker` | 조사 완료 · 미채택 |
| `github.com/akatz-ai/ComfyUI-Depthflow-Nodes` | 조사 완료 · 미채택 |
| `studio.blender.org/characters` | 조사 완료 · **임포트 미채택** |
| `blendswap.com/3d/low-poly-character` | 조사 완료 · **임포트 미채택** |
| `cloud.smartsound.com/blog/6-rules-of-video-transitions` | ★페이싱 참조★ |

**미채택 사유 확정** ① 샌드박스 임포트 경로 없음 · RAM 3.9GB/2코어 초과
② CC 조건 상이 ③ **(결정적) 참조가 실제로 쓰는 것이 「저폴리 프리미티브 + 단색 플랫」**
⇒ `sets.py mannequin()` 이 이미 구현체다.

---

## 3. 직전 납품 — CEO-67 반려

| ID | 태그 | 내용 |
|---|---|---|
| `XAQ5V5KY` | **★rejected (CEO-67)★** · superseded | previz_sim_500s.mp4 12,000f · 500.000000s · 63.44 MB |
| `nuj4fg9K` | **★반려 증거★** | 0:02:31 |
| `JjNlbSvc` | **★반려 증거★** | 0:00:02 |

---

## 4. v2v / 모션 산출물

### 승인 (CEO-55)

| ID | 태그 | 내용 |
|---|---|---|
| `BZ1qgq7G` | ★accepted (CEO-55)★ | BA_KR.mp4 8.083s |
| `9ahkK1KV` | ★accepted (CEO-55 "「조율자」 저도 확인")★ | |
| `oOnSmjg6` | ★accepted★ | |
| `v3b.fal.media/files/b/0aa75375/oQq0ZLbQAE_CSkjhHAeOV_video.mp4` | ★accepted★ | |
| `aD7K2Okz` | none | |

### 반려 (CEO-64 — 글자 품질)

| ID | 태그 | 내용 |
|---|---|---|
| `Xl639B5F` | **★rejected (CEO-64)★** | v2v_J_A3-07 |
| `v3b.fal.media/files/b/0aa78d46/q9xnZEWDr34RHvyN01NHR_video.mp4` | ★rejected★ | |
| `VQHmnnRD` | ★rejected (글자 낙서)★ | |
| `v3b.fal.media/files/b/0aa75500/sRREBZsLUy5Q0ind-5IaN_video.mp4` | ★rejected★ | |

### i2v 회수 3본

`ljUPnTnv` · `RZ6wysPV` · `pfRWfbN7`
— ★accepted(visual)★ 이지만 **★소재 폐기 (CEO-67 #2)★**

### v2v 입력 자료

`kaSQ5u3h`(P01) · `n3neHIay`(Q21) · `MSFv9pFf` · `djiJ6YCi` · `qamTKpMg` · `ZzhpKH1o` ·
`hbVnacbB` · `MfZfzwsO` · `VmECCW8t` · `BMXTU9KT` · `edKHLLTv` — all `none`

---

## 5. 38 job 생성 원본 — CEO-43 전량 승인 (QC 38/38 PASS)

전부 `★accepted (CEO-43)★`

```
J01 eS7FP9tF   J02 BvcCfIah   J03 fa60XJR3   J04 3HX8lzZk   J05 qtvyZjRy
J06 i2AHJm1B   J07 3LpPchPp   J08 5U4ZrBM9   J09 oPGiEvZW   J10 NsscWiKP
J11 E5MMXMFE   J12 uQR1e4hT   J13 KS6X5Vb0   J14 llgQuBgW   J15 2V920mlf
J16 U5SI8tVV   J17 ZFwaxyxZ   J20 YABXBFDi   J21 gS5uciyC   J22 huoE0BsX ⚠sup v2
J23 hoBljXmh   J24 llXAjbSk   J25 JWSmquDU   J26 k1sr9YJc   J27 GWDt7GYA
J28 5FfZ7geQ ⚠sup → ★tUeXnvIL★           J29 j83Ilvgv   J30 fXO2Mgg4
J31 BEGyRzsv   J32 uIHcT110   J33 bScEl6j0   J34 6A1AP8xe   J35 02kqDZfr
J36 C3gMJGPd   J38 eKQLv7th ⚠sup v2      J41 sTb1hZBr
J42 ZaYID9rH ⚠sup v2                      J44 lcHfzxUp
```

**불채택 대조군**: `ocGyBKwr`[rejected] · `LUf7W875` · `vV3LjOXq` · `vTJ7Wy4n` ·
`oWKe3Lvr`[rejected]

---

## 6. plate 원본 — CEO-32 승인 (2048x1152)

전부 `★accepted (CEO-32)★`

```
P01 vyfP9w6c ⚠   P02 V6flWMpv ⚠   P07 gwJtf8eJ ⚠   P10 a38u3Sqf ⚠   P18 NNAobCDB ⚠
   (⚠ = 한글이 이미지에 구워짐)
Q04 oOHCBaxk   Q05 WdujnsMp   Q06 lrVR3txl   Q11 8LdwOwpE   Q14 PibdT1YS
Q17 AtT55KyB   ★Q20 4HZBkAka★   ★Q21 TknsFkfX★
S03 gmmVHeZT   S08 Wpprn4Sa   S09 EeQwjm9d   S12 Lz2oybp4   S13 p52Tt1kv
S15 W7slKXvT   S16 S9za1Gqq   ★S19 TZGFNqJk★   ★S22 fK1DGpYh★   S23 JGjLuCjb
S27 ggPAAtoq
```

**★S24 / S25 / S26 은 생성 이미지가 아니다** — `lf/land38/canvas/S2*_tall.png`

### plate 생성 입력 17종 (`none`)

`S23 Pz62cpNv` · `Q17 73Xvqb01` · `S09 4iAD4Ep3` · `S22 uKGeFU1q` · `S19 5l23ya20` ·
`P01 4AiZBO1Z ⚠` · `S03 un4XkuPf` · `Q11 jfwuT439` · `S12 NMbcaVFJ` · `Q21 1VA3gmEw` ·
`Q06 K6oP2CaO` · `Q05 UKrlgl5W` · `Q04 gLveHuWZ` · `S16 gGninKOW` · `Q20 ghndIakN` ·
`S13 fymoy3eg` · `S08 N4BScvbC`

### ★12장 세로 재생성 사고★ — 전부 `rejected(세로)` · `superseded`

`P1kqaVES` `GivFLODH` `ypwyoSJH` `aB2rgILV` `4iLKftX6` `yNiGegLw` `W5FvElCY` `MgL9epLY`

**원인**: `vLDUanjQ`(576x1024 세로) 를 참조로 넣고 `aspect_ratio=auto` 로 호출
⇒ **교훈: 참조 이미지는 craft 만 전달하지 않는다. 종횡비도 전달한다.**

---

## 7. 회수 완료 · 검증 통과

| ID | 태그 | 내용 |
|---|---|---|
| `LImtyyaD` | ★accepted (sha256 135c5346… 일치)★ | v14 stem 500.010667s |
| `ayhCuu2l` | superseded | |
| `bMurqeoH` | ★accepted · v14_500s_v2.srt★ | 118→114 큐 |
| `6nxdUirv` | superseded | |
| `XYe4hPxp` | ★accepted★ | colour_match 294행 |
| `Tj1XPAyE` | ★accepted★ | longform-qc v1.0.0 SHA256 MATCH |
| `P87s7SyR` | ★accepted (CEO-48)★ | portal_ab_720p.mp4 |
| `UiDTMSZ0` | ★accepted★ | A6 10 이음새 설계 165행 |
| `b1f0kQhR` | ★accepted (CEO-33)★ | |
| `zy0LQKSf` | ★accepted (CEO-32)★ | |
| `tUeXnvIL` | ★accepted · J28 채택본★ | |
| `FIHWsv80` | ★accepted★ | 요청1 데모 FINAL ACCEPTANCE YES |
| `fr6u1ZVv` · `Mrd7x2TW` | ★accepted (CEO-14)★ | |
| `pTtOAOpx` · `5QPdDfXK` | ★accepted · 2048x1152 craft 9.8/9.7 기준본★ | |
| `9eMljtGR` | ★accepted★ | 회색 바 추상화 + 팔레트 기준 |
| `SbJnO4ix` `ASlClpI6` `NAgoVI76` `r9mWl1yb` | ★accepted★ | |
| `SYFfqIUd` `EKLybqNq` `TncjuDz5` `IlnP51Qz` `ZJDxjJj3` `9AlHOiqR` `UJkRJjZE` `Rjj3cZ2V` `uu00bHCG` | ★accepted★ | 팀 코드 |

### 앵커 12장 — ★accepted (CEO-28)★

`OiCyrdsB` `3MPIc6sX` `AD0qFkCQ` `bXF0xWmF` `I3LBPBO4` `Z83mHghh`
`0UxD3EXC` `nMYIrapn` `1r3pwjPS` `L4U2YcY0` `Tt8CNrMJ` `NlDAuVHf` + **`WXgSICJA`**

로컬: `lf/land12/` = `lf/anchors12/` (동일 내용 2곳)

---

## 8. 6편 숏폼 3편 — 포맷 선례 (다른 롱폼)

| ID | 제목 | 길이 | 태그 |
|---|---|---|---|
| `sjHK6v4M` | 같은 뿌리 | 55초 | none |
| `wYdCTil0` | 내 불편함이 곧 아이템 | 55초 | none |
| `aueW9Mea` | 나침반과 지도 | 55초 | none |

**의의**: 1080x1920 30fps · 번인 자막 + 골드 CTA · **크레딧 0** 으로 제작.
코드: `youtube/video6/make_shorts.py`

---

## 9. 반려 · superseded

| ID | 태그 | 내용 |
|---|---|---|
| `BHdyzCqW` | ★partial-accept (CEO-50)★ · superseded | |
| `GG3N478A` | accepted(CEO-49) · **superseded** | |
| `KgpgNNAo` | ★이미지 accepted / 서사·전환 rejected★ · superseded | |
| `rMM2RE0k` | rejected (CEO-37) | |
| `yVbYaIxy` | rejected (CEO-16) | |
| `oE3V6LRr` | rejected (CEO-10) | |
| `LsiBqU5l` · `1cXqqDEh` | rejected | |
| `vLDUanjQ` | rejected | ⚠576x1024 세로 사고 원인 |
| `rCmFolAw` | rejected | |
| `Uj0TbYT0` `PePsDj9O` `OSWjKyrJ` | superseded | |
| `zObgCkew` `bCkpUcpQ` | ⚠스테일 | |

### ACT0 앵커 — accepted 7/10 이지만 **★CEO-67 #2 로 소재 폐기★**

`BRyIGhne`/`fJnXoczH` · `J5iu28X0`/`qUBFgrJh` · `3RnQr8ij`/`TBmB4UwJ` ·
`LBYpCxSE`/`OUUdEboi` · `IwdWMYTH`/`3Pugm6tq`

---

## 10. GenTeam 첨부 · 회수물

**GenTeam 첨부** (`none`)
`CD8McNPR`(★회신 2건★) · `MaKeopCk`(previz_playbook.md) · `MCQai56g` · `juIKmMhU`

**회수물** (`none`)
`AGEG746V` `nuLOLscf` `9KoGwPw2` `a9CqLTW6` `WKXcEQ6t` `IJh0xcv0` `IYsy9DFS` `Yq4Qf8Ny`
`wLHRbM4R` `fDTX4RiA` `Axu0EvC7` `tYQ089Su` `f6FLBe1h` `Pk4Tbr9g` `0OjpeVaV` `4edNu2vz`
`IhWBXKGk` `T8ZSpCBQ` `0UxD3EXC` `3MPIc6sX` `AD0qFkCQ` `NL7GdaED` `RkDBQdRC` `COoiaKn7`
`WEu4co1n` `hjmw1zOh` `J0hJICzH`
`sGSPzIgu`(plate 39장 zip) · `BNCK7JQk`(대본+나레이션 zip)

**CEO 제공 42장** — ★"참고만" (CEO-17)★
`xYaHGuys` `mwpd0FEB` `nMQ6Nsfn` `QQCXSFqJ` `8ZTbWv2r` `q0crCMpI` `pUi0uK4R`
`tMQYZ0mr`(⚠세로) `X7dBTm8o` `AO0OlDiw` `yrbGPANk` `v8aUAQrc` … `49PNLGkV`
(★`WjDsDqyO`/`uW0RCW5D` = BEFORE/AFTER★)

---

## 11. ⚠ Read 툴 부산물 — **납품 링크로 쓰지 말 것 (교훈 143)**

이 URL 들은 Read 툴이 파일을 열 때 부수적으로 생성한 것이다. 납품물이 아니다.

`DMPczo3B` `a2CrY84c` `GABOLIQe` `I4lE9NcC` `Yjj6P0YE` `NJ6tOOIW` `CbyXeHjI` `s6LoCfxB`
`Kzm7YTee` `dNSEJspJ` `jpqNQHRa` `2CZKO9oj` `HKtQLZgv` `Dkrz1sSw` `mVDBTC84` `Bdskjf8T`
`QyJy0Qo6` `jIHumtVz` `jjUZIsU5` `jeAtcA1i` `HGA5zscL` `0vqQeMfm` `oCTLXkoY` `tN6Ks305`
`v9MnwLf7` `Gqa8bUnC` `ZlHIUDzw` `4QtT5BzU` `QgCnF2kR` `h3QiUJ4V` `TeDGcAhL` `exmFVR76`
`UpMKSI05` `0A3ak08d` `swuobzkn` `YCw6LH9P` `r4U9exVg` `a15oxa4C` `kjfw3vH7` `0GM3gaRK`
`j5LivDnA` `lXnKk9E1` `XCopQrAk` `OL9veHfF` `oRzbtC6t` `CYny3dyY` `AXe1B9sO` `pvzQKErY`
`MKTJiYZo`

**다운로드 규약**
- `fal.media` URL → `curl` 가능
- `genspark.ai/api/files/s/` URL → `DownloadFileWrapper` 툴 필요

---

## 12. GitHub / Live

### PR

| PR | 상태 | 커밋 |
|---|---|---|
| **#285** | **OPEN** | 최신 (이 세션에서 갱신) |
| #284 | MERGED | `cf369db` (노하우 헌법화) |
| #283 | MERGED | `25a1e94` |
| #282 | MERGED | `fce0114` |
| #281 | MERGED | `5fe7535` |
| #280 | MERGED | `0280c6a` |
| #279 | MERGED | `b43eac4` |
| #278 | MERGED | `ac533ba` (**요청 1 = 제작법 교육 완료**) |

**Deferred (착수 금지)**: OPEN PR #271 #269 #252 #245

리포지토리: `github.com/ghwelcome0-cloud/lifeportfolio-site`
학습 정본: `docs/marketing/youtube/70_HYBRID_3D_MOTION_GUIDE.md` (648행)

### Live — 전부 200

`lifeportfolio.co.kr/` (모바일 Lighthouse 64) · `/report` · `/program` · `/report-guide` ·
`/program-guide` · `/checkin-21` · `/mypage` · `/product-v2` · `/b2b` · `/suvey`

**repo 소스 무접촉 · 재배포 불필요**

---

## 13. GenTeam 산출물 메타 (파일 지문)

```
★body_B_revived.mp4
   405.233초 · 30fps · 12,157프레임 · -16.0 LUFS · SRT 112큐 미번인
   = 숏폼 A/B/C 초 단위의 기준 파일
   ★실증: 앞부분 타임코드가 500s 격자와 일치 (최대 오차 0.48s)★

lifeportfolio-longform-v13-final-candidate.mp4
   33,007,101 B · sha256 25ef395b…82af59 · = lf/work/v13.mp4
   500.000000s 이지만 30fps 15000f (24fps 격자와 불일치)

v14
   500.010667s 오디오 · 24fps 12,000f · SRT 114큐 v14_500s_v2.srt
```

---

## 14. 무접촉 파일 (금지 / 타인 소관)

| 파일 | 사유 |
|---|---|
| `webapp/report.html` | 무수정 (458,713 B) |
| `webapp/assets/js/report-engine.js` | **DO NOT MODIFY** |
| `webapp/assets/js/report-engine-v4.js` | 타인 소관 |
| `mk_report_pages.mjs` | 미추적 |
| `shoot_report.mjs` | 미추적 · ⚠사용 불가 |
| `webapp/scripts/*.mjs` | 타인 소관 |
| `webapp/studio/key-content.html` | 타인 소관 |

---

## 숏폼 C (「연봉만 보면 놓치는 것」) 버전 대장 — v1 ~ v5

「같은 이름의 파일이 다섯 번 다른 내용이었다」는 사실을 기록으로 남긴다.
이 표가 없으면 다음 작업자는 「왜 v5 인가」를 재현할 수 없다. [교훈 192 · CEO-73 재생산 지침]

| 버전 | 산출물 | 픽셀 직독 | 폐기 사유 (= 발견된 교훈) | 위치 |
|---|---|---|---|---|
| v1 | 6컷 9:16 | — | 컷마다 같은 모션 (CEO-67 #5) | `/tmp/old_v1/`, `/tmp/old_v1_916/` |
| v2 | 6컷 | — | G5 통과분이 렌더에서 안 보임 → **G6 신설** (교훈 203/207) | `/tmp/old_v2/` |
| v3 | 6컷 | A4-01 **완전 회색** | 「크다」≠「보인다」 → **G8 화각·가림 신설** (교훈 210) | `/tmp/old_v3/` |
| v4 | 6컷 | A4-01 **0.051** | 무브-세트 z 미검사 → **Z-FIT 게이트 + 무브 6종** (교훈 211) | `/tmp/old_v4/` |
| **v5** | **6컷 → 9:16 25.92s** | **6 / 6 통과** | **현행** — 단, 측정 도구 자체가 틀려 한 번 더 실패로 보였다 (교훈 212) | `lf/r3d/_batch/`, `lf/work/longform/_c916/` |

### v5 산출물 URL

| 항목 | URL | 사양 |
|---|---|---|
| **숏폼 C v5 (9:16 최종)** | https://www.genspark.ai/api/files/s/K2vE63H2 | 1080x1920 · 24fps · 622f · 25.92s · 1,425,470 B |
| 컷별 콘택트 시트 (6컷 p50) | https://www.genspark.ai/api/files/s/wLOrOXNV | 1296x492 |

### v5 검증 수치 (전부 무료 측정)

| 게이트 | 결과 | 하한/기준 |
|---|---|---|
| SCRIPT GATE (G1~G3, G5~G7) | **FAILURES 0** | 0 |
| G5 몰입(방향) | 6 / 6 | SUBJ_NEAR 0.25 m |
| G6 프레이밍(크기) | 6 / 6 · 최저 0.175 | SUBJ_FRAC_MIN 0.14 |
| G7 샷 사이즈 | 2 / 2 | SHOT_OVERLAP_MAX 0.34 |
| Z-FIT (카메라 높이) | 6 / 6 · cam z 최대 3.43 m | 세트 top × 1.50 |
| **렌더 픽셀 직독 (정정 마스크)** | **6 / 6** · 최저 best 0.188 | 0.14 |
| FLOW GATE (광류 p95) | **min 11.60 / med 29.45 / max 38.30** | ≥ 1.50 px |
| CLIP GATE (잉크 화면 밖 이탈) | **0 프레임** | 0 |
| 자막 패널 폭 | 0.439 ~ 0.631 | PANEL_W_MAX 0.633 (승인 std3) |

### v5 컷 구성 — 대본 흐름 병기 [CEO-48]

| # | job | 대본 시각 | 나레이션 (정본) | 화면 문구 (조판) | 무브 / 렌즈 |
|---|---|---|---|---|---|
| 1 | `J_A3-13` | 3:22.50–3:26.70 | 중요한 것은 나에게 필요한 조건을 과장 없이 알아보는 것입니다. | 중요한 건 / 과장 없이 / 알아보는 것 | `sill_retreat` 40 mm |
| 2 | `J_A3-14` | 3:26.70–3:28.98 | 두 번째 문장을 완성해 보세요. | 두 번째 문장을 / 완성해 보세요 | `creep_in` 50 mm |
| 3 | `J_A3-15` | 3:28.98–3:33.10 | 나는 이런 방식으로 일할 수 있는 환경에서 더 꾸준히 기여한다. | 나는 이런 방식으로 / 일할 수 있는 환경에서 / 더 꾸준히 기여한다 | `breathe_in` 54 mm |
| 4 | `J_A3-16` | 3:33.10–3:40.06 | 예를 들면, 나는 목적을 공유받고 실행 방식은 스스로 설계할 수 있는 환경에서 더 꾸준히 기여한다. | 목적은 공유받고 / 실행 방식은 / 스스로 설계할 수 있는 환경 | `orbit_half` 82.5 mm |
| 5 | `J_A3-17` | 3:40.06–3:45.44 | 다음 선택에서 회사 이름이나 연봉만 볼 때 빠지기 쉬운 것이 바로 이 문장입니다. | 회사 이름이나 연봉만 보면 / 빠지기 쉬운 게 / 바로 이 문장입니다 | `sill_retreat` 40 mm |
| 6 | `J_A4-01` | 3:45.44–3:48.38 | 이제 남기고 싶은 변화를 봅니다. | 다음은 / 남기고 싶은 변화 | `desk_graze` 45 mm |

프레임 고정 요소: TAG 「다음 선택 전에」 · TITLE 「연봉만 보면 / 놓치는 것」 · CTA 「당신의 두 번째 문장은?」

### v5 의 알려진 한계 (게시 전 대표님 판단 필요)

1. **follow-the-object 미적용** — 벤치마크 6/6 이 한 소도구를 전 컷 관통시키는데, v5 는 컷마다 소도구가 바뀐다 (`cmptab → card → card → brief → posting → res`). 처방은 `76_BENCHMARK_STUDY.md` §1 에 있고 코드 미적용.
2. **컷 길이 평균 4.3 초** — 벤치마크는 0.5~4 초. 체감 속도가 느리다.
3. **나레이션 오디오 미결합** — 현재 무음. 자막만으로 읽힌다.
4. **CLIP GATE 부분 무력** — glyph 6 / sheet 4059 로 분류되어 대부분 덩어리가 「시트」로 판정된다. 자막/제목 밴드를 무조건 글자로 보는 정정이 필요.

---

## v7 — ★[CEO-85] 「영상」 납품본★ (2026-08-28)

### 왜 v7 이 v5 를 대체하는가

[CEO-85] 는 **"프래비즈를 넘어서 영상으로 제작하세요"** 이고, 동시에
**"너무 많은 시간과 비용 … 낭비 수준이에요"** 였다.
v5 는 「무음 프리비즈」였다. v7 은 **나레이션이 결합된 완성 영상**이다.
그리고 v5 의 알려진 한계 4항 중 **1번(follow-the-object)과 3번(나레이션 미결합)이 해소**되었다.

### v7 산출물 URL

| 항목 | URL | 사양 |
|---|---|---|
| **★숏폼 C v7 완성본 (나레이션 포함)★** | https://www.genspark.ai/api/files/s/p2X4kHHb | 1080x1920 · 24fps · 384f · **16.000000s** · h264 + aac192k · 1,151,434 B |
| 무음 조립본 (중간 산출물) | 로컬 `_c916/shortsC_916.mp4` | 384f · 760,620 B |
| 육안 확인 f12 (J_A3-13) | https://www.genspark.ai/api/files/s/rs21xDeW | 타이틀+태그+자막+CTA 정상 |
| 육안 확인 f130 (J_A3-14) | https://www.genspark.ai/api/files/s/vk8QM9Js | 앵커 카드 + 제목 바 선명 고립 |
| 육안 확인 f370 (J_A3-17) | https://www.genspark.ai/api/files/s/o7e0LXgW | 앵커 카드가 채용공고 위 · 3줄 자막 |

파일명: `shortsC_연봉만보면놓치는것_1080x1920_16s_나레이션포함.mp4`

### v7 컷 구성 — 4컷 16.00s (v5 의 6컷에서 2컷 제외)

| # | job | 대본 시각 | 나레이션 (정본) | 화면 문구 (조판) | 렌더 프레임 |
|---|---|---|---|---|---|
| 1 | `J_A3-13` | 3:22.50–3:26.70 | 중요한 것은 나에게 필요한 조건을 과장 없이 알아보는 것입니다. | 중요한 건 / 과장 없이 / 알아보는 것 | 101f |
| 2 | `J_A3-14` | 3:26.70–3:28.98 | 두 번째 문장을 완성해 보세요. | 두 번째 문장을 / 완성해 보세요 | 55f |
| 3 | `J_A3-15` | 3:28.98–3:33.10 | 나는 이런 방식으로 일할 수 있는 환경에서 더 꾸준히 기여한다. | 나는 이런 방식으로 / 일할 수 있는 환경에서 / 더 꾸준히 기여한다 | 99f |
| — | ~~`J_A3-16`~~ | 3:33.10–3:40.06 | (제외) | — | — |
| 4 | `J_A3-17` | 3:40.06–3:45.44 | 다음 선택에서 회사 이름이나 연봉만 볼 때 빠지기 쉬운 것이 바로 이 문장입니다. | 회사 이름이나 연봉만 보면 / 빠지기 쉬운 게 / 바로 이 문장입니다 | 129f |
| — | ~~`J_A4-01`~~ | 3:45.44–3:48.38 | (제외) | — | — |

**제외 이유** — [CEO-83] 축④ 앵커 커버율. `J_A3-16` / `J_A4-01` 은 앵커(조건 카드)가
소도구 교체로 끊긴다. 4컷으로 줄여 **앵커 커버 100% (384/384 f)** 를 확보했다.
근거 주석은 `shorts916.py` CUTS 블록 13행에 있다.

### v7 검증 수치 (전부 무료 측정)

| 게이트 | 결과 | 하한/기준 |
|---|---|---|
| SCRIPT GATE (G1~G3, G5~G8) | **FAILURES 0** | 0 |
| G5 몰입(방향) | 6 / 6 | SUBJ_NEAR 0.25 m |
| G6 프레이밍(크기) | 6 / 6 | SUBJ_FRAC_MIN 0.14 |
| G7 샷 사이즈 | 2 / 2 | SHOT_OVERLAP_MAX 0.34 |
| **★G9 ANCHOR (신설)★** | **4 / 4** · 1.10 ~ 1.39 | 첫 프레임 비 ≥ 1.00 · 런 커버 ≥ 0.85 · 정체성 1종 |
| **★G9 런 커버★** | **100% (384/384 f = 16.00s)** · 정체성 **1종** | ≥ 0.85 |
| **★G10 RIVAL (신설)★** | **4 / 4** · 경쟁자 0개 | 휘도 55% **그리고** 크기 70% |
| Z-FIT (카메라 높이) | 통과 | 세트 top × 1.50 |
| FLOW GATE (광류 p95) | **min 15.09 / med 24.59 / max 35.32** · 미달 **0/7** | ≥ 1.50 px |
| CLIP GATE (잉크 화면 밖 이탈) | **0 프레임** | 0 |
| 자막 패널 폭 | 0.364 / 0.439 / 0.610 / 0.619 | PANEL_W_MAX 0.633 (승인 std3) |
| **★나레이션 ↔ 영상 길이★** | **16.000000s == 16.000000s** | 소수점까지 일치 |
| 육안 확인 (최종 심판) | 3프레임 — 조판·앵커 정상 | — |

### ★v7 에서 해소된 v5 한계★

| v5 한계 | 상태 | 근거 |
|---|---|---|
| 1. follow-the-object 미적용 | **✅ 해소** | 앵커 = 조건 카드 1종, 전 4컷 관통. G9 커버 100% · 정체성 1종. G10 으로 경쟁자 0 확인 |
| 2. 컷 길이 평균 4.3초 | ❌ **잔여** (평균 4.00초) | 벤치마크 0.5~4초. 다음 배치 과제 |
| 3. **나레이션 오디오 미결합** | **✅ 해소** | `v14_audio_500s.wav` 컷별 절단 + concat + mux. 16.000000s 정확 일치 (교훈 221) |
| 4. CLIP GATE 부분 무력 | ❌ **잔여** (glyph 0 / sheet 2390) | 자막/제목 밴드를 무조건 글자로 보는 정정 필요 |

### ★v7 에서 「이월」로 판정한 항목 — 교훈 220 적용★

`anchorpx.py` 렌더 픽셀 직독에서 고립비 5건이 자기 부과 하한 `ISOLATION_MIN=1.35` 에 미달했다.

```
J_A3-13_p0/50/95   1.20 / 1.18 / 1.18   FAIL
J_A3-17_p50/95     1.29 / 1.28          FAIL
2등 정체 = L≈138 벽면/구조물 (ENV_WALL_HI = 0.215) — note 아님
```

**판정: (B) 현 v7 로 납품. 근거 4가지** (전문은 `77_PRODUCTION_SOP.md` §6.2)

1. 하한 1.35 는 **내가 코드에 써넣은 값**이고 CEO·대본·기획 어디에도 없다 → **자기 부과 게이트**
2. CEO 는 동일 수준 영상을 이미 승인했다 — [CEO-82] *"이제 영상 자체는 군더더기가 없어요"*
3. 처방(벽 톤 하향)은 **전 세트 재렌더**를 요구한다 → [CEO-85] 가 「낭비」로 규정한 루프
4. **필수 게이트는 전부 통과** — SCRIPT GATE 0 · FLOW p95 min 15.09 (하한의 10배)

**이월 처리**: `ENV_WALL_HI=0.215` 하향은 **다음 신규 렌더 배치에서 함께** 반영한다.
기존 클립을 그것만을 위해 단독 재렌더하지 않는다.

### v7 재생산 명령 (복사 가능 · [CEO-73])

```bash
# 1) 설계 → 게이트 (0.43s · 무료)
cd /home/user/lf/r3d && python3 sets.py && python3 scenemap.py && python3 scenejobs.py && python3 script_gate.py

# 2) 9:16 조립 (≈48s)
cd /home/user/lf/work/longform && python3 -u shorts916.py build

# 3) FLOW + CLIP GATE (≈77s)
cd /home/user/lf/work/longform && python3 -u shorts916.py gate

# 4) 나레이션 컷별 절단 + concat + mux (≈3.5s)
#    ★세그먼트 길이 = 렌더 프레임 수 ÷ FPS (대본 dur 아님 — 교훈 221)★
#    seg0 t0=202.50 len=255f/24=10.62500 · seg1 t0=220.06 len=129f/24=5.37500
#    상세 절차는 77_PRODUCTION_SOP.md §5
```

---

## 롱폼 — ★[CEO-85] ② 조립 착수★ (2026-08-28)

### 왜 이 절이 필요한가

숏폼 C 는 납품 완료됐다. 롱폼은 **같은 파이프라인의 76잡 전량**을 쓴다.
이 절은 롱폼 조립의 **규격·도구·검증 이력**을 재생산 가능하게 남긴다 ([CEO-73]).

### 규격

| 항목 | 값 |
|---|---|
| 잡 수 | **76** (`scenejobs.json`) |
| 대본 선언 프레임 | **8399 f = 349.958 s** |
| 오디오 가용 후 keep | **8392 f = 349.666667 s** (tail trim 7 f = 0.292 s) |
| 시작 | `J_A3-01` **t0 = 150.32 s** |
| 끝 | `J_A8-GAP` t1 = 500.00 s |
| ACT 범위 | A3 ~ A8 |
| **HEAD 실사** | **★없음★** ([CEO-67] 반려 1·2) |
| **TOTAL 하드게이트** | **★없음★** ([CEO-67] 반려 3) |
| 자막 | 시안 네온 ASS (`SUB_RIM=&H00CEC98C` / `SUB_INK=&H00F1F1F1`) |
| 나레이션 절단 | **1 세그먼트** (컷을 건너뛰지 않으므로 · 교훈 221) |

### 도구

| 파일 | 용도 |
|---|---|
| `work/longform/longcut.py` | **★납품용 조립기★** — `map` / `film` / `deliver` |
| `work/longform/previzcut.py` | **검토용 프리비즈 컷** (보존 · 개조하지 않음) |

**★도구를 용도별로 분리했다★** — `previzcut.py` 의 슬레이트·`ROUGH PREVIZ`·샷ID·
타임코드·HEAD 는 검토에는 필수이고 게시에는 전부 실격이다.

### 검증 이력 — ★게이트가 38.8초 어긋난 납품을 막았다★

| 단계 | 결과 |
|---|---|
| 렌더 19잡 | ✅ BATCH DONE 1392 f / 28.8분 |
| `longcut.py map` (v1) | **MAP OK** — 파일 존재만 확인 (★불충분★) |
| `longcut.py film` | **★FILM FAILED  9330 f vs 8399 f★** |
| 조각별 `ffprobe -count_frames` | **★11잡 불일치 · +931 f = 38.8 초★** |
| 원인 | 08-22~23 구세대 + `previz_batch.py` SKIP 로직 |
| 처방 | 교훈 222 + `cmd_map()` 프레임 수 검사로 강화 |
| 재렌더 | ◐ 진행 중 (11잡 1304 f) |

### 재생산 명령 ([CEO-73])

```bash
# 0) 게이트 (렌더 0초 · 무료)
cd /home/user/lf/r3d && python3 -u script_gate.py        # FAILURES 0 확인 + G11 인구조사

# 1) MAP — 프레임 수까지 검사한다 (교훈 222)
cd /home/user/lf/work/longform && python3 -u longcut.py map
#    STALE 이 나오면 re-render list 를 그대로 PREVIZ_JOBS 에 넣는다:
#    cd /home/user/lf/r3d && for j in <목록>; do mv _batch/$j.mp4 /tmp/genold/; done
#    PREVIZ_JOBS="<목록>" setsid nohup python3 -u previz_batch.py > /tmp/lf.log 2>&1 &

# 2) 무음 본편
python3 -u longcut.py film        # _long/film.mp4

# 3) 나레이션 + 시안 네온 자막
python3 -u longcut.py deliver     # longform_deliver.mp4

# 4) 육안 (최종 심판 · 신뢰도 위계 6위)
ffmpeg -y -i longform_deliver.mp4 -vf "select=eq(n\,1200)" -vframes 1 /tmp/lf1200.png
```

### 이월 (교훈 220 · 추가 렌더 루프 금지)

| 항목 | 이월 이유 |
|---|---|
| `ENV_WALL_HI=0.215` 하향 | 자기 부과 게이트 미달 → **다음 신규 배치** |
| 컷 길이 4.29초 → 3초 | G11 2단 승격과 함께 → **다음 신규 배치** |

**★두 항목을 같은 배치에서 동시 반영한다 — 렌더 패스 2회를 1회로 합친다.★**
