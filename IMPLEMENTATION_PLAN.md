# MS_Dev 프로젝트 종합 구현 계획 (Devotional Voice v2)

## 1. 개요
본 계획은 기존의 **다중 템플릿 지원**뿐만 아니라, 사용자가 요청한 **RAG 지능화**, **녹음 시각화**, **스트리밍 생성** 기능을 포함한 종합 업데이트 계획입니다.

## 2. 작업 단계 (Phases)

### Phase 1: 다중 템플릿 시스템 (Multi-Template)
> **목표**: 상황에 맞는 다양한 프롬프트를 저장하고 골라 쓸 수 있게 한다.
- [ ] **Data Migration**: 기존 단일 템플릿 -> `prompts: Template[]` 배열 구조로 변경.
- [ ] **Settings UI**: 드롭다운, 추가, 삭제, 이름 변경 기능 구현.
- [ ] **Logic**: 묵상 생성 시 현재 선택된 템플릿 내용을 참조하도록 수정.

### Phase 2: RAG 지능화 (Query Expansion)
> **목표**: "주님"을 검색해도 "예수님", "하나님"이 포함된 노트를 찾는다.
- [ ] **Logic**: `processDevotional` 시작 시, 바로 검색하지 않고 LLM에게 "검색 확장 키워드"를 먼저 물어봄.
    - *Prompt*: "사용자가 '{input}'에 대해 묵상하려 한다. 관련된 노트 검색을 위한 키워드 5개를 뽑아라."
- [ ] **Execution**: 확장된 키워드로 `ragService.search` 실행하여 검색 정확도(Recall) 향상.

### Phase 3: 레코더 시각화 (Visualizer)
> **목표**: 녹음 중 마이크가 작동하고 있다는 확신을 준다.
- [ ] **UI**: `RecordingModal`에 `<canvas>` 요소 추가.
- [ ] **Audio Context**: Web Audio API의 `AnalyserNode`를 연결하여 실시간 주파수를 오디오 파형(Waveform)으로 그리기.
- [Note]: *실시간 받아쓰기(Live Dictation)는 Web Speech API를 병행 사용해야 하므로, 이번 단계에서는 '파형'만 우선 적용하여 음질과 안정성을 확보합니다.*

### Phase 4: 스트리밍 생성 (Streaming Response)
> **목표**: 결과가 나올 때까지 멍하니 기다리지 않게 한다.
- [ ] **Gemini API**: `generateContent` 대신 `streamGenerateContent` 메서드 사용.
- [ ] **UI Change**: 기존 `Notice` 대신, **실시간으로 글자가 써지는 전용 모달(View)**을 띄움.
- [ ] **UX**: 글자가 타닥타닥 생성되는 과정을 사용자에게 보여줌으로써 대기 지루함 해소.

## 3. 기술적 변경 사항
- **`main.ts`**: 설정 마이그레이션, 스트리밍 처리를 위한 오케스트레이션 로직 변경.
- **`src/generation.ts`**: 스트리밍 제너레이터(`async generator`) 도입.
- **`src/rag.ts`**: 키워드 확장을 위한 LLM 호출 로직 추가 (가벼운 모델 사용 권장).
- **`src/modals.ts`**: 녹음 파형 캔버스 및 스트리밍 텍스트 뷰어 컴포넌트 추가.

## 4. 검증 계획
1. **템플릿**: 생성/저장/전환 테스트.
2. **RAG**: "고난" 입력 시 -> "인내", "시련", "십자가" 키워드로 검색되는지 로그 확인.
3. **녹음**: 모달에서 파형이 목소리에 맞춰 춤추는지 확인.
4. **생성**: 답변이 한 번에 툭 뜨는지, 타자기처럼 흐르며 나오는지 확인.
