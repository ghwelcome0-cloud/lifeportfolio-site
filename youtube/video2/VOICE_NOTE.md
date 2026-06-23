# 음성 클론 — 확정 기록 (재발 방지)

## ✅ 확정 클론 ID
- **custom_voice_id: Ti6X6rs2eexqEt3ExCTr**
- 소스: 1편 확정 narration.mp3 구간 3개 (사용자 인정 음성)
- 클론 생성기 미리듣기(h2T451Qs)에서 사용자 음성 확인 완료 ✓

## ⚠️ 핵심 주의사항 (2편 실패 원인)
- TTS 생성 시 `requirements`에 "Speaker", "George", "Lily" 등 화자명을 절대 넣지 말 것
- 화자명이 들어가면 시스템이 custom_voice_id를 무시하고 기본 화자로 합성함 (여성/딴목소리)
- requirements에는 톤/감정만 적고, 음성 지정은 custom_voice_id로만
- 생성 후 params.speaker 가 비어있거나 무시되는지 확인

## 폐기된 잘못된 클론들
- 3SfZ4EMWUEEQhsDMuRzg (키콘텐츠 음성 - 사용자 음성 아님)
- sL6aBEnh94DKw76noiqH (잔고수정본 - 사용자 음성 아님)

## 🎯🎯 최종 확정 경로 (2026-06-23)
- **모델: elevenlabs/voice-clone (NOT multilingual-v2!)**
- **방식: voice_files=[1편구간3개] + custom_voice_id + query=대본** 함께 넣어 호출
- multilingual-v2 경로는 custom_voice_id 무시하고 여성기본음성(Lily) 나옴 → 절대 사용 금지
- voice-clone 엔진에 query(대본) 넣으면 사용자 음성으로 낭독함 ✓ 확정
- 검증: UjecmYgZ (사용자 "내 음성이에요" 확정)
