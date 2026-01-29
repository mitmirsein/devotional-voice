import { App, TFile, Vault, requestUrl, Notice } from 'obsidian';

export interface SearchResult {
    file: TFile;
    score: number;
    excerpt: string;
}

export interface RAGSettings {
    whitelistFolders: string[];
    maxResults: number;
    geminiApiKey?: string;
    geminiModel?: string;
}

/**
 * RAG Service for searching relevant notes in the vault
 * Uses keyword-based search for MVP (can be upgraded to embeddings later)
 */
export class RAGService {
    private app: App;
    private settings: RAGSettings;

    constructor(app: App, settings: RAGSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * Search for relevant notes based on the input text
     */
    async search(query: string, topK: number = 5): Promise<SearchResult[]> {
        const results: SearchResult[] = [];
        const vault = this.app.vault;

        // Get all markdown files in whitelist folders
        const files = vault.getMarkdownFiles().filter(file =>
            this.isInWhitelistFolder(file.path)
        );

        // Extract keywords from query
        let keywords = this.extractKeywords(query);
        
        // Phase 2: Query Expansion
        if (this.settings.geminiApiKey && keywords.length > 0) {
            try {
                const expandedKeywords = await this.expandKeywordsWithLLM(query);
                if (expandedKeywords.length > 0) {
                    console.log('[RAG] Expanded Keywords:', expandedKeywords);
                    // Merge and deduplicate
                    keywords = [...new Set([...keywords, ...expandedKeywords])];
                }
            } catch (e) {
                console.error('[RAG] Expansion failed, falling back to basic search:', e);
            }
        }

        for (const file of files) {
            const content = await vault.cachedRead(file);
            const score = this.calculateRelevanceScore(content, keywords);

            if (score > 0) {
                results.push({
                    file,
                    score,
                    excerpt: this.extractExcerpt(content, keywords)
                });
            }
        }

        // Sort by score and return top K
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    /**
     * Check if a file path is in the whitelist folders
     */
    private isInWhitelistFolder(filePath: string): boolean {
        if (this.settings.whitelistFolders.length === 0) {
            return true; // No whitelist = search all
        }

        return this.settings.whitelistFolders.some(folder =>
            filePath.startsWith(folder.trim())
        );
    }

    /**
     * Extract keywords from the query text
     */
    private extractKeywords(text: string): string[] {
        // Remove common Korean particles and stopwords
        const stopwords = ['은', '는', '이', '가', '을', '를', '에', '의', '와', '과', '로', '으로', '에서', '하다', '되다', '있다', '없다'];

        // Split by whitespace and punctuation
        const words = text.split(/[\s,.!?;:'"()[\]{}]+/)
            .filter(word => word.length > 1)
            .filter(word => !stopwords.includes(word))
            .map(word => word.toLowerCase());

        return [...new Set(words)]; // Remove duplicates
    }

    /**
     * Calculate relevance score based on keyword matching
     */
    private calculateRelevanceScore(content: string, keywords: string[]): number {
        const lowerContent = content.toLowerCase();
        let score = 0;

        for (const keyword of keywords) {
            // Escape special regex characters to prevent errors
            const escapedKeyword = this.escapeRegExp(keyword);
            try {
                const regex = new RegExp(escapedKeyword, 'gi');
                const matches = lowerContent.match(regex);
                if (matches) {
                    score += matches.length;
                }
            } catch (e) {
                // Skip invalid regex patterns
                console.warn(`[RAG] Skipping invalid keyword: ${keyword}`);
            }
        }

        return score;
    }

    /**
     * Escape special characters for use in RegExp
     */
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Extract relevant excerpt from content
     */
    private extractExcerpt(content: string, keywords: string[], maxLength: number = 300): string {
        const lowerContent = content.toLowerCase();

        // Find first keyword occurrence
        for (const keyword of keywords) {
            const index = lowerContent.indexOf(keyword.toLowerCase());
            if (index !== -1) {
                // Get surrounding context
                const start = Math.max(0, index - 50);
                const end = Math.min(content.length, index + maxLength);
                return '...' + content.slice(start, end).trim() + '...';
            }
        }

        // If no keyword found, return beginning of content
        return content.slice(0, maxLength).trim() + '...';
    }

    /**
     * Update settings
     */
    updateSettings(settings: RAGSettings) {
        this.settings = settings;
    }

    /**
     * Expand query using LLM to find theological synonyms and related concepts
     */
    private async expandKeywordsWithLLM(query: string): Promise<string[]> {
        const model = this.settings.geminiModel || 'gemini-2.0-flash';
        const apiKey = this.settings.geminiApiKey;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const prompt = `Analyze this devotional text and extract 5-8 related theological conceptual keywords (synonyms, biblical themes, key terms).
        Text: "${query.substring(0, 500)}"
        
        Output only a comma-separated list of keywords. No explanations.
        Example: Grace, Salvation, Cross, Redemption`;

        try {
            const response = await requestUrl({
                url: apiUrl,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.3 }
                })
            });

            if (response.status !== 200) return [];

            const text = response.json?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return [];

            return text.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
        } catch (e) {
            console.error('[RAG] LLM Expansion Error:', e);
            return [];
        }
    }
}
