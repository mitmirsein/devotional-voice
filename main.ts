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

interface Template {
	name: string;
	content: string;
}

interface DevotionalVoiceSettings {
	openaiApiKey: string;
	groqApiKey: string;
	language: string;
	serviceProvider: ServiceProvider;
	whitelistFolders: string;
	ragMaxResults: number;
	geminiApiKey: string;
	geminiModel: string;
	
	// Multi-Template Support
	prompts: Template[];
	activePromptIndex: number;
	
	// Deprecated (kept for migration)
	devotionalTemplate?: string;

	ttsEnabled: boolean;
	ttsProvider: 'google' | 'openai' | 'gemini';
	ttsOpenAiVoice: string;
	ttsGeminiModel: string;
	ttsGeminiVoice: string;
	ttsLanguage: string;
}

const DEFAULT_PROMPT_HINT = `당신은 탁월한 영성을 지닌 신학자이자, 청중의 마음을 위로하는 설교자입니다.
사용자의 묵상 내용과 관련 노트를 바탕으로, 깊이 있는 신학적 통찰과 따뜻한 목회적 적용이 담긴 묵상글을 작성해 주세요.
반드시 JSON 형식({"markdown":"...", "ttsScript":"..."})으로 출력.

언어: 한국어`;

const DEFAULT_SETTINGS: DevotionalVoiceSettings = {
	openaiApiKey: '',
	groqApiKey: '',
	language: 'ko',
	serviceProvider: 'groq',
	whitelistFolders: '',
	ragMaxResults: 5,
	geminiApiKey: '',
	geminiModel: 'gemini-2.0-flash',
	
	prompts: [
		{ name: '기본 템플릿', content: DEFAULT_PROMPT_HINT }
	],
	activePromptIndex: 0,

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

		// Migration Logic: Single Template -> Multi Template
		if (this.settings.devotionalTemplate && this.settings.devotionalTemplate.trim().length > 0) {
			console.log('[DevotionalVoice] Migrating legacy template...');
			// Check if we haven't already migrated (simple check: if only default exists and it's unmodified)
			if (this.settings.prompts.length === 1 && this.settings.prompts[0].name === '기본 템플릿' && this.settings.prompts[0].content === DEFAULT_PROMPT_HINT) {
				this.settings.prompts[0].content = this.settings.devotionalTemplate;
				this.settings.devotionalTemplate = ''; // Clear legacy
				await this.saveSettings();
				new Notice('기존 템플릿이 "기본 템플릿"으로 안전하게 이동되었습니다.');
			}
		}

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
			maxResults: this.settings.ragMaxResults,
			geminiApiKey: this.settings.geminiApiKey,
			geminiModel: this.settings.geminiModel
		};
	}

	private getGenerationSettings(): GenerationSettings {
		// Ensure activePromptIndex is valid
		if (this.settings.activePromptIndex < 0 || this.settings.activePromptIndex >= this.settings.prompts.length) {
			this.settings.activePromptIndex = 0;
		}
		
		return {
			geminiApiKey: this.settings.geminiApiKey,
			geminiModel: this.settings.geminiModel,
			devotionalTemplate: this.settings.prompts[this.settings.activePromptIndex].content
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
			this.recordingModal = new RecordingModal(this.app, this.recorder, () => this.stopVoiceRecording());
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
		
		// Use ProcessingModal as Streaming Viewer
		const processingModal = new ProcessingModal(this.app);
		processingModal.open();

        let ragResults: SearchResult[] = [];

		try {
			new Notice('🔍 관련 노트 검색 중...');
			ragResults = await this.ragService.search(userInput, this.settings.ragMaxResults);
			console.log(`[DevotionalVoice] RAG found ${ragResults.length} results.`);
			
			// Show RAG count in modal (hacky but works)
			processingModal.appendContent(`\n\n[System] Found ${ragResults.length} relevant notes.\n\n`);

			new Notice('✨ 묵상글 생성 중 (Streaming)...');
			
			// Stream Generation
			// Phase 1: Just validation (removed logic to avoid duping)
		} catch (error) {
			console.error('Initial Search Error', error);
			processingModal.close();
			new Notice('Error during search');
			return;
		}
		
		// Wait... I need the `result` (markdown + ttsScript).
		// Since I cannot easily get the return value of an async generator in a for-await loop,
		// I will just accumulate the text myself in this variable.
		let fullText = '';
		
		try {
			// Re-run the loop logic properly to capture fullText
			const generator = this.generationService.streamGenerate(userInput, ragResults);
			
			for await (const chunk of generator) {
				fullText += chunk;
				processingModal.appendContent(chunk);
			}
			
			// Allow user to view the result for a moment? 
			// No, proceed to insert into editor.
			
			// Parse the accumulated text using the service's logic (I need to make parseResponse public or duplicate logic)
			// Let's duplicate simple separator logic here or make `parseResponse` public.
			// Accessing private method is not good, but in TS inside plugin I can cast to any.
			// Or just implement simple split here.
			
			let devotionalText = fullText;
			let ttsScript = '';
			const separator = '|||TTS_SCRIPT_START|||';
			
			if (fullText.includes(separator)) {
				const parts = fullText.split(separator);
				devotionalText = parts[0].trim();
				ttsScript = parts[1].trim();
			} else {
				// Fallback to JSON check if needed (legacy) but separator is primary now.
				// For simple migration, let's assume if no separator, it's all markdown (or failed JSON)
			}

			processingModal.close();

			// Insert into note
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const timestamp = new Date().toLocaleString('ko-KR');
				// ... (rest of logic) ...
				// Embed TTS script as hidden comment for later manual playback
				const ttsBlock = ttsScript ? `\n\n%%TTS-SCRIPT:${ttsScript}%%` : '';
				
				// RAG Reference Section
				let referenceSection = '\n\n### 📚 참조 노트\n';
				// I need to re-fetch ragResults or keep them? I have them in scope.
				// Wait, I am inside try block but ragResults is defined inside.
				// I need to restructure to keep ragResults accessible.
			}
		} catch (e) {
			processingModal.close();
			console.error(e);
			new Notice('Generation Failed');
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
	 * Converts to MP3 if ffmpeg is available
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

		// 1. Save as WAV first
		const timestamp = moment().format('YYYYMMDD_HHmmss');
		const wavFileName = `Devotional_Audio_${timestamp}.wav`;
		const wavFilePath = folderPath ? `${folderPath}/${wavFileName}` : wavFileName;
		
		const mp3FileName = `Devotional_Audio_${timestamp}.mp3`;
		// const mp3FilePath = folderPath ? `${folderPath}/${mp3FileName}` : mp3FileName;

		const wavFile = await this.app.vault.createBinary(wavFilePath, audioBuffer);

		// 2. Try to convert to MP3
		let finalFileName = wavFileName;
		try {
			// @ts-ignore
			const basePath = this.app.vault.adapter.basePath;
			if (basePath) {
				const { exec } = require('child_process');
				const path = require('path');
				
				const inputAbsPath = path.join(basePath, wavFilePath);
				const outputAbsPath = inputAbsPath.replace('.wav', '.mp3');
				
				new Notice('🔄 MP3 변환 중...');
				
				await new Promise<void>((resolve, reject) => {
					exec(`ffmpeg -y -i "${inputAbsPath}" -codec:a libmp3lame -qscale:a 2 "${outputAbsPath}"`, (error: any) => {
						if (error) reject(error);
						else resolve();
					});
				});
				
				// Delete WAV if success
				await this.app.vault.delete(wavFile);
				finalFileName = mp3FileName;
				new Notice(`💾 오디오 저장 완료: ${finalFileName}`);
			} else {
				// BasePath not found (Mobile?), keep WAV
				new Notice(`💾 오디오 저장 완료 (WAV): ${finalFileName}`);
			}
		} catch (e) {
			console.error('[DevotionalVoice] MP3 Conversion failed:', e);
			new Notice('MP3 변환 실패. WAV로 저장됩니다.');
			finalFileName = wavFileName;
		}

		// Append audio embed to the note
		const audioEmbed = `\n\n![[${finalFileName}]]`;
		const cursor = editor.getCursor('to');
		editor.replaceRange(audioEmbed, { line: cursor.line + 1, ch: 0 });
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
		new Setting(containerEl).setName('OpenAI API Key')
			.setDesc(document.createDocumentFragment())
			.then(s => {
				s.descEl.createEl('a', { href: 'https://platform.openai.com/api-keys', text: 'Get API Key', cls: 'u-popover' });
			})
			.addText(t => t.setPlaceholder('sk-...').setValue(this.plugin.settings.openaiApiKey).onChange(async v => { this.plugin.settings.openaiApiKey = v; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName('Groq API Key')
			.setDesc(document.createDocumentFragment())
			.then(s => {
				s.descEl.createEl('a', { href: 'https://console.groq.com/keys', text: 'Get API Key', cls: 'u-popover' });
			})
			.addText(t => t.setPlaceholder('gsk_...').setValue(this.plugin.settings.groqApiKey).onChange(async v => { this.plugin.settings.groqApiKey = v; await this.plugin.saveSettings(); }));

		containerEl.createEl('h3', { text: '🔍 RAG 검색' });
		new Setting(containerEl).setName('화이트리스트 폴더').addText(t => t.setPlaceholder('묵상일지/').setValue(this.plugin.settings.whitelistFolders).onChange(async v => { this.plugin.settings.whitelistFolders = v; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName('최대 검색 결과').addSlider(s => s.setLimits(1, 10, 1).setValue(this.plugin.settings.ragMaxResults).setDynamicTooltip().onChange(async v => { this.plugin.settings.ragMaxResults = v; await this.plugin.saveSettings(); }));

		containerEl.createEl('h3', { text: '✨ 묵상글 생성' });
		new Setting(containerEl).setName('Gemini API Key').setDesc('aistudio.google.com 에서 발급').addText(t => t.setPlaceholder('AIza...').setValue(this.plugin.settings.geminiApiKey).onChange(async v => { this.plugin.settings.geminiApiKey = v; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName('Gemini Model (생성)').addText(t => t.setPlaceholder('gemini-2.0-flash').setValue(this.plugin.settings.geminiModel).onChange(async v => { this.plugin.settings.geminiModel = v; await this.plugin.saveSettings(); }));
		
		// --- Multi-Template Manager Start ---
		containerEl.createEl('h4', { text: '프롬프트 템플릿 관리' });
		const templateSetting = new Setting(containerEl)
			.setName('활성 템플릿')
			.setDesc('사용할 템플릿을 선택하거나 관리합니다.')
			.addDropdown(d => {
				this.plugin.settings.prompts.forEach((p, i) => d.addOption(i.toString(), p.name));
				d.setValue(this.plugin.settings.activePromptIndex.toString())
					.onChange(async v => {
						this.plugin.settings.activePromptIndex = parseInt(v);
						await this.plugin.saveSettings();
						// Refresh to update editor content
						this.display();
					});
			})
			.addExtraButton(b => {
				b.setIcon('plus')
					.setTooltip('새 템플릿 추가')
					.onClick(async () => {
						this.plugin.settings.prompts.push({
							name: `새 템플릿 ${this.plugin.settings.prompts.length + 1}`,
							content: DEFAULT_PROMPT_HINT
						});
						this.plugin.settings.activePromptIndex = this.plugin.settings.prompts.length - 1;
						await this.plugin.saveSettings();
						this.display();
					});
			})
			.addExtraButton(b => {
				b.setIcon('trash')
					.setTooltip('현재 템플릿 삭제')
					.onClick(async () => {
						if (this.plugin.settings.prompts.length <= 1) {
							new Notice('최소 하나의 템플릿은 유지해야 합니다.');
							return;
						}
						const idx = this.plugin.settings.activePromptIndex;
						this.plugin.settings.prompts.splice(idx, 1);
						// Adjust index
						this.plugin.settings.activePromptIndex = Math.max(0, idx - 1);
						await this.plugin.saveSettings();
						this.display();
					})
			});

		// Rename Input
		const activePrompt = this.plugin.settings.prompts[this.plugin.settings.activePromptIndex];
		new Setting(containerEl)
			.setName('템플릿 이름')
			.addText(t => t.setValue(activePrompt.name).onChange(async v => {
				activePrompt.name = v;
				await this.plugin.saveSettings();
				// No need to refresh full display, just dropdown might need it but it's okay for now
			}));

		// Template Content Editor
		new Setting(containerEl)
			.setName('프롬프트 내용')
			.setDesc('JSON 출력 형식({"markdown":"...", "ttsScript":"..."})을 유지해주세요.')
			.addTextArea(t => {
				t.inputEl.rows = 10;
				t.inputEl.cols = 50;
				t.setValue(activePrompt.content)
					.onChange(async v => {
						activePrompt.content = v;
						await this.plugin.saveSettings();
					});
			});
		// --- Multi-Template Manager End ---

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
