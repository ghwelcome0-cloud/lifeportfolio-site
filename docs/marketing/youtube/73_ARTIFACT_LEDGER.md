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
