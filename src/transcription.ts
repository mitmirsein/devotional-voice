import { requestUrl, RequestUrlParam, Notice } from 'obsidian';
import {
    ServiceProvider,
    MODELS,
    API_ENDPOINTS,
    API_TEST_ENDPOINTS,
    API_CONFIG,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    API_TEST_ERRORS
} from './constants';

export interface ApiTestResult {
    success: boolean;
    message: string;
    details?: string;
}

export interface TranscriptionResult {
    text: string;
}

export interface TranscriptionError {
    status?: number;
    message: string;
    details?: string;
}

export class TranscriptionService {
    /**
     * Test API key validity by calling the models endpoint
     */
    async testApiKey(apiKey: string, serviceProvider: ServiceProvider): Promise<ApiTestResult> {
        if (!apiKey || apiKey.trim().length === 0) {
            return {
                success: false,
                message: API_TEST_ERRORS.INVALID_KEY,
                details: 'API key is empty'
            };
        }

        const url = API_TEST_ENDPOINTS[serviceProvider];

        const params: RequestUrlParam = {
            url: url,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`
            },
            throw: false
        };

        try {
            const response = await requestUrl(params);

            console.log(`API Test Response (${serviceProvider}):`, {
                status: response.status,
                data: response.json
            });

            if (response.status === 200) {
                return {
                    success: true,
                    message: SUCCESS_MESSAGES.API_KEY_VALID,
                    details: `Connected to ${serviceProvider.toUpperCase()} API successfully`
                };
            } else if (response.status === 401) {
                return {
                    success: false,
                    message: API_TEST_ERRORS.INVALID_KEY,
                    details: response.json?.error?.message || 'Authentication failed'
                };
            } else if (response.status === 429) {
                return {
                    success: false,
                    message: API_TEST_ERRORS.QUOTA_EXCEEDED,
                    details: 'Rate limit or quota exceeded'
                };
            } else {
                return {
                    success: false,
                    message: API_TEST_ERRORS.UNKNOWN_ERROR,
                    details: `HTTP ${response.status}: ${JSON.stringify(response.json)}`
                };
            }
        } catch (error) {
            console.error('API Test Error:', error);
            return {
                success: false,
                message: API_TEST_ERRORS.NETWORK_ERROR,
                details: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async transcribe(
        audioBlob: Blob,
        apiKey: string,
        language: string,
        serviceProvider: ServiceProvider,
        fileName?: string,  // Optional: for uploaded files
        mimeType?: string   // Optional: for uploaded files
    ): Promise<TranscriptionResult> {
        // Validate API key
        if (!apiKey) {
            new Notice(ERROR_MESSAGES.API_KEY_MISSING);
            throw new Error('API Key missing');
        }

        // Basic API key format validation
        if (!this.isValidApiKeyFormat(apiKey, serviceProvider)) {
            new Notice(ERROR_MESSAGES.API_KEY_INVALID_FORMAT(serviceProvider));
            throw new Error('Invalid API key format');
        }

        if (serviceProvider === 'gemini') {
            return await this.transcribeWithGemini(audioBlob, apiKey, language);
        }

        const arrayBuffer = await audioBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Use provided filename/mimeType or defaults for recordings
        const actualFileName = fileName || 'recording.webm';
        const actualMimeType = mimeType || audioBlob.type || API_CONFIG.AUDIO_MIME_TYPE;

        // Boundary for multipart/form-data
        const boundary = '----ObsidianVoiceWritingBoundary' + Date.now();
        const body = await this.createFormData(buffer, actualFileName, actualMimeType, boundary, language, serviceProvider);

        const url = API_ENDPOINTS[serviceProvider];

        const params: RequestUrlParam = {
            url: url,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Authorization': `Bearer ${apiKey}`
            },
            body: body,
            throw: false // Don't throw on non-2xx responses
        };

        try {
            // Create timeout promise
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error('TIMEOUT'));
                }, API_CONFIG.TIMEOUT_MS);
            });

            // Race between request and timeout
            const response = await Promise.race([
                requestUrl(params),
                timeoutPromise
            ]);

            if (response.status !== 200) {
                console.error('Transcription failed:', response.json);
                if (response.status === 401) {
                    throw new Error('API_UNAUTHORIZED'); // Will be caught and mapped
                }
                if (response.status === 429) {
                    throw new Error('API_QUOTA_EXCEEDED');
                }
                throw new Error(`Transcription failed: ${response.status}`);
            }

            return { text: response.json.text };
        } catch (error) {
            if (error instanceof Error && error.message === 'TIMEOUT') {
                console.error('Transcription timeout after', API_CONFIG.TIMEOUT_MS, 'ms');
                new Notice(ERROR_MESSAGES.TRANSCRIPTION_TIMEOUT);
                throw new Error('Transcription timeout');
            }

            console.error('Transcription error:', error);
            new Notice(ERROR_MESSAGES.TRANSCRIPTION_FAILED);
            throw error;
        }
    }

    private async transcribeWithGemini(audioBlob: Blob, apiKey: string, language: string): Promise<TranscriptionResult> {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString('base64');
        
        const cleanApiKey = apiKey.trim();
        let model = MODELS['gemini'] || 'gemini-1.5-flash';
        
        // Ensure model name doesn't have doubling prefix
        if (model.startsWith('models/')) {
            model = model.replace('models/', '');
        }

        // Use v1beta for widest feature support, but ensure the path is correct
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanApiKey}`;

        const prompt = language && language !== 'auto' 
            ? `Please transcribe this audio. The language is ${language}. Output only the transcription text without any preamble.`
            : "Please transcribe this audio accurately. Output only the transcription text without any preamble.";

        const body = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: audioBlob.type || "audio/webm",
                            data: base64Audio
                        }
                    }
                ]
            }]
        };

        try {
            const response = await requestUrl({
                url: url,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.status !== 200) {
                console.error(`[DevotionalVoice] Gemini API Error (${response.status}):`, response.json || response.text);
                throw new Error(`Gemini STT Failed: ${response.status}`);
            }

            const text = response.json.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return { text: text.trim() };
        } catch (error) {
            console.error('[DevotionalVoice] Gemini Transcription error:', error);
            if (error instanceof Error && error.message.includes('404')) {
                throw new Error('Gemini API 404: Endpoint not found. Please check model settings.');
            }
            throw error;
        }
    }

    private isValidApiKeyFormat(apiKey: string, provider: ServiceProvider): boolean {
        // Basic validation - check if key has reasonable format
        const trimmedKey = apiKey.trim();

        if (provider === 'openai') {
            // OpenAI keys start with 'sk-' and are reasonably long
            return trimmedKey.startsWith('sk-') && trimmedKey.length > 20;
        } else if (provider === 'groq') {
            return trimmedKey.length > 20 && !/\s/.test(trimmedKey);
        } else if (provider === 'gemini') {
            return trimmedKey.startsWith('AIza') && trimmedKey.length > 30;
        }
        return trimmedKey.length > 10;
    }

    private parseErrorResponse(response: any): TranscriptionError {
        try {
            const json = response.json;
            // Handle different error formats for different providers
            const message = json?.error?.message || json?.error || 'Unknown Error';
            return {
                status: response.status,
                message: message,
                details: JSON.stringify(json)
            };
        } catch {
            return {
                status: response.status,
                message: `HTTP ${response.status} Error`,
                details: 'Could not parse error response'
            };
        }
    }

    private async createFormData(
        fileBuffer: Buffer,
        fileName: string,
        mimeType: string,
        boundary: string,
        language: string,
        provider: ServiceProvider
    ): Promise<ArrayBuffer> {
        const parts: Buffer[] = [];
        const model = MODELS[provider];

        // File part - use provided mimeType
        parts.push(Buffer.from(`--${boundary}\r\n`));
        parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`));
        parts.push(Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`));
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
