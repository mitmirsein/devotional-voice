# Voice Writing for Obsidian 🎙️

A local-first, AI-powered voice writing plugin for Obsidian. Seamlessly record, transcribe, and write with your voice using OpenAI or Groq.

![GitHub release (latest by date)](https://img.shields.io/github/v/release/reallygood83/voice-writing?style=flat-square)

## ✨ Features

- **One-Click Recording**: Instantly start recording via the ribbon icon or status bar.
- **Magic Paste**: Automatically transcribes audio and inserts text + audio attachment into your note.
- **AI-Powered**: Supports **OpenAI Whisper** (High Quality) and **Groq** (Real-time speed).
- **Quick Options**: Easily switch languages (e.g., English, Korean) and models without digging into settings.
- **Privacy First**: Audio is processed via your own API keys. Files are stored locally in your vault.

## 🏁 Before You Begin

To use this plugin, you need an API Key from **OpenAI** or **Groq**. Don't worry, it's easy to get one!

### 1. Get an API Key
- **Recommend**: [**Groq**](https://console.groq.com/keys) (It's currently **Free** and **Extremely Fast**! ⚡️)
- **Alternative**: [OpenAI](https://platform.openai.com/api-keys) (High accuracy, standard pricing)

### 2. Set it up in Obsidian
1. Install and enable the plugin.
2. Go to **Settings** > **Voice Writing**.
3. Paste your key into the **API Key** field.
4. Select your provider (`Groq` or `OpenAI`) in the dropdown.
5. That's it! You're ready to record. 🎙️

## 🚀 Installation

### Via BRAT (Recommended for Beta)
1. Install the **[BRAT](https://github.com/TfTHacker/obsidian42-brat)** plugin from Community Plugins.
2. Open BRAT settings > **Add Neter plugin**.
3. Enter repository: `reallygood83/voice-writing`.
4. Enable "Voice Writing" in your Community Plugins list.

### Manual Installation
1. Download the latest release from the [Releases](https://github.com/reallygood83/voice-writing/releases) page.
2. Extract the files into `.obsidian/plugins/voice-writing`.
3. Reload Obsidian.

## ⚙️ Configuration

1. Go to **Settings > Voice Writing**.
2. **Service Provider**: Choose `OpenAI` or `Groq`.
3. **API Key**: Enter your API key.
    - [Get OpenAI Key](https://platform.openai.com/api-keys)
    - [Get Groq Key](https://console.groq.com/keys)
4. **Default Language**: Set your primary language (e.g., `en`, `ko`, or `auto`).

## 🎮 Usage

### Basic Workflow
1. Click the **Microphone Icon** in the left ribbon (or click "Idle" in the status bar).
2. Speak your thoughts. The status bar will show "Recording...".
3. Click the icon again to stop.
4. Wait for the "Processing..." modal to finish.
5. Your text and audio file will appear in the current note!

### Quick Options
- Run the command `Voice Writing: Quick Options` (Cmd/Ctrl + P).
- Switch Language or Model on the fly.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
AGPL-3.0

## 👨‍💻 About the Author

Hi! I'm **Moon**, passionate about productivity and learning.

- 📺 **YouTube**: [Master of Learning (배움의달인)](https://youtube.com/@배움의달인-p5v)
- 🐦 **X (Twitter)**: [@reallygood83](https://x.com/reallygood83)

If you find this plugin helpful, please subscribe and follow!
