import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';
import { ImageProvider } from './provider.js';

const BING_BASE = 'https://www.bing.com';
const BING_URL_BASE = `${BING_BASE}/HPImageArchive.aspx?format=js&idx=0&n=1`;

export class BingProvider extends ImageProvider {
    constructor(settings) {
        super();
        this._settings = settings;
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

        const session = new Soup.Session();
        const message = Soup.Message.new('GET', url);

        return new Promise((resolve, reject) => {
            session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                async (session, result) => {
                    try {
                        const bytes = session.send_and_read_finish(result);
                        const text = new TextDecoder().decode(bytes.get_data());
                        const json = JSON.parse(text);
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

                        // Automatic translation if necessary
                        const autoTranslate = this._settings?.get_boolean('auto-translate') || false;
                        if (description && lang === 'fr' && autoTranslate) {
                            console.log('[POTD] Bing: Attempting auto-translation to French');
                            const translated = await this._translate(description, 'en', 'fr');
                            if (translated) {
                                description = translated;
                            }
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

    async _translate(text, from, to) {
        if (!text) return '';

        const session = new Soup.Session();
        session.user_agent = 'DailyPhotoExtension/1.0 (https://github.com/dmachard/dailyphoto)';

        const params = [
            `q=${encodeURIComponent(text)}`,
            `langpair=${from}|${to}`,
            'de=dmachard@gmail.com'
        ].join('&');

        const url = `https://api.mymemory.translated.net/get?${params}`;
        const message = Soup.Message.new('GET', url);

        return new Promise((resolve) => {
            session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    const json = JSON.parse(new TextDecoder().decode(bytes.get_data()));

                    if (json.responseStatus === 200) {
                        let translatedText = json.responseData.translatedText;
                        translatedText = translatedText.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                        console.log('[POTD] Bing: Translation successful');
                        resolve(translatedText);
                    } else {
                        console.log(`[POTD] Bing: Translation API returned status ${json.responseStatus}`);
                        resolve('');
                    }
                } catch (e) {
                    console.error(`[POTD] Bing: Translation error: ${e.message}`);
                    resolve('');
                }
            });
        });
    }
}
