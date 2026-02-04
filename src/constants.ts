/**
 * Voice Writing Plugin Constants
 * Centralized configuration for models, timeouts, and supported languages
 */

// Service Provider Types
export type ServiceProvider = 'openai' | 'groq' | 'gemini';

// Model configuration per provider
export const MODELS: Record<ServiceProvider, string> = {
    openai: 'whisper-1',
    groq: 'whisper-large-v3',
    gemini: 'gemini-1.5-flash-latest'
} as const;

// API Endpoints
export const API_ENDPOINTS: Record<ServiceProvider, string> = {
    openai: 'https://api.openai.com/v1/audio/transcriptions',
    groq: 'https://api.groq.com/openai/v1/audio/transcriptions',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/models'
} as const;

// API Test Endpoints (for validating API keys)
export const API_TEST_ENDPOINTS: Record<ServiceProvider, string> = {
    openai: 'https://api.openai.com/v1/models',
    groq: 'https://api.groq.com/openai/v1/audio/transcriptions', // Use transcription endpoint for groq test or similar
    gemini: 'https://generativelanguage.googleapis.com/v1beta/models'
} as const;

// API Request Configuration
export const API_CONFIG = {
    TIMEOUT_MS: 600000, // 10 minutes (increased for long recordings)
    MAX_FILE_SIZE_MB: 25,
    AUDIO_MIME_TYPE: 'audio/webm'
} as const;

// Supported Languages with display names
export const SUPPORTED_LANGUAGES = [
    { code: 'auto', name: 'Auto Detect' },
    { code: 'en', name: 'English' },
    { code: 'ko', name: 'Korean (한국어)' },
    { code: 'ja', name: 'Japanese (日本語)' },
    { code: 'zh', name: 'Chinese (中文)' },
    { code: 'es', name: 'Spanish (Español)' },
    { code: 'fr', name: 'French (Français)' },
    { code: 'de', name: 'German (Deutsch)' }
] as const;

// Error Messages
export const ERROR_MESSAGES = {
    API_KEY_MISSING: 'API Key is missing. Please set it in settings.',
    API_KEY_INVALID_FORMAT: (provider: ServiceProvider) =>
        `Invalid API key format for ${provider}. Please check your API key.`,
    TRANSCRIPTION_FAILED: 'Transcription failed. Check console for details.',
    TRANSCRIPTION_TIMEOUT: 'Transcription timed out. Please try again.',
    MICROPHONE_PERMISSION_DENIED: 'Microphone access denied. Please allow microphone access in your browser/system settings.',
    MICROPHONE_NOT_FOUND: 'No microphone found. Please connect a microphone and try again.',
    MICROPHONE_GENERAL_ERROR: 'Failed to access microphone. Please check your audio settings.',
    NO_ACTIVE_RECORDING: 'No active recording to stop.',
    API_UNAUTHORIZED: 'Incorrect API Key (401). Please check your settings.',
    API_QUOTA_EXCEEDED: 'API Quota Exceeded (429). Please check your plan.'
} as const;

// Success Messages (Emoji-free for Obsidian Community Plugin compatibility)
export const SUCCESS_MESSAGES = {
    RECORDING_STARTED: 'Recording started...',
    TRANSCRIPTION_COMPLETE: 'Transcription complete!',
    SETTINGS_SAVED: (service: string, lang: string) => `Settings saved: ${service} / ${lang}`,
    QUICK_SETTINGS_SAVED: (service: string, lang: string, diarization: boolean) =>
        `Settings: ${service} / ${lang}${diarization ? ' / Speaker Diarization ON' : ''}`,
    COPIED_TO_CLIPBOARD: 'Text copied to clipboard (No active editor)',
    API_KEY_VALID: 'API key is valid!',
    API_KEY_TEST_START: 'Testing API key...'
} as const;

// Speaker Diarization Note (English only, no emoji)
export const DIARIZATION_NOTE = {
    INFO: 'Speaker diarization is not natively supported by OpenAI/Groq Whisper API. Coming in future updates.',
    LABEL: 'Speaker Diarization (Experimental)'
} as const;

// API Test Error Messages (Emoji-free for Obsidian Community Plugin compatibility)
export const API_TEST_ERRORS = {
    INVALID_KEY: 'Invalid API Key. Please check and try again.',
    QUOTA_EXCEEDED: 'API Quota exceeded. Check your billing.',
    NETWORK_ERROR: 'Network error. Check your internet connection.',
    UNKNOWN_ERROR: 'Test failed. Check console for details.'
} as const;

// Supported Audio Formats for Upload
export const SUPPORTED_AUDIO_FORMATS = [
    'mp3', 'wav', 'webm', 'm4a', 'ogg', 'flac', 'mp4', 'mpeg', 'mpga'
] as const;

export const AUDIO_MIME_TYPES: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    webm: 'audio/webm',
    m4a: 'audio/m4a',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    mp4: 'audio/mp4',
    mpeg: 'audio/mpeg',
    mpga: 'audio/mpeg'
} as const;

// Built-in Formatting Templates
export type TemplateId = 'none' | 'meeting' | 'lecture' | 'idea' | 'interview' | 'custom';

export interface FormattingTemplate {
    id: TemplateId | string;
    name: string;
    nameKo: string;
    description: string;
    prompt: string;
    isBuiltIn: boolean;
}

export const BUILT_IN_TEMPLATES: readonly FormattingTemplate[] = [
    {
        id: 'none',
        name: 'None (Raw Transcript)',
        nameKo: '없음 (원본 텍스트)',
        description: 'Keep the original transcription without formatting',
        prompt: '',
        isBuiltIn: true
    }
] as const;

// Template Messages (Emoji-free for Obsidian Community Plugin compatibility)
export const TEMPLATE_MESSAGES = {
    SELECT_TEMPLATE: 'Select a template to format the transcription',
    FORMATTING: 'Formatting with template...',
    FORMAT_COMPLETE: 'Formatting complete!',
    FORMAT_FAILED: 'Formatting failed. Original text preserved.',
    CUSTOM_TEMPLATE_SAVED: 'Custom template saved!',
    CUSTOM_TEMPLATE_DELETED: 'Template deleted.',
    FILE_UPLOAD_SUCCESS: 'File uploaded and transcribed!',
    FILE_TOO_LARGE: 'File too large. Maximum size is 25MB.',
    INVALID_FILE_TYPE: 'Invalid file type. Supported: mp3, wav, m4a, webm, ogg, flac'
} as const;
