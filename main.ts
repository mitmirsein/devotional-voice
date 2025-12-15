import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, requestUrl, moment } from 'obsidian';
import { MicrophoneRecorder, RecordingError } from './src/recorder';
import { TranscriptionService } from './src/transcription';
import { RAGService, RAGSettings, SearchResult } from './src/rag';
import { GenerationService, GenerationSettings } from './src/generation';
import { TTSService, TTSSettings } from './src/tts';
import { RecordingModal, ProcessingModal } from './src/modals';
import {
	ServiceProvider,
	SUCCESS_MESSAGES,
	ERROR_MESSAGES
} from './src/constants';

interface DevotionalVoiceSettings {
	openaiApiKey: string;
	groqApiKey: string;
	language: string;
	serviceProvider: ServiceProvider;
	whitelistFolders: string;
	ragMaxResults: number;
	geminiApiKey: string;
	geminiModel: string;
	devotionalTemplate: string;
	ttsEnabled: boolean;
	ttsProvider: 'google' | 'openai' | 'gemini';
	ttsOpenAiVoice: string;
	ttsGeminiModel: string;
	ttsGeminiVoice: string;
	ttsLanguage: string;
}

const DEFAULT_SETTINGS: DevotionalVoiceSettings = {
	openaiApiKey: '',
	groqApiKey: '',
	language: 'ko',
	serviceProvider: 'groq',
	whitelistFolders: '',
	ragMaxResults: 5,
	geminiApiKey: '',
	geminiModel: 'gemini-2.0-flash',
	devotionalTemplate: '',
	ttsEnabled: true,
	ttsProvider: 'gemini', // Default to gemini
	ttsOpenAiVoice: 'nova',
	ttsGeminiModel: 'gemini-2.5-flash-preview-tts',
	ttsGeminiVoice: 'Kore',
	ttsLanguage: 'ko-KR'
}

export default class DevotionalVoicePlugin extends Plugin {
	settings: DevotionalVoiceSettings;
	recorder: MicrophoneRecorder;
	transcriptionService: TranscriptionService;
	ragService: RAGService;
	generationService: GenerationService;
	ttsService: TTSService;
	statusBarItem: HTMLElement;
	ribbonIconEl: HTMLElement;
	recordingModal: RecordingModal | null = null;

	async onload() {
		console.log('[DevotionalVoice] Loading plugin...');
		await this.loadSettings();

		this.recorder = new MicrophoneRecorder();
		this.transcriptionService = new TranscriptionService();
		this.ragService = new RAGService(this.app, this.getRAGSettings());
		this.generationService = new GenerationService(this.getGenerationSettings());
		this.ttsService = new TTSService(this.getTTSSettings());

		this.ribbonIconEl = this.addRibbonIcon('book-open', 'Devotional Voice', (evt: MouseEvent) => {
			this.showInputModeSelection();
		});
		this.ribbonIconEl.addClass('devotional-voice-ribbon');

		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar('Ready');

		this.addCommand({
			id: 'devotional-from-voice',
			name: 'From Voice: 음성으로 묵상 시작',
			callback: () => this.startVoiceDevotional()
		});
		this.addCommand({
			id: 'devotional-from-selection',
			name: 'From Selection: 선택 텍스트로 묵상',
			editorCallback: (editor: Editor) => this.startSelectionDevotional(editor)
		});
		this.addCommand({
			id: 'devotional-from-note',
			name: 'From Current Note: 현재 노트로 묵상',
			callback: () => this.startNoteDevotional()
		});
		this.addCommand({
			id: 'devotional-read-aloud',
			name: 'Read Aloud: TTS 재생',
			editorCallback: (editor: Editor) => this.readAloud(editor)
		});
		this.addCommand({
			id: 'devotional-stop-tts',
			name: 'Stop TTS: 재생 중지',
			callback: () => this.ttsService.stop()
		});

		this.addCommand({
			id: 'devotional-save-audio',
			name: 'Save Audio: TTS 대본 오디오 저장',
			editorCallback: (editor: Editor) => this.saveAudioToNote(editor)
		});

		this.addSettingTab(new DevotionalVoiceSettingTab(this.app, this));
		console.log('[DevotionalVoice] Plugin loaded successfully.');
	}

	private getRAGSettings(): RAGSettings {
		return {
			whitelistFolders: this.settings.whitelistFolders.split(',').map(f => f.trim()).filter(f => f.length > 0),
			maxResults: this.settings.ragMaxResults
		};
	}

	private getGenerationSettings(): GenerationSettings {
		return {
			geminiApiKey: this.settings.geminiApiKey,
			geminiModel: this.settings.geminiModel,
			devotionalTemplate: this.settings.devotionalTemplate
		};
	}

	private getTTSSettings(): TTSSettings {
		return {
			provider: this.settings.ttsProvider,
			googleApiKey: this.settings.geminiApiKey,
			openaiApiKey: this.settings.openaiApiKey,
			elevenlabsApiKey: '',
			voiceId: this.settings.ttsProvider === 'openai' ? this.settings.ttsOpenAiVoice : this.settings.ttsGeminiVoice,
			geminiModel: this.settings.ttsGeminiModel,
			language: this.settings.ttsLanguage
		};
	}

	private showInputModeSelection() {
		new InputModeModal(this.app, (mode) => {
			switch (mode) {
				case 'voice': this.startVoiceDevotional(); break;
				case 'selection':
					const view = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (view) { this.startSelectionDevotional(view.editor); }
					else { new Notice('텍스트를 선택할 수 있는 노트를 열어주세요.'); }
					break;
				case 'note': this.startNoteDevotional(); break;
			}
		}).open();
	}

	async startVoiceDevotional() {
		try {
			await this.recorder.startRecording();
			new Notice('🎤 녹음 시작...');
			this.updateStatusBar('Recording...');
			this.recordingModal = new RecordingModal(this.app, () => this.stopVoiceRecording());
			this.recordingModal.open();
		} catch (error) {
			console.error('[DevotionalVoice] startVoiceDevotional error:', error);
			new Notice((error as RecordingError)?.message || ERROR_MESSAGES.MICROPHONE_GENERAL_ERROR);
		}
	}

	private async stopVoiceRecording() {
		if (this.recordingModal) { this.recordingModal.close(); this.recordingModal = null; }
		try {
			const blob = await this.recorder.stopRecording();
			this.updateStatusBar('Transcribing...');
			new Notice('📝 음성 변환 중...');
			const apiKey = this.settings.serviceProvider === 'openai' ? this.settings.openaiApiKey : this.settings.groqApiKey;
			const result = await this.transcriptionService.transcribe(blob, apiKey, this.settings.language, this.settings.serviceProvider);
			await this.processDevotional(result.text);
		} catch (error) {
			console.error('[DevotionalVoice] stopVoiceRecording error:', error);
			new Notice('음성 변환 실패');
			this.updateStatusBar('Error');
		}
	}

	async startSelectionDevotional(editor: Editor) {
		const selectedText = editor.getSelection();
		if (!selectedText || selectedText.trim().length === 0) { new Notice('묵상할 텍스트를 선택해주세요.'); return; }
		await this.processDevotional(selectedText);
	}

	async startNoteDevotional() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) { new Notice('열린 노트가 없습니다.'); return; }
		const content = await this.app.vault.read(activeFile);
		if (!content || content.trim().length === 0) { new Notice('노트가 비어있습니다.'); return; }
		await this.processDevotional(content);
	}

	private async processDevotional(userInput: string) {
		console.log('[DevotionalVoice] processDevotional started.');
		this.updateStatusBar('Processing...');
		try {
			new Notice('🔍 관련 노트 검색 중...');
			const ragResults = await this.ragService.search(userInput, this.settings.ragMaxResults);
			console.log(`[DevotionalVoice] RAG found ${ragResults.length} results.`);

			new Notice('✨ 묵상글 생성 중...');
			const result = await this.generationService.generate(userInput, ragResults);
			console.log('[DevotionalVoice] Generation complete.');

			const { markdown: devotionalText, ttsScript } = result;

			// Insert into note
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const timestamp = new Date().toLocaleString('ko-KR');
				let referenceSection = '';
				if (ragResults.length > 0) {
					referenceSection = '\n\n### 📚 참조 노트\n';
					ragResults.forEach(r => { referenceSection += `- [[${r.file.basename}]]\n`; });
				}
				// Embed TTS script as hidden comment for later manual playback
				const ttsBlock = ttsScript ? `\n\n%%TTS-SCRIPT:${ttsScript}%%` : '';
				const formattedContent = `\n\n---\n## 📖 묵상 (${timestamp})\n\n${devotionalText}${referenceSection}${ttsBlock}\n`;
				activeView.editor.replaceRange(formattedContent, activeView.editor.getCursor());
				new Notice('✅ 묵상글이 생성되었습니다!');

				// Prompt user for manual TTS playback
				if (this.settings.ttsEnabled && ttsScript) {
					setTimeout(() => {
						new Notice('🔊 TTS 재생: Cmd+P → "Read Aloud"', 5000);
					}, 1500);
				}
			}
			this.updateStatusBar('Ready');
		} catch (error) {
			console.error('[DevotionalVoice] processDevotional FAILED:', error);
			new Notice(`묵상글 생성 실패: ${(error as Error).message}`);
			this.updateStatusBar('Error');
		}
	}

	async readAloud(editor: Editor) {
		const selectedText = editor.getSelection();
		if (selectedText && selectedText.trim().length > 0) {
			new Notice('🔊 선택 텍스트 재생 중...');
			await this.ttsService.speak(selectedText);
			return;
		}
		const content = editor.getValue();
		const ttsMatch = content.match(/%%TTS-SCRIPT:(.*?)%%/s);
		if (ttsMatch && ttsMatch[1]) {
			new Notice('🔊 묵상 대본 재생 중...');
			await this.ttsService.speak(ttsMatch[1].trim());
			return;
		}
		new Notice('읽을 텍스트를 선택하거나 생성된 묵상글이 필요합니다.');
	}

	/**
	 * Save TTS audio file to the same folder as the active note
	 */
	async saveAudioToNote(editor: Editor) {
		const content = editor.getValue();
		const ttsMatch = content.match(/%%TTS-SCRIPT:(.*?)%%/s);
		if (!ttsMatch || !ttsMatch[1]) {
			new Notice('TTS 대본이 없습니다. 묵상글을 먼저 생성해주세요.');
			return;
		}

		const ttsScript = ttsMatch[1].trim();
		new Notice('🔊 오디오 파일 생성 중...');

		const audioBuffer = await this.ttsService.generateAudio(ttsScript);
		if (!audioBuffer) {
			new Notice('오디오 생성 실패');
			return;
		}

		const activeFile = this.app.workspace.getActiveFile();
		let folderPath = '';
		if (activeFile && activeFile.parent) {
			folderPath = activeFile.parent.path;
		}

		const audioFileName = `Devotional_Audio_${moment().format('YYYYMMDD_HHmmss')}.wav`;
		const audioFilePath = folderPath ? `${folderPath}/${audioFileName}` : audioFileName;

		await this.app.vault.createBinary(audioFilePath, audioBuffer);

		// Append audio embed to the note
		const audioEmbed = `\n\n![[${audioFileName}]]`;
		const cursor = editor.getCursor('to');
		editor.replaceRange(audioEmbed, { line: cursor.line + 1, ch: 0 });

		new Notice(`💾 오디오 저장 완료: ${audioFileName}`);
	}

	updateStatusBar(text: string) { this.statusBarItem.setText(`📖 ${text}`); }
	onunload() { this.ttsService.stop(); console.log('[DevotionalVoice] Plugin unloaded.'); }
	async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
	async saveSettings() {
		await this.saveData(this.settings);
		this.ragService.updateSettings(this.getRAGSettings());
		this.generationService.updateSettings(this.getGenerationSettings());
		this.ttsService.updateSettings(this.getTTSSettings());
	}
}

class InputModeModal extends Modal {
	private onSelect: (mode: 'voice' | 'selection' | 'note') => void;
	constructor(app: App, onSelect: (mode: 'voice' | 'selection' | 'note') => void) { super(app); this.onSelect = onSelect; }
	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('devotional-input-modal');
		contentEl.createEl('h2', { text: '📖 묵상 입력 방식 선택' });
		const buttonContainer = contentEl.createDiv({ cls: 'input-mode-buttons' });
		const voiceBtn = buttonContainer.createEl('button', { text: '🎤 음성 녹음', cls: 'mod-cta' });
		voiceBtn.onclick = () => { this.close(); this.onSelect('voice'); };
		const selectionBtn = buttonContainer.createEl('button', { text: '📝 텍스트 선택' });
		selectionBtn.onclick = () => { this.close(); this.onSelect('selection'); };
		const noteBtn = buttonContainer.createEl('button', { text: '📂 현재 노트' });
		noteBtn.onclick = () => { this.close(); this.onSelect('note'); };
	}
	onClose() { this.contentEl.empty(); }
}

class DevotionalVoiceSettingTab extends PluginSettingTab {
	plugin: DevotionalVoicePlugin;
	constructor(app: App, plugin: DevotionalVoicePlugin) { super(app, plugin); this.plugin = plugin; }
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: '📖 Devotional Voice Settings' });

		containerEl.createEl('h3', { text: '🎤 음성 인식 (STT)' });
		new Setting(containerEl).setName('Service Provider').setDesc('OpenAI 또는 Groq').addDropdown(d => d.addOption('openai', 'OpenAI').addOption('groq', 'Groq').setValue(this.plugin.settings.serviceProvider).onChange(async v => { this.plugin.settings.serviceProvider = v as ServiceProvider; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName('OpenAI API Key').addText(t => t.setPlaceholder('sk-...').setValue(this.plugin.settings.openaiApiKey).onChange(async v => { this.plugin.settings.openaiApiKey = v; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName('Groq API Key').addText(t => t.setPlaceholder('gsk_...').setValue(this.plugin.settings.groqApiKey).onChange(async v => { this.plugin.settings.groqApiKey = v; await this.plugin.saveSettings(); }));

		containerEl.createEl('h3', { text: '🔍 RAG 검색' });
		new Setting(containerEl).setName('화이트리스트 폴더').addText(t => t.setPlaceholder('묵상일지/').setValue(this.plugin.settings.whitelistFolders).onChange(async v => { this.plugin.settings.whitelistFolders = v; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName('최대 검색 결과').addSlider(s => s.setLimits(1, 10, 1).setValue(this.plugin.settings.ragMaxResults).setDynamicTooltip().onChange(async v => { this.plugin.settings.ragMaxResults = v; await this.plugin.saveSettings(); }));

		containerEl.createEl('h3', { text: '✨ 묵상글 생성' });
		new Setting(containerEl).setName('Gemini API Key').setDesc('aistudio.google.com 에서 발급').addText(t => t.setPlaceholder('AIza...').setValue(this.plugin.settings.geminiApiKey).onChange(async v => { this.plugin.settings.geminiApiKey = v; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName('Gemini Model (생성)').addText(t => t.setPlaceholder('gemini-2.0-flash').setValue(this.plugin.settings.geminiModel).onChange(async v => { this.plugin.settings.geminiModel = v; await this.plugin.saveSettings(); }));
		const defaultPromptHint = '당신은 탁월한 영성을 지닌 신학자이자, 청중의 마음을 위로하는 설교자입니다.\n사용자의 묵상 내용과 관련 노트를 바탕으로, 깊이 있는 신학적 통찰과 따뜻한 목회적 적용이 담긴 묵상글을 작성해 주세요.\n반드시 JSON 형식({"markdown":"...", "ttsScript":"..."})으로 출력.\n\n언어: 한국어';
		new Setting(containerEl)
			.setName('Prompt Template')
			.setDesc('비워두면 기본 템플릿 사용. 수정 시 JSON 출력 형식 유지 필요.')
			.addTextArea(t => {
				t.inputEl.rows = 8;
				t.inputEl.cols = 50;
				t.setPlaceholder(defaultPromptHint)
					.setValue(this.plugin.settings.devotionalTemplate)
					.onChange(async v => { this.plugin.settings.devotionalTemplate = v; await this.plugin.saveSettings(); });
			});

		containerEl.createEl('h3', { text: '🔊 TTS 설정' });
		new Setting(containerEl).setName('TTS 활성화').addToggle(t => t.setValue(this.plugin.settings.ttsEnabled).onChange(async v => { this.plugin.settings.ttsEnabled = v; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName('TTS 제공자').addDropdown(d => d.addOption('google', 'Web Speech (무료)').addOption('openai', 'OpenAI TTS').addOption('gemini', 'Gemini TTS').setValue(this.plugin.settings.ttsProvider).onChange(async v => { this.plugin.settings.ttsProvider = v as DevotionalVoiceSettings['ttsProvider']; await this.plugin.saveSettings(); this.display(); }));

		if (this.plugin.settings.ttsProvider === 'openai') {
			new Setting(containerEl).setName('OpenAI Voice').addDropdown(d => d.addOption('alloy', 'Alloy').addOption('echo', 'Echo').addOption('nova', 'Nova').addOption('shimmer', 'Shimmer').setValue(this.plugin.settings.ttsOpenAiVoice).onChange(async v => { this.plugin.settings.ttsOpenAiVoice = v; await this.plugin.saveSettings(); }));
		} else if (this.plugin.settings.ttsProvider === 'gemini') {
			new Setting(containerEl).setName('Gemini TTS Model').addText(t => t.setPlaceholder('gemini-2.5-flash-preview-tts').setValue(this.plugin.settings.ttsGeminiModel).onChange(async v => { this.plugin.settings.ttsGeminiModel = v; await this.plugin.saveSettings(); }));
			new Setting(containerEl).setName('Gemini Voice').setDesc('30가지 중 주요 15가지').addDropdown(d => d
				.addOption('Puck', 'Puck (Upbeat)')
				.addOption('Charon', 'Charon (Informative)')
				.addOption('Kore', 'Kore (Firm, 여성)')
				.addOption('Fenrir', 'Fenrir (Excitable, 남성)')
				.addOption('Aoede', 'Aoede (Breezy)')
				.addOption('Zephyr', 'Zephyr (Bright)')
				.addOption('Leda', 'Leda (Youthful)')
				.addOption('Orus', 'Orus (Firm)')
				.addOption('Callirrhoe', 'Callirrhoe (Easy-going)')
				.addOption('Autonoe', 'Autonoe (Bright)')
				.addOption('Enceladus', 'Enceladus (Breathy)')
				.addOption('Iapetus', 'Iapetus (Clear)')
				.addOption('Umbriel', 'Umbriel (Easy-going)')
				.addOption('Algieba', 'Algieba (Smooth)')
				.addOption('Despina', 'Despina (Smooth)')
				.setValue(this.plugin.settings.ttsGeminiVoice)
				.onChange(async v => { this.plugin.settings.ttsGeminiVoice = v; await this.plugin.saveSettings(); }));
		} else {
			new Setting(containerEl).setName('TTS 언어').addDropdown(d => d.addOption('ko-KR', '한국어').addOption('en-US', 'English').setValue(this.plugin.settings.ttsLanguage).onChange(async v => { this.plugin.settings.ttsLanguage = v; await this.plugin.saveSettings(); }));
		}
	}
}
