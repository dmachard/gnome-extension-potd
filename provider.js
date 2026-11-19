import GLib from 'gi://GLib';

/**
 * Base class for image providers.
 */
export class ImageProvider {
    /**
     * @param {number} width - Desired image width for thumbnails
     * @returns {Promise<{title: string, author: string, copyright: string, imageUrl: string, description: string, infoUrl: string}>}
     */
    async fetchMetadata(width) {
        throw new Error('Not implemented');
    }

    /**
     * Utility to get the current system language.
     * @returns {string} ISO language code (e.g., 'en', 'fr')
     */
    getSystemLanguage() {
        const languages = GLib.get_language_names();
        for (const l of languages) {
            if (l !== 'C' && l !== 'POSIX') {
                return l.split('_')[0].split('.')[0];
            }
        }
        return 'en';
    }
}
