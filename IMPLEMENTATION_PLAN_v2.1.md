# Devotional Voice v2.1 기능 개선 계획

## 1. 개요
동지 구아레스키의 요청에 따라 STT 제공자에 Google Gemini를 추가하고, TTS 진행률 표시 및 녹음 제한 해제를 포함한 2.1 버전 개선 계획입니다.

## 2. 작업 단계 (Phases)

### Phase 1: STT 제공자에 Google Gemini 추가
> **목표**: Whisper 대안으로 Gemini의 오디오 인식 기능을 활용하여 STT 비용 절감 및 정확도 향상.
- [ ] **Constants**: `ServiceProvider` 타입에 `gemini` 추가 및 API 엔드포인트 설정.
- [ ] **TranscriptionService**: Gemini API를 이용한 오디오 파일 업로드 및 텍스트 변환 로직 구현. (이미지/비디오와 유사한 파일 업로드 API 사용)
- [ ] **Settings UI**: STT Provider 드롭다운에 Gemini 추가 및 API Key 입력 필드 연동 (이미 있는 Gemini Key 재사용 가능하도록 설계).

### Phase 2: TTS 오디오 생성 진행률 Bar 추가
> **목표**: 묵상글이 길어질 경우 TTS 오디오 생성 대기 시간을 시각적으로 확인.
- [ ] **TTS Service**: `generateAudio` 시 진행률 상태를 보고하는 콜백 추가.
- [ ] **Modals**: TTS 전용 진행 바(Progress Bar)를 포함한 모달 또는 알림 바 구현.
- [ ] **Logic**: 오디오 버퍼 생성 시 chunk 단위 처리가 가능하다면 실시간 반영, 불가능할 경우 API 대기 중 스피너/프로그레스 애니메이션 적용.

### Phase 3: 녹음 시간 제한 해제 (1분 이상 지원)
> **목표**: 긴 묵상이나 기도를 안정적으로 수집.
- [ ] **Recorder**: `MediaRecorder`의 chunk 수집 주기 및 저장 용량 최적화.
- [ ] **Constants**: `TIMEOUT_MS` 확인 및 필요 시 상향 조정 (현 5분).
- [ ] **Processing**: 긴 파일 처리 시 타임아웃 방지 로직 보완.

## 3. 기술적 변경 사항
- **`src/constants.ts`**: 서비스 프로바이더 설정 및 에러 메시지 업데이트.
- **`src/transcription.ts`**: `gemini` STT 로직 추가.
- **`src/tts.ts`**: 진행률 보고 인터페이스 추가.
- **`main.ts`**: UI 설정 탭 및 TTS 생성 로직 업데이트.
- **`src/modals.ts`**: TTS 진행률 Bar UI 추가.

## 4. 검증 계획
1. **STT**: Gemini를 선택하고 장문(1분 이상) 녹음 시 정확하게 변환되는지 확인.
2. **TTS**: 생성 버튼 클릭 시 진행 바가 나타나고 오디오가 정상 재생되는지 확인.
3. **안정성**: 5분 이상의 긴 녹음 시 브라우저/Obsidian 렉 발생 여부 체크.
