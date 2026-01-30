import { requestUrl } from 'obsidian';
import { SearchResult } from './rag';

export interface GenerationSettings {
    geminiApiKey: string;
    geminiModel: string;
    devotionalTemplate: string;
}

const DEFAULT_TEMPLATE = `당신은 탁월한 영성을 지닌 신학자이자, 청중의 마음을 위로하는 설교자입니다.

사용자의 묵상 내용과 관련 노트를 바탕으로, 깊이 있는 신학적 통찰과 따뜻한 목회적 적용이 담긴 묵상글을 작성해 주세요.

## 출력 형식 (중요)
1. 먼저 **묵상글 본문(Markdown)**을 작성하세요.
2. 본문이 끝나면 반드시 **\`|||TTS_SCRIPT_START|||\`** 라는 구분자를 한 줄에 작성하세요.
3. 그 뒤에 **TTS 대본**을 작성하세요.

## 작성 지침
1. **Markdown 본문**:
   - 신학적 깊이가 있어야 하며, 본문의 맥락을 정확히 짚어야 함.
   - 적용은 막연하지 않고 구체적이어야 함.

2. **TTS 대본**:
   - **어조**: 라디오 심야 방송 진행자처럼 따뜻하고 차분하며, 듣는 이의 감정을 어루만지는 톤.
   - **섹션 구분**: "오늘의 묵상 본문입니다", "잠시 우리 삶을 돌아봅시다" 멘트 포함.
   - **문체**: 부드러운 구어체. 이모지 제거.

언어: 한국어`;

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

위 내용을 바탕으로 묵상글과 TTS 대본을 작성해 주세요. 구분자(\`|||TTS_SCRIPT_START|||\`)를 잊지 마세요.`;
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
        // Updated for Separator Strategy
        const separator = '|||TTS_SCRIPT_START|||';
        if (response.includes(separator)) {
            const [markdown, tts] = response.split(separator);
            return {
                markdown: markdown.trim(),
                ttsScript: tts.trim()
            };
        }

        // Fallback: try JSON (legacy support)
        try {
            // Clean up potential markdown code fences
            let cleanedResponse = response.trim();
            const codeBlockMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch && codeBlockMatch[1]) {
                cleanedResponse = codeBlockMatch[1].trim();
            }
            const parsed = JSON.parse(cleanedResponse);
            return {
                markdown: parsed.markdown || response,
                ttsScript: parsed.ttsScript || ''
            };
        } catch (e) {
            // Treat entire response as markdown
            return {
                markdown: response,
                ttsScript: ''
            };
        }
    }

    /**
     * Stream generate using Fetch API
     */
    async *streamGenerate(
        userInput: string,
        ragResults: SearchResult[]
    ): AsyncGenerator<string, GenerationResult, unknown> {
        if (!this.settings.geminiApiKey) {
            throw new Error('Gemini API key is not configured');
        }

        const context = this.buildContext(ragResults);
        const prompt = this.buildPrompt(userInput, context);
        
        const model = this.settings.geminiModel || 'gemini-2.0-flash';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${this.settings.geminiApiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Gemini Stream API error: ${response.status}`);
            }

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            // Re-implementing the loop with the safer logic defined above in comment
            return yield* this.processBufferWithLogic(reader, decoder);
            
        } catch (error) {
            console.error('Gemini Stream Error:', error);
            throw error;
        }
    }
    
    private async *processBufferWithLogic(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder): AsyncGenerator<string, GenerationResult, unknown> {
        let buffer = '';
        let accumulatedText = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // Refactored inner loop for Correct Buffer Slicing
            let loopAgain = true;
            while(loopAgain) {
                loopAgain = false;
                
                let localBalance = 0;
                let localStart = -1;
                let localInQuote = false;
                let localEscaped = false;
                
                for(let j=0; j<buffer.length; j++) {
                     const c = buffer[j];
                     if(localEscaped) { localEscaped=false; continue; }
                     if(c==='\\') { localEscaped=true; continue; }
                     if(c==='"') { localInQuote=!localInQuote; continue; }
                     
                     if(!localInQuote) {
                         if(c==='{') {
                             if(localBalance===0) localStart = j;
                             localBalance++;
                         } else if(c==='}') {
                             localBalance--;
                             if(localBalance===0 && localStart !== -1) {
                                 // Found!
                                 const rawJson = buffer.substring(localStart, j+1);
                                 try {
                                     const p = JSON.parse(rawJson);
                                     const txt = p.candidates?.[0]?.content?.parts?.[0]?.text;
                                     if(txt) {
                                         accumulatedText += txt;
                                         yield txt;
                                     }
                                 } catch(e) {}
                                 
                                 buffer = buffer.substring(j+1); // Slice off
                                 loopAgain = true; // Restart scanning from new buffer start
                                 break; // Break for loop, re-enter while loop
                             }
                         }
                     }
                }
            }
        }
        
        return this.parseResponse(accumulatedText);
    }



    /**
     * Update settings
     */
    updateSettings(settings: GenerationSettings) {
        this.settings = settings;
    }
}
