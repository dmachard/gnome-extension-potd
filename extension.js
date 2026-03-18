import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';

import { BingProvider } from './bing.js';
import { WikimediaProvider } from './wikimedia.js';
import { Overlay } from './overlay.js';

const REFRESH_INTERVAL = 3600;

export default class DailySceneryExtension extends Extension {
    enable() {
        console.log('[POTD] Extension enabling');
        this._overlay = new Overlay();
        this._settings = this.getSettings();
        this._bgSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.background' });

        this._refresh().catch(e => {
            console.log(`[POTD] Initial refresh error: ${e.message}`);
        });

        const refreshKeys = [
            'provider', 'language', 'auto-translate',
            'enable-bing', 'enable-wikimedia'
        ];

        this._signalIds = [];
        for (const key of refreshKeys) {
            const id = this._settings.connect(`changed::${key}`, () => {
                console.log(`[POTD] Setting changed: ${key}, refreshing...`);
                this._refresh().catch(e => console.log(`[POTD] Settings change refresh error: ${e.message}`));
            });
            this._signalIds.push(id);
        }

        this._timer = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            REFRESH_INTERVAL,
            () => {
                this._refresh().catch(e => console.log(`[POTD] Timer refresh error: ${e.message}`));
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    disable() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = null;
        }

        if (this._signalIds && this._settings) {
            for (const id of this._signalIds) {
                this._settings.disconnect(id);
            }
            this._signalIds = [];
        }

        this._overlay?.hide();
        this._overlay = null;
        this._settings = null;
        this._bgSettings = null;
    }

    async _refresh() {
        console.log('[POTD] Refresh starting...');
        try {
            const enabledProviders = ['bing', 'wikimedia'].filter(
                p => this._settings.get_boolean(`enable-${p}`)
            );
            
            if (enabledProviders.length === 0) {
                // If all disabled, force at least one (Bing) to avoid crash
                enabledProviders.push('bing');
            }

            const hour = new Date().getHours();
            const sliceLength = 24 / enabledProviders.length;
            const index = Math.floor(hour / sliceLength) % enabledProviders.length;
            
            // Place calculated provider first, then others as fallback
            const sequence = [
                enabledProviders[index],
                ...enabledProviders.slice(index + 1),
                ...enabledProviders.slice(0, index)
            ];
            console.log(`[POTD] Provider sequence (hour ${hour}): try ${sequence.join(' -> ')}`);

            let metadata = null;
            for (const pName of sequence) {
                try {
                    let providerObj;
                    if (pName === 'wikimedia') {
                        providerObj = new WikimediaProvider(this._settings);
                    } else {
                        providerObj = new BingProvider(this._settings);
                    }

                    metadata = await providerObj.fetchMetadata();
                    console.log(`[POTD] Metadata fetched via ${pName}: ${metadata.title}`);
                    break; // Success, exit fallback loop
                } catch (e) {
                    console.log(`[POTD] Provider ${pName} failed: ${e.message}. Trying next...`);
                }
            }

            if (!metadata) {
                throw new Error("All image providers failed.");
            }

            // Update UI overlay
            this._overlay?.show(metadata);

            // Download and update wallpaper
            if (metadata.imageUrl) {
                await this._updateWallpaper(metadata.imageUrl);
            }
        } catch (e) {
            console.error(`[POTD] Global refresh error: ${e.message}`);
        }
    }

    async _updateWallpaper(url) {
        console.log(`[POTD] Downloading wallpaper from: ${url}`);
        const cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'daily-scenery']);
        GLib.mkdir_with_parents(cacheDir, 0o755);

        const filename = GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, url, -1) + '.jpg';
        const destPath = GLib.build_filenamev([cacheDir, filename]);
        const destFile = Gio.File.new_for_path(destPath);

        // If file exists and is very small (likely a previous HTML error), remove it
        if (destFile.query_exists(null)) {
            try {
                const info = destFile.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null);
                if (info.get_size() < 1000) { // Wallpaper is rarely less than 1KB
                    console.log('[POTD] Removing potentially corrupted small file');
                    destFile.delete(null);
                } else {
                    this._setWallpaper(destPath);
                    return;
                }
            } catch (e) { }
        }

        const session = new Soup.Session();
        session.user_agent = 'DailyPhotoExtension/1.0 (https://github.com/dmachard/dailyphoto)';
        const message = Soup.Message.new('GET', url);

        return new Promise((resolve) => {
            session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    const status = message.status_code;

                    if (status !== 200) {
                        throw new Error(`HTTP Error: ${status}`);
                    }

                    destFile.replace_contents(bytes.get_data(), null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
                    this._setWallpaper(destPath);
                } catch (e) {
                    console.error(`[POTD] Download error: ${e.message}`);
                }
                resolve();
            });
        });
    }

    _setWallpaper(path) {
        const uri = Gio.File.new_for_path(path).get_uri();
        this._bgSettings.set_string('picture-uri', uri);
        this._bgSettings.set_string('picture-uri-dark', uri);
    }
}
