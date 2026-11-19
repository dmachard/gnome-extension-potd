import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import { ImageProvider } from './provider.js';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

export class WikimediaProvider extends ImageProvider {
    constructor(settings, session) {
        super();
        this._settings = settings;
        this._session = session;
    }

    async fetchMetadata(width = 3840) {
        const date = new GLib.DateTime().format('%Y-%m-%d');
        const targetLang = this.getSystemLanguage();

        const filename = await this._getFilename(date);

        // 1. Try target language (e.g., fr)
        let description = await this._getDescription(date, targetLang);

        // 2. If fails and target wasn't English, try explicit English
        if (!description && targetLang !== 'en') {
            description = await this._getDescription(date, 'en');
        }

        // 3. If still nothing, try main template (sometimes contains default description)
        if (!description) {
            description = await this._getRawDescription(date);
        }

        const details = await this._getImageDetails(filename, targetLang, width);

        // Localized generic title for Wikimedia POTD
        const genericTitles = {
            'fr': 'Image du jour (Wikimedia)',
            'en': 'Picture of the Day (Wikimedia)',
            'de': 'Bild des Tages (Wikimedia)',
            'it': 'Immagine del giorno (Wikimedia)',
            'es': 'Imagen del día (Wikimedia)'
        };
        const title = genericTitles[targetLang] || genericTitles['en'];

        return {
            ...details,
            title: title,
            description: description || details.description
        };
    }

    async _getDescription(date, lang) {
        const text = `{{Potd/${date} (${lang})}}`;
        return this._expandTemplate(text);
    }

    async _getRawDescription(date) {
        const text = `{{Potd/${date}}}`;
        return this._expandTemplate(text);
    }

    async _expandTemplate(text) {
        const params = [
            'action=expandtemplates',
            'format=json',
            `text=${encodeURIComponent(text)}`,
            'prop=wikitext',
            'origin=*'
        ].join('&');

        const url = `${COMMONS_API}?${params}`;
        const message = Soup.Message.new('GET', url);

        return new Promise((resolve) => {
            this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    const json = JSON.parse(new TextDecoder().decode(bytes.get_data()));
                    let wikitext = json.expandtemplates.wikitext ?? '';

                    // If result starts with "Template:" or "[[:Template:", it doesn't exist
                    if (wikitext.startsWith('Template:') || wikitext.startsWith('[[:Template:')) {
                        resolve('');
                        return;
                    }

                    // Clean simple wiki links [[Link|Text]] -> Text
                    wikitext = wikitext.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');
                    resolve(wikitext.trim());
                } catch (e) {
                    resolve('');
                }
            });
        });
    }

    async _getFilename(date) {
        const params = [
            'action=expandtemplates',
            'format=json',
            `text=${encodeURIComponent(`{{Potd/${date}}}`)}`,
            'prop=wikitext',
            'origin=*'
        ].join('&');

        const url = `${COMMONS_API}?${params}`;
        const message = Soup.Message.new('GET', url);

        return new Promise((resolve, reject) => {
            this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    const status = message.status_code;

                    if (status !== 200) {
                        throw new Error(`HTTP Error: ${status}`);
                    }

                    const json = JSON.parse(new TextDecoder().decode(bytes.get_data()));
                    const resultFilename = json.expandtemplates.wikitext?.trim();
                    resolve(resultFilename);
                } catch (e) {
                    console.error(`[POTD] Wikimedia _getFilename error: ${e.message}`);
                    reject(e);
                }
            });
        });
    }

    async _getImageDetails(filename, lang, width) {
        if (!filename) {
            throw new Error('Filename is empty');
        }

        // Clean filename (remove "File:" or "Fichier:" prefix if present)
        const cleanFilename = filename.replace(/^(File|Fichier):/i, '').trim();

        const params = [
            'action=query',
            `titles=File:${encodeURIComponent(cleanFilename)}`,
            'prop=imageinfo',
            `iiprop=url|extmetadata|size${width ? '|thumburl' : ''}`,
            width ? `iiurlwidth=${width}` : '',
            'format=json',
            'origin=*',
            `uselang=${lang}`
        ].join('&');

        const url = `${COMMONS_API}?${params}`;
        const message = Soup.Message.new('GET', url);

        return new Promise((resolve, reject) => {
            this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    const status = message.status_code;

                    if (status !== 200) {
                        throw new Error(`HTTP Error: ${status}`);
                    }

                    const json = JSON.parse(new TextDecoder().decode(bytes.get_data()));

                    const pages = json.query.pages;
                    const pageId = Object.keys(pages)[0];

                    if (pageId === '-1') {
                        throw new Error(`File not found: ${cleanFilename}`);
                    }

                    const info = pages[pageId].imageinfo[0];
                    const meta = info.extmetadata;

                    // Summary cleanup of HTML in description
                    let description = meta.ImageDescription ? meta.ImageDescription.value : '';
                    description = description.replace(/<[^>]*>/g, '');

                    resolve({
                        title: meta.ObjectName ? meta.ObjectName.value : cleanFilename,
                        author: meta.Artist ? meta.Artist.value.replace(/<[^>]*>/g, '') : 'Wikimedia Commons',
                        copyright: meta.LicenseShortName ? meta.LicenseShortName.value : '',
                        description: description,
                        imageUrl: (width && info.thumburl) ? info.thumburl : info.url,
                        infoUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(cleanFilename)}`,
                    });
                } catch (e) {
                    console.error(`[POTD] Wikimedia _getImageDetails error: ${e.message}`);
                    reject(e);
                }
            });
        });
    }
}
