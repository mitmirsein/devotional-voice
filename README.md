# 📖 Devotional Voice Plugin for Obsidian v2

음성, 텍스트, 또는 노트 전체를 입력으로 받아 **AI 기반 묵상글**을 생성하고, **TTS(Text-to-Speech)**로 낭독해주는 Obsidian 플러그인입니다. v2 업데이트로 더욱 강력해졌습니다.

## ✨ 주요 기능 (v2 업데이트)

- **✨ 스트리밍 생성 (New)**: 묵상글 생성 과정을 **실시간으로 타이핑하듯** 지켜볼 수 있습니다.
- **� 지능형 RAG (New)**: 단순 키워드 매칭을 넘어, AI가 문맥을 파악하여 **연관 깊은 노트**를 찾아냅니다. (Query Expansion)
- **🎨 비주얼 레코더 (New)**: 녹음 시 목소리의 파동을 **오디오 시각화(Waveform)**로 보여주어 녹음 상태를 직관적으로 확인합니다.
- **� 다중 템플릿 (New)**: 설교, 묵상, 일기 등 용도에 따라 **여러 개의 프롬프트 템플릿**을 관리하고 상황에 맞춰 골라 쓸 수 있습니다.
- **⏱️ 긴 녹음 지원**: 최대 5분의 API 대기 시간을 지원하여, 긴 호흡의 녹음도 안정적으로 처리합니다.
- **🎤 음성 입력**: 마이크로 묵상 주제를 녹음하면 자동으로 텍스트 변환
- **🔊 TTS 낭독**: Gemini TTS로 라디오 진행자 같은 자연스러운 음성 낭독

---

## 🚀 설치 방법

### BRAT을 통한 설치 (권장)

1. **BRAT 플러그인 설치**
   - Obsidian 설정 → Community Plugins → Browse
   - "BRAT" 검색 후 설치 및 활성화

2. **Devotional Voice 플러그인 추가**
   - `Cmd/Ctrl + P` → `BRAT: Add a beta plugin for testing`
   - 레포지토리 입력: `mitmirsein/devotional-voice`
   - 설치 완료 후 플러그인 활성화

### 수동 설치

1. [Releases](https://github.com/mitmirsein/devotional-voice/releases)에서 최신 버전 다운로드
2. `main.js`, `manifest.json`, `styles.css`를 볼트의 `.obsidian/plugins/devotional-voice/` 폴더에 복사
3. Obsidian 재시작 후 플러그인 활성화

---

## ⚙️ 설정

설정 → Devotional Voice 탭에서 구성합니다.

### 🎤 음성 인식 (STT)
| 설정 | 설명 |
|---|---|
| Service Provider | `Groq` (무료/빠름) 또는 `OpenAI` 선택 |
| OpenAI API Key | OpenAI STT 사용 시 필요 |
| Groq API Key | [console.groq.com/keys](https://console.groq.com/keys)에서 무료 발급 |

### 🔍 지능형 RAG 검색
| 설정 | 설명 |
|---|---|
| 화이트리스트 폴더 | 검색 대상 폴더 (콤마 구분). 예: `묵상일지/, 성경연구/` |
| 최대 검색 결과 | 참조할 노트 개수 (1~10) |
| **Query Expansion** | Gemini API를 사용하여 검색어 확장 (설정된 Gemini Key 자동 사용) |

### ✨ 묵상글 생성 & 템플릿
| 설정 | 설명 |
|---|---|
| Gemini API Key | [aistudio.google.com](https://aistudio.google.com)에서 발급 **(필수)** |
| Gemini Model | `gemini-2.0-flash` 이상 권장 (스트리밍 지원) |
| **Templates** | 다중 템플릿 관리자. `+` 버튼으로 추가, 드롭다운으로 활성 템플릿 선택 |

### 🔊 TTS 설정
| 설정 | 설명 |
|---|---|
| TTS 활성화 | TTS 기능 ON/OFF |
| TTS 제공자 | `Gemini TTS`, `OpenAI TTS` |
| Gemini Voice | 15가지 음성 선택 (Kore, Fenrir, Aoede 등) |

---

## 📚 사용법

### 1. 묵상글 생성 (스트리밍)

**방법 A: 리본 아이콘**
- 좌측 리본의 📖 아이콘 클릭
- 입력 방식 선택 (음성/텍스트 선택/현재 노트)
- **녹음 시**: 파형이 움직이는 비주얼라이저를 보며 녹음.
- **생성 시**: 실시간으로 생성되는 묵상글을 팝업창에서 확인. 완료 후 노트에 자동 삽입.

**방법 B: 명령어 팔레트**
- `Cmd/Ctrl + P` 후 아래 명령어 실행:
  - `From Voice`: 음성 녹음으로 묵상
  - `From Selection`: 선택한 텍스트로 묵상
  - `From Current Note`: 현재 노트 전체로 묵상

### 2. TTS 재생
- `Cmd/Ctrl + P` → `Read Aloud: TTS 재생`
- 노트 하단에 숨겨진 `%%TTS-SCRIPT:...%%` 대본을 자동으로 읽습니다.
- 라디오 DJ 스타일의 스크립트가 별도로 생성되어 더욱 자연스럽습니다.

### 3. 오디오 파일 저장
- `Cmd/Ctrl + P` → `Save Audio: TTS 대본 오디오 저장`
- 현재 노트와 같은 폴더에 `.wav` 파일로 저장되며 노트에 임베드됩니다.

---

## 💰 비용 안내

| 항목 | 비용 |
|---|---|
| 묵상글 1회 생성 (gemini-2.0-flash) | **매우 저렴** (거의 무료 수준) |
| TTS 오디오 생성 (gemini) | **무료** (Google 정책에 따라 변동 가능) |
| Groq STT | **무료** (현재 베타 기간) |

---

## 🛠️ 개발

```bash
# 의존성 설치
npm install

# 개발 빌드
npm run dev

# 프로덕션 빌드
npm run build
```

---

## 📄 라이선스

AGPL-3.0 License

이 프로젝트는 [voice-writing](https://github.com/reallygood83/voice-writing)의 코드를 기반으로 하며, 동일한 AGPL-3.0 라이선스를 따릅니다.

---

## 🙏 감사의 말

이 플러그인은 [reallygood83/voice-writing](https://github.com/reallygood83/voice-writing)에서 영감을 받아 제작되었습니다. 훌륭한 오픈소스 프로젝트에 감사드립니다.
