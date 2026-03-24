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
     * Utility to get the current language from settings or system.
     * @returns {string} ISO language code (e.g., 'en', 'fr')
     */
    getSystemLanguage() {
        let lang = this._settings?.get_string('language') || 'auto';
        if (lang === 'auto') {
            const languages = GLib.get_language_names();
            lang = 'en';
            for (let l of languages) {
                if (l !== 'C' && l !== 'POSIX') {
                    lang = l.split('_')[0].split('.')[0];
                    break;
                }
            }
        }
        return lang;
    }
}
