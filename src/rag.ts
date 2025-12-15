import { App, TFile, Vault } from 'obsidian';

export interface SearchResult {
    file: TFile;
    score: number;
    excerpt: string;
}

export interface RAGSettings {
    whitelistFolders: string[];
    maxResults: number;
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
        const keywords = this.extractKeywords(query);

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
            // Count occurrences
            const regex = new RegExp(keyword, 'gi');
            const matches = lowerContent.match(regex);
            if (matches) {
                score += matches.length;
            }
        }

        return score;
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
}
