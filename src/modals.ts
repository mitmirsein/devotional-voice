import { App, Modal, Setting } from 'obsidian';

export class ProcessingModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('voice-writing-processing-modal');

        contentEl.createEl('h2', { text: '✨ Processing Audio...' });
        
        const spinner = contentEl.createDiv({ cls: 'voice-writing-spinner' });
        spinner.createDiv({ cls: 'double-bounce1' });
        spinner.createDiv({ cls: 'double-bounce2' });

        contentEl.createEl('p', { text: 'Transcribing your voice...' });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class QuickOptionModal extends Modal {
    onSelect: (language: string, service: 'openai' | 'groq') => void;
    currentLanguage: string;
    currentService: 'openai' | 'groq';

    constructor(app: App, currentLanguage: string, currentService: 'openai' | 'groq', onSelect: (l: string, s: 'openai' | 'groq') => void) {
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
            .addDropdown(drop => drop
                .addOption('auto', 'Auto Detect')
                .addOption('en', 'English')
                .addOption('ko', 'Korean')
                .addOption('ja', 'Japanese')
                .setValue(tempLanguage)
                .onChange(value => tempLanguage = value)
            );

        new Setting(contentEl)
            .setName('Service')
            .setDesc('Transcription provider')
            .addDropdown(drop => drop
                .addOption('openai', 'OpenAI Whisper')
                .addOption('groq', 'Groq (Fast)')
                .setValue(tempService)
                .onChange(value => tempService = value as 'openai' | 'groq')
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
