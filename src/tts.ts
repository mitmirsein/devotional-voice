import { requestUrl, Notice } from 'obsidian';

export interface TTSSettings {
    provider: 'google' | 'openai' | 'gemini';
    googleApiKey: string; // Used for Gemini
    openaiApiKey: string;
    elevenlabsApiKey: string;
    voiceId: string;
    geminiModel?: string; // e.g. gemini-2.5-flash-preview-tts
    language: string;
}

/**
 * TTS Service for converting text to speech
 */
export class TTSService {
    private settings: TTSSettings;
    private currentAudio: HTMLAudioElement | null = null;

    constructor(settings: TTSSettings) {
        this.settings = settings;
    }

    async speak(text: string): Promise<void> {
        this.stop();

        if (this.settings.provider === 'google') {
            if ('speechSynthesis' in window) {
                this.speakWithWebSpeech(text);
            } else {
                new Notice('TTS not supported');
            }
            return;
        }

        const audioBuffer = await this.generateAudio(text);
        if (audioBuffer) {
            await this.playAudioBuffer(audioBuffer);
        }
    }

    async generateAudio(text: string): Promise<ArrayBuffer | null> {
        if (this.settings.provider === 'openai') {
            return await this.generateOpenAIAudio(text);
        } else if (this.settings.provider === 'gemini') {
            return await this.generateGeminiAudio(text);
        }
        return null;
    }

    stop(): void {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
    }

    private speakWithWebSpeech(text: string) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.settings.language || 'ko-KR';
        utterance.rate = 1.0;
        const voices = speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.startsWith(this.settings.language.substring(0, 2)));
        if (voice) utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
    }

    private async generateOpenAIAudio(text: string): Promise<ArrayBuffer | null> {
        if (!this.settings.openaiApiKey) {
            new Notice('OpenAI API Key가 설정되지 않았습니다.');
            return null;
        }
        try {
            const response = await requestUrl({
                url: 'https://api.openai.com/v1/audio/speech',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.openaiApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'tts-1',
                    input: text,
                    voice: this.settings.voiceId || 'nova',
                    response_format: 'mp3'
                })
            });
            if (response.status !== 200) throw new Error(`OpenAI TTS Error: ${response.status}`);
            return response.arrayBuffer;
        } catch (error) {
            console.error('[DevotionalVoice] OpenAI TTS failed:', error);
            new Notice(`OpenAI TTS 실패: ${(error as Error).message}`);
            return null;
        }
    }

    private async generateGeminiAudio(text: string): Promise<ArrayBuffer | null> {
        if (!this.settings.googleApiKey) {
            new Notice('Gemini API Key가 설정되지 않았습니다.');
            return null;
        }

        try {
            let model = this.settings.geminiModel || 'gemini-2.5-flash-preview-tts';
            if (model.startsWith('models/')) model = model.replace('models/', '');

            const voiceName = this.settings.voiceId || 'Kore';
            const response = await requestUrl({
                url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.settings.googleApiKey}`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: text }] }],
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: voiceName }
                            }
                        }
                    }
                })
            });

            if (response.status !== 200) {
                console.error('[DevotionalVoice] Gemini API Error:', response.text);
                throw new Error(`Gemini API Error: ${response.status}`);
            }

            const data = response.json;
            if (!data.candidates?.[0]?.content?.parts) {
                throw new Error('Invalid Gemini response format');
            }

            const parts = data.candidates[0].content.parts;
            for (const part of parts) {
                if (part.inlineData?.mimeType?.startsWith('audio/')) {
                    const base64Data = part.inlineData.data;
                    const mimeType = part.inlineData.mimeType;

                    // Decode base64 to raw bytes
                    const binaryString = window.atob(base64Data);
                    const rawBytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        rawBytes[i] = binaryString.charCodeAt(i);
                    }

                    // Convert raw PCM to WAV if necessary
                    const wavBuffer = this.convertToWav(rawBytes, mimeType);
                    return wavBuffer;
                }
            }

            new Notice('Gemini TTS: 오디오 데이터를 찾을 수 없습니다.');
            return null;

        } catch (error) {
            console.error('[DevotionalVoice] Gemini TTS failed:', error);
            new Notice(`Gemini TTS 실패: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Convert raw PCM audio data to WAV format
     */
    private convertToWav(audioData: Uint8Array, mimeType: string): ArrayBuffer {
        const params = this.parseAudioMimeType(mimeType);
        const bitsPerSample = params.bitsPerSample;
        const sampleRate = params.rate;
        const numChannels = 1;
        const dataSize = audioData.length;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const chunkSize = 36 + dataSize;

        // Create WAV header (44 bytes)
        const header = new ArrayBuffer(44);
        const view = new DataView(header);

        // RIFF header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, chunkSize, true);
        this.writeString(view, 8, 'WAVE');

        // fmt subchunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
        view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);

        // data subchunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        // Combine header and audio data
        const wavBuffer = new ArrayBuffer(44 + dataSize);
        const wavView = new Uint8Array(wavBuffer);
        wavView.set(new Uint8Array(header), 0);
        wavView.set(audioData, 44);

        return wavBuffer;
    }

    private writeString(view: DataView, offset: number, str: string) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    private parseAudioMimeType(mimeType: string): { bitsPerSample: number; rate: number } {
        let bitsPerSample = 16;
        let rate = 24000;

        const parts = mimeType.split(';');
        for (const param of parts) {
            const trimmed = param.trim();
            if (trimmed.toLowerCase().startsWith('rate=')) {
                try {
                    rate = parseInt(trimmed.split('=')[1], 10);
                } catch { }
            } else if (trimmed.startsWith('audio/L')) {
                try {
                    bitsPerSample = parseInt(trimmed.split('L')[1], 10);
                } catch { }
            }
        }

        return { bitsPerSample, rate };
    }

    private async playAudioBuffer(arrayBuffer: ArrayBuffer): Promise<void> {
        try {
            const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);

            const audio = new Audio(url);
            this.currentAudio = audio;

            audio.onended = () => {
                URL.revokeObjectURL(url);
                this.currentAudio = null;
            };

            audio.onerror = (e) => {
                console.error('[DevotionalVoice] Audio playback error:', e);
                new Notice('오디오 재생 실패');
                URL.revokeObjectURL(url);
                this.currentAudio = null;
            };

            await audio.play();

        } catch (e) {
            console.error('[DevotionalVoice] Audio playback failed:', e);
            new Notice('오디오 재생 실패');
        }
    }

    updateSettings(settings: TTSSettings) {
        this.settings = settings;
    }
}
