# 📖 Devotional Voice Plugin for Obsidian

음성, 텍스트, 또는 노트 전체를 입력으로 받아 **AI 기반 묵상글**을 생성하고, **TTS(Text-to-Speech)**로 낭독해주는 Obsidian 플러그인입니다.

## ✨ 주요 기능

- **🎤 음성 입력**: 마이크로 묵상 주제를 녹음하면 자동으로 텍스트 변환
- **📝 텍스트 선택**: 노트에서 텍스트를 선택하여 묵상 생성
- **📂 현재 노트**: 열려있는 노트 전체를 기반으로 묵상 생성
- **🔍 RAG 검색**: 볼트 내 관련 노트를 자동 검색하여 맥락 강화
- **✨ AI 묵상글 생성**: Gemini AI를 활용한 신학적 깊이의 묵상글
- **🔊 TTS 낭독**: Gemini TTS로 자연스러운 음성 낭독
- **💾 오디오 저장**: 생성된 TTS를 WAV 파일로 저장

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

**Groq API Key 발급 방법:**
1. [console.groq.com](https://console.groq.com/) 접속
2. Google 또는 GitHub 계정으로 로그인
3. 좌측 메뉴 → **API Keys** 클릭
4. **Create API Key** 클릭 → 키 이름 입력 후 생성
5. 생성된 `gsk_...` 형식의 키를 복사하여 설정에 입력

### 🔍 RAG 검색
| 설정 | 설명 |
|---|---|
| 화이트리스트 폴더 | 검색 대상 폴더 (콤마 구분). 예: `묵상일지/, 성경연구/` |
| 최대 검색 결과 | 참조할 노트 개수 (1~10) |

### ✨ 묵상글 생성
| 설정 | 설명 |
|---|---|
| Gemini API Key | [aistudio.google.com](https://aistudio.google.com)에서 발급 **(필수)** |
| Gemini Model | 기본: `gemini-2.5-flash` |
| Prompt Template | 묵상글 생성 프롬프트 커스터마이징 (빈칸 시 기본 템플릿) |

### 🔊 TTS 설정
| 설정 | 설명 |
|---|---|
| TTS 활성화 | TTS 기능 ON/OFF |
| TTS 제공자 | `Gemini TTS`, `OpenAI TTS`, `Web Speech (무료)` |
| Gemini TTS Model | 기본: `gemini-2.5-flash-preview-tts` |
| Gemini Voice | 15가지 음성 선택 (Kore, Fenrir, Aoede 등) |

---

## 📚 사용법

### 1. 묵상글 생성

**방법 A: 리본 아이콘**
- 좌측 리본의 📖 아이콘 클릭
- 입력 방식 선택 (음성/텍스트 선택/현재 노트)

**방법 B: 명령어 팔레트**
- `Cmd/Ctrl + P` 후 아래 명령어 실행:
  - `From Voice`: 음성 녹음으로 묵상
  - `From Selection`: 선택한 텍스트로 묵상
  - `From Current Note`: 현재 노트 전체로 묵상

### 2. TTS 재생
- `Cmd/Ctrl + P` → `Read Aloud: TTS 재생`
- 노트에 생성된 `%%TTS-SCRIPT:...%%` 대본을 자동으로 읽습니다
- 텍스트를 선택한 상태라면 선택된 부분만 읽습니다

### 3. 오디오 파일 저장
- `Cmd/Ctrl + P` → `Save Audio: TTS 대본 오디오 저장`
- 현재 노트와 같은 폴더에 `.wav` 파일로 저장
- 저장 후 노트에 `![[파일명.wav]]`가 자동 삽입됩니다

---

## 💰 비용 안내

| 항목 | 비용 |
|---|---|
| 묵상글 1회 생성 (gemini-2.5-flash) | ~$0.001 (약 1~2원) |
| TTS 오디오 생성 (gemini-2.5-flash-preview-tts) | **무료** (Preview 기간) |
| Groq STT | **무료** |

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
