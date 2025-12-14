import { requestUrl, RequestUrlParam, Notice } from 'obsidian';

export interface TranscriptionResult {
    text: string;
}

export class TranscriptionService {
    async transcribe(audioBlob: Blob, apiKey: string, language: string, serviceProvider: 'openai' | 'groq'): Promise<TranscriptionResult> {
        if (!apiKey) {
            new Notice('API Key is missing. Please set it in settings.');
            throw new Error('API Key missing');
        }

        const arrayBuffer = await audioBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Boundary for multipart/form-data
        const boundary = '----ObsidianVoiceWritingBoundary' + Date.now();
        const body = await this.createFormData(buffer, 'recording.webm', boundary, language, serviceProvider);

        const url = serviceProvider === 'openai' 
            ? 'https://api.openai.com/v1/audio/transcriptions'
            : 'https://api.groq.com/openai/v1/audio/transcriptions';

        const model = serviceProvider === 'openai' ? 'whisper-1' : 'whisper-large-v3';

        const params: RequestUrlParam = {
            url: url,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Authorization': `Bearer ${apiKey}`
            },
            body: body
        };

        try {
            const response = await requestUrl(params);
            
            if (response.status !== 200) {
                console.error('Transcription failed:', response.json);
                throw new Error(`Transcription failed: ${response.status}`);
            }

            return { text: response.json.text };
        } catch (error) {
            console.error('Transcription error:', error);
            new Notice('Transcription failed. Check console for details.');
            throw error;
        }
    }

    private async createFormData(fileBuffer: Buffer, fileName: string, boundary: string, language: string, provider: 'openai' | 'groq'): Promise<ArrayBuffer> {
        const parts: Buffer[] = [];
        const model = provider === 'openai' ? 'whisper-1' : 'whisper-large-v3';

        // File part
        parts.push(Buffer.from(`--${boundary}\r\n`));
        parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`));
        parts.push(Buffer.from(`Content-Type: audio/webm\r\n\r\n`));
        parts.push(fileBuffer);
        parts.push(Buffer.from(`\r\n`));

        // Model part
        parts.push(Buffer.from(`--${boundary}\r\n`));
        parts.push(Buffer.from(`Content-Disposition: form-data; name="model"\r\n\r\n`));
        parts.push(Buffer.from(`${model}\r\n`));

        // Language part
        if (language && language !== 'auto') {
            parts.push(Buffer.from(`--${boundary}\r\n`));
            parts.push(Buffer.from(`Content-Disposition: form-data; name="language"\r\n\r\n`));
            parts.push(Buffer.from(`${language}\r\n`));
        }

        // End boundary
        parts.push(Buffer.from(`--${boundary}--\r\n`));

        return Buffer.concat(parts).buffer;
    }
}
