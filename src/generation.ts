import { requestUrl } from 'obsidian';
import { SearchResult } from './rag';

export interface GenerationSettings {
    geminiApiKey: string;
    geminiModel: string;
    devotionalTemplate: string;
}

const DEFAULT_TEMPLATE = `당신은 탁월한 영성을 지닌 신학자이자, 청중의 마음을 위로하는 설교자입니다.

사용자의 묵상 내용과 관련 노트를 바탕으로, 깊이 있는 신학적 통찰과 따뜻한 목회적 적용이 담긴 묵상글을 작성해 주세요.
반드시 아래 JSON 형식으로 출력해야 합니다.

## 출력 형식 (JSON)
{
  "markdown": "## 오늘의 묵상\\n[깊이 있는 본문 해석]\\n\\n### 적용\\n[구체적인 삶의 적용]\\n\\n### 기도\\n[영성 있는 기도문]",
  "ttsScript": "(배경음악이 깔린 듯한 차분하고 호소력 짙은 어조로) 사랑하는 여러분, 오늘의 묵상을 나눕니다. ... (본문의 핵심 메시지를 구어체로 풀어서) ... 그렇다면 이것을 우리 삶에 어떻게 적용할 수 있을까요? ... (적용점 제시) ... 이제 함께 기도하겠습니다. ... (기도문 낭독) ... 예수님의 이름으로 기도드립니다. 아멘."
}

## 작성 지침
1. **Markdown 본문**:
   - 신학적 깊이가 있어야 하며, 본문의 맥락을 정확히 짚어야 함.
   - 적용은 막연하지 않고 구체적이어야 함.

2. **TTS 대본 (ttsScript)**:
   - **어조**: 라디오 심야 방송 진행자처럼 따뜻하고 차분하며, 듣는 이의 감정을 어루만지는 톤.
   - **섹션 구분**: "오늘의 묵상 본문입니다", "잠시 우리 삶을 돌아봅시다", "함께 기도드리겠습니다"와 같은 자연스러운 연결 멘트를 반드시 포함할 것.
   - **문체**: 딱딱한 문어체가 아닌, 바로 옆에서 이야기해주는 듯한 부드러운 구어체 사용. 이모지나 특수문자는 제거.
   - 쉼표(,)와 마침표(.)를 적절히 사용하여 호흡을 조절할 것.

3. 언어: 한국어`;

export interface GenerationResult {
    markdown: string;
    ttsScript: string;
}

/**
 * Generation Service for creating devotional content using Gemini API
 */
export class GenerationService {
    private settings: GenerationSettings;

    constructor(settings: GenerationSettings) {
        this.settings = settings;
    }

    /**
     * Generate devotional content
     */
    async generate(
        userInput: string,
        ragResults: SearchResult[]
    ): Promise<GenerationResult> {
        if (!this.settings.geminiApiKey) {
            throw new Error('Gemini API key is not configured');
        }

        // Build context from RAG results
        const context = this.buildContext(ragResults);

        // Build prompt
        const prompt = this.buildPrompt(userInput, context);

        // Call Gemini API
        const response = await this.callGemini(prompt);
        console.log('[DevotionalVoice] Gemini raw response:', response.substring(0, 500));

        const result = this.parseResponse(response);
        console.log('[DevotionalVoice] Parsed result:', { markdownLength: result.markdown.length, ttsLength: result.ttsScript.length });
        return result;
    }

    /**
     * Build context from RAG search results
     */
    private buildContext(results: SearchResult[]): string {
        if (results.length === 0) {
            return '관련 노트가 없습니다.';
        }

        return results.map((result, index) =>
            `### 관련 노트 ${index + 1}: ${result.file.basename}\n${result.excerpt}`
        ).join('\n\n');
    }

    /**
     * Build the final prompt
     */
    private buildPrompt(userInput: string, context: string): string {
        const template = this.settings.devotionalTemplate || DEFAULT_TEMPLATE;

        return `${template}

## 사용자 묵상 내용
${userInput}

## 사용자의 기존 노트 (참고용)
${context}

위 내용을 바탕으로 JSON 형식의 묵상글을 작성해 주세요.`;
    }

    /**
     * Call Gemini API
     */
    private async callGemini(prompt: string): Promise<string> {
        const model = this.settings.geminiModel || 'gemini-2.0-flash';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.settings.geminiApiKey}`;

        try {
            const response = await requestUrl({
                url: apiUrl,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192,
                        response_mime_type: "application/json"
                    }
                })
            });

            if (response.status !== 200) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = response.json;
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        } catch (error) {
            console.error('Gemini API error:', error);
            throw new Error(`Failed to generate devotional: ${error.message}`);
        }
    }

    private parseResponse(response: string): GenerationResult {
        // Clean up potential markdown code fences
        let cleanedResponse = response.trim();

        // Remove ```json ... ``` or ``` ... ``` wrappers
        const codeBlockMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
            cleanedResponse = codeBlockMatch[1].trim();
        }

        try {
            const parsed = JSON.parse(cleanedResponse);
            return {
                markdown: parsed.markdown || '묵상글 생성 실패',
                ttsScript: parsed.ttsScript || ''
            };
        } catch (e) {
            console.error('[DevotionalVoice] Failed to parse JSON response:', e, 'Raw response:', response);
            // Fallback: treat the entire response as markdown, no TTS script
            return {
                markdown: response,
                ttsScript: ''
            };
        }
    }

    /**
     * Update settings
     */
    updateSettings(settings: GenerationSettings) {
        this.settings = settings;
    }
}
