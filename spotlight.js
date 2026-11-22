import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { ImageProvider } from './provider.js';

const SPOTLIGHT_API = 'https://fd.api.iris.microsoft.com/v4/api/selection';
const SPOTLIGHT_PLACEMENT = '88000820';
const SPOTLIGHT_BATCH_COUNT = 4;
const REQUEST_TIMEOUT_SEC = 15;

export class WindowsSpotlightProvider extends ImageProvider {
    constructor(settings, session) {
        super();
        this._settings = settings;
        this._session = session;
    }

    async fetchMetadata(_width) {
        const lang = this.getSystemLanguage();

        const locales = {
            'fr': { country: 'FR', locale: 'fr-FR' },
            'en': { country: 'US', locale: 'en-US' },
            'de': { country: 'DE', locale: 'de-DE' },
            'it': { country: 'IT', locale: 'it-IT' },
            'es': { country: 'ES', locale: 'es-ES' },
        };
        const { country, locale } = locales[lang] || locales['en'];
        const url = `${SPOTLIGHT_API}?&placement=${SPOTLIGHT_PLACEMENT}&bcnt=${SPOTLIGHT_BATCH_COUNT}&country=${country}&locale=${locale}&fmt=json`;

        const message = Soup.Message.new('GET', url);
        const cancellable = new Gio.Cancellable();

        return new Promise((resolve, reject) => {
            let timeoutId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                REQUEST_TIMEOUT_SEC,
                () => {
                    timeoutId = 0;
                    cancellable.cancel();
                    return GLib.SOURCE_REMOVE;
                }
            );

            this._session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                cancellable,
                (session, result) => {
                    if (timeoutId) {
                        GLib.source_remove(timeoutId);
                        timeoutId = 0;
                    }

                    try {
                        const bytes = session.send_and_read_finish(result);
                        if (message.status_code !== 200) {
                            throw new Error(`HTTP Error: ${message.status_code}`);
                        }

                        const text = new TextDecoder().decode(bytes.get_data());
                        const json = JSON.parse(text);
                        resolve(this._parseResponse(json, lang));
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
    }

    _getDownloadDir() {
        const customDir = this._settings?.get_string('download-folder');
        return customDir || GLib.build_filenamev([GLib.get_user_cache_dir(), 'potd']);
    }

    _isCached(imageUrl) {
        const baseName = GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, imageUrl, -1);
        const destPath = GLib.build_filenamev([this._getDownloadDir(), `${baseName}.jpg`]);
        return Gio.File.new_for_path(destPath).query_exists(null);
    }

    _parseResponse(json, lang = 'en') {
        const items = json?.batchrsp?.items;
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('Malformed Spotlight API response: missing items');
        }

        const candidates = [];
        for (const entry of items) {
            if (!entry?.item || typeof entry.item !== 'string') continue;
            try {
                candidates.push(this._parseItem(entry.item, lang));
            } catch (_e) {
                // Skip malformed entry if another candidate succeeds
            }
        }

        if (candidates.length === 0) {
            throw new Error('Malformed Spotlight API response: no valid items');
        }

        return candidates.find(c => !this._isCached(c.imageUrl)) || candidates[0];
    }

    _parseItem(rawItem, lang = 'en') {
        const item = JSON.parse(rawItem);
        const ad = item?.ad;
        if (!ad || typeof ad !== 'object') {
            throw new Error('Malformed Spotlight API response: missing ad');
        }

        // Prefer landscape (4K 3840x2160) over portrait
        const imageUrl = ad.landscapeImage?.asset || ad.portraitImage?.asset || '';
        if (!imageUrl) {
            throw new Error('No image URL in Spotlight API response');
        }

        const genericTitles = {
            'fr': 'Image du jour (Windows Spotlight)',
            'en': 'Picture of the Day (Windows Spotlight)',
            'de': 'Bild des Tages (Windows Spotlight)',
            'it': 'Immagine del giorno (Windows Spotlight)',
            'es': 'Imagen del día (Windows Spotlight)',
        };
        const title = ad.title?.trim() || genericTitles[lang] || genericTitles['en'];

        // iconHoverText typically starts with "Location\r\n© Author\r\n..."
        const firstHoverLine = ad.iconHoverText?.split(/\r?\n/)[0]?.trim() || '';
        const location = (firstHoverLine && !firstHoverLine.startsWith('©')) ? firstHoverLine : '';

        const rawDesc = ad.description?.trim() || '';
        let description = rawDesc;
        if (location && !rawDesc.includes(location) && !title.includes(location)) {
            description = rawDesc ? `${location} — ${rawDesc}` : location;
        }

        const copyright = ad.copyright?.trim() || '';
        const author = copyright.replace(/^©\s*/, '').trim();

        return {
            title,
            author,
            copyright,
            description,
            imageUrl,
            infoUrl: ad.ctaUri || 'https://www.bing.com/spotlight',
        };
    }
}
