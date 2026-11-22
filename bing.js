import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import { ImageProvider } from './provider.js';

const BING_BASE = 'https://www.bing.com';
const BING_URL_BASE = `${BING_BASE}/HPImageArchive.aspx?format=js&idx=0&n=1`;

export class BingProvider extends ImageProvider {
    constructor(settings, session) {
        super();
        this._settings = settings;
        this._session = session;
    }

    async fetchMetadata(width) {
        // Detect system language
        const lang = this.getSystemLanguage();

        const markets = {
            'fr': 'fr-FR',
            'en': 'en-US',
            'de': 'de-DE',
            'it': 'it-IT',
            'es': 'es-ES'
        };
        const mkt = markets[lang] || 'en-US';
        const url = `${BING_URL_BASE}&mkt=${mkt}&setlang=${lang}`;

        const message = Soup.Message.new('GET', url);

        return new Promise((resolve, reject) => {
            this._session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        const bytes = session.send_and_read_finish(result);
                        if (message.status_code !== 200)
                            throw new Error(`HTTP Error: ${message.status_code}`);

                        const text = new TextDecoder().decode(bytes.get_data());
                        const json = JSON.parse(text);
                        if (!json.images?.[0])
                            throw new Error('Malformed Bing API response: missing image');

                        const image = json.images[0];

                        // Parse copyright to extract author and description
                        let fullCopyright = image.copyright ?? '';
                        let author = '';
                        let copyright = fullCopyright;

                        const match = fullCopyright.match(/^(.+?)\s*\(\s*©\s*(.+)\s*\)$/);
                        if (match) {
                            copyright = match[1];
                            author = match[2];
                        } else {
                            const simpleMatch = fullCopyright.match(/\(©\s*(.+)\)/);
                            if (simpleMatch) {
                                author = simpleMatch[1];
                            }
                        }

                        // Localized generic title
                        const genericTitles = {
                            'fr': 'Image du jour (Bing)',
                            'en': 'Picture of the Day (Bing)',
                            'de': 'Bild des Tages (Bing)',
                            'it': 'Immagine del giorno (Bing)',
                            'es': 'Imagen del día (Bing)'
                        };
                        const title = genericTitles[lang] || genericTitles['en'];

                        // Description consists of image title and copyright (descriptive part)
                        let description = image.title ?? '';
                        if (copyright && copyright !== image.title) {
                            description = description ? `${description}. ${copyright}` : copyright;
                        }

                        resolve({
                            title: title,
                            author: author,
                            copyright: copyright,
                            description: description,
                            imageUrl: BING_BASE + image.url,
                            infoUrl: image.copyrightlink ? (BING_BASE + image.copyrightlink) : BING_BASE,
                        });
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
    }
}
