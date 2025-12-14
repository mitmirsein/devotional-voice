import { App, Modal, Setting } from 'obsidian';
import { ServiceProvider, SUPPORTED_LANGUAGES } from './constants';

export class RecordingModal extends Modal {
    private timerEl: HTMLElement;
    private startTime: number;
    private timerInterval: number;
    private onStop: () => void;

    constructor(app: App, onStop: () => void) {
        super(app);
        this.onStop = onStop;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('voice-writing-recording-modal');

        // Main Container clearly indicating recording state
        const container = contentEl.createDiv({ cls: 'recording-container' });
        
        // Icon with pulse animation
        const iconWrapper = container.createDiv({ cls: 'recording-icon-wrapper' });
        iconWrapper.createDiv({ cls: 'recording-pulse-ring' });
        iconWrapper.createEl('span', { text: '🎙️', cls: 'recording-icon' });

        // Text
        container.createEl('h2', { text: 'Recording in Progress...' });
        
        // Timer
        this.timerEl = container.createDiv({ cls: 'recording-timer', text: '00:00' });
        this.startTime = Date.now();
        this.timerInterval = window.setInterval(() => this.updateTimer(), 1000);

        // Stop Button
        const btnContainer = container.createDiv({ cls: 'recording-controls' });
        const stopBtn = btnContainer.createEl('button', { 
            text: 'Stop Recording', 
            cls: 'mod-cta stop-recording-btn' 
        });
        stopBtn.onclick = () => {
            this.onStop();
            this.close();
        };

        // Click outside to close (optional, but better to keep it focused)
        // this.modalEl.addClass('modal-persistent'); // If we want to prevent closing by clicking background
    }

    updateTimer() {
        if (!this.timerEl) return;
        const diff = Math.floor((Date.now() - this.startTime) / 1000);
        const mins = Math.floor(diff / 60).toString().padStart(2, '0');
        const secs = (diff % 60).toString().padStart(2, '0');
        this.timerEl.setText(`${mins}:${secs}`);
    }

    onClose() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.contentEl.empty();
    }
}

export class ProcessingModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('voice-writing-processing-modal');

        const container = contentEl.createDiv({ cls: 'processing-container' });

        // Improved Spinner
        const spinner = container.createDiv({ cls: 'voice-writing-spinner' });
        spinner.createDiv({ cls: 'double-bounce1' });
        spinner.createDiv({ cls: 'double-bounce2' });

        container.createEl('h2', { text: '✨ Transcribing...' });
        container.createEl('p', { text: 'Sending audio to AI for text conversion.' });
        container.createEl('small', { text: 'This usually takes a few seconds.', cls: 'processing-hint' });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class QuickOptionModal extends Modal {
    onSelect: (language: string, service: ServiceProvider) => void;
    currentLanguage: string;
    currentService: ServiceProvider;

    constructor(app: App, currentLanguage: string, currentService: ServiceProvider, onSelect: (l: string, s: ServiceProvider) => void) {
        super(app);
        this.currentLanguage = currentLanguage;
        this.currentService = currentService;
        this.onSelect = onSelect;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Voice Writing Options' });

        let tempLanguage = this.currentLanguage;
        let tempService = this.currentService;

        new Setting(contentEl)
            .setName('Language')
            .setDesc('Select audio language')
            .addDropdown(drop => {
                SUPPORTED_LANGUAGES.forEach(lang => {
                    drop.addOption(lang.code, lang.name);
                });
                drop.setValue(tempLanguage)
                    .onChange(value => tempLanguage = value);
            });

        new Setting(contentEl)
            .setName('Service')
            .setDesc('Transcription provider')
            .addDropdown(drop => drop
                .addOption('openai', 'OpenAI Whisper')
                .addOption('groq', 'Groq (Fast)')
                .setValue(tempService)
                .onChange(value => tempService = value as ServiceProvider)
            );

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Apply')
                .setCta()
                .onClick(() => {
                    this.onSelect(tempLanguage, tempService);
                    this.close();
                })
            );
    }

    onClose() {
        this.contentEl.empty();
    }
}
