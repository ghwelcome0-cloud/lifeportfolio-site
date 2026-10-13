# EP.05~EP.10 실행 순서 (「바로 시작하세요」 신호 후)
상태(2026-10-13): 대본 v1 · 엔진 xi.json · 주인공 기준 그림 · 장면 18장 × 6편 완료, 오너 확인 완료. 녹음/영상/렌더 미시작.
원칙: 렌더 외 모든 단계는 6편 병렬. 렌더는 한 번에 한 편(4GB RAM / 2 CPU). 쇼츠 없음.

## 0. 준비
- `df -h /` 확인. 여유 3GB 미만이면 업로드 끝난 `yt-ep03/build/EP03_longform.mp4`(1.04GB) 삭제.
- `ps aux | grep -E "ffmpeg|render"` 로 남은 렌더 없는지 확인.
- 편별 폴더 `/home/user/ax-work/yt-ep0N/` (ep10 포함), 툴킷은 `yt-ep04/tk/`, `yt-ep04/screens/` 를 편마다 복사.
- 이미지 다운로드: `series/fetch.sh DIR id...` (gsk download 사용, curl 직접은 막힘).

## 1. 병렬 단계 (6편 동시)
1. 대본 → `narration.txt`, `part1~5.txt` (600~700자씩, 숫자는 한글).
2. 녹음: elevenlabs/v4-tts, custom_voice_id `t5GCyTeNPnB65ZgYuIhE`, 요구사항엔 말투만.
3. 받아쓰기 대조: elevenlabs_scribe_v2 → words JSON은 DownloadFileWrapper. 잘못 읽힌 문장만 고쳐 해당 파트 재녹음.
4. vo_prep: 편별 REP/KEYS/LONG 수정 → timing, cues(subwrap v3.1 audit 0), SRT(+1.0s).
5. 배경 영상: Seedance 2.0 fast i2v, 6초, 720p, 오디오 끔, A01~A18 (source_video_uris로 받기).
6. 매치무브: A06(빈 태블릿 화면) → `tk/track.py`.
7. 배경음악: 같은 92 BPM 계열, 세계별 악기
   - 05 지음: 밤 신스 패드·피아노 / 06 펼침: 낮은 드럼·브라스 / 07 돌봄: 어쿠스틱 기타·첼로
   - 08 이음: 마림바·현악 / 09 세움: 맑은 플럭·피아노 / 10 지킴: 나무 관악·하프
8. 현장음 3종씩 (세계별).
9. 실제 화면: `screens/build.cjs`의 LOG 사전과 카드 칸 문구를 편별 대본 내용으로 교체 → `shoot.cjs` → PNG + boxes.json.
10. `tk/render.py` 편별 사본: 샷 목록(A01~A18), CHAP, tag/name 문구, 「EP.0N · k / 11」, 카드 문구, 끝 카드 동일.

## 2. 순차 단계
- 렌더 순서: EP.05 → 06 → 07 → 08 → 09 → 10 (편당 약 1시간, 60초 청크 + .ok).
- 편마다 렌더 끝나면 `finalize.sh` → `qa_all.sh`(qa_flow 경로를 그 편으로) → 기준: 디코드 0, 멈춤 0, 느린 구간 0, -16 LUFS, 피크 -1.5 이하, 받아쓰기 일치.
- 통과 시 업로드 → 썸네일 3안, METADATA(장 시간), SRT → 커밋 → 다음 편 렌더 전 mp4/청크 정리로 디스크 확보.

## 3. 글쓰기·화면 규칙 (재확인)
「—」 금지, 사실만, 대비 구도 금지, 가격·「무료」 금지, 성경 인물 금지, 기업인은 남긴 것과 다시 쓴 사람만, 모든 인물 가상·미니어처, 화면 표기 「가상의 인물 · 설명용 시각화」 / 「실제 서비스 화면 · 예시 계정」.
