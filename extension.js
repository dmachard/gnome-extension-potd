import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { BingProvider } from './bing.js';
import { WikimediaProvider } from './wikimedia.js';
import { Overlay } from './overlay.js';

const REFRESH_INTERVAL = 3600;

// Picture of the Day (Potd) Extension
export default class PotdExtension extends Extension {
    enable() {
        this._overlay = new Overlay();
        this._settings = this.getSettings();
        this._bgSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.background' });
        this._session = new Soup.Session({
            user_agent: 'PictureOfTheDay/1.0',
        });

        this._indicator = new PanelMenu.Button(0.5, this.metadata.name, false);
        this._indicator.style = '-natural-hpadding: 4px; -minimum-hpadding: 2px;';
        this._icon = new St.Icon({
            gicon: Gio.icon_new_for_string(`${this.path}/icons/daily-symbolic.svg`),
            style_class: 'system-status-icon',
        });
        this._indicator.add_child(this._icon);
        const titleItem = new PopupMenu.PopupMenuItem(this.metadata.name, { reactive: false });
        titleItem.label.style = 'font-weight: bold;';
        this._indicator.menu.addMenuItem(titleItem);
        this._statusItem = new PopupMenu.PopupMenuItem('Loading...', { reactive: false });
        this._statusItem.label.style = 'font-size: 0.9em; opacity: 0.75;';
        this._indicator.menu.addMenuItem(this._statusItem);
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addAction('Settings', () => {
            this.openPreferences();
        });
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._refresh().catch(() => { });

        const refreshKeys = [
            'enable-bing', 'enable-wikimedia', 'picture-options'
        ];

        this._signalIds = [];
        for (const key of refreshKeys) {
            const id = this._settings.connect(`changed::${key}`, () => {
                this._refresh().catch(() => { });
            });
            this._signalIds.push(id);
        }

        this._timer = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            REFRESH_INTERVAL,
            () => {
                this._refresh().catch(() => { });
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

        this._statusItem?.destroy();
        this._statusItem = null;
        this._icon?.destroy();
        this._icon = null;
        this._indicator?.destroy();
        this._indicator = null;

        this._session?.abort();
        this._session = null;

        this._overlay?.hide();
        this._overlay = null;
        this._settings = null;
        this._bgSettings = null;
    }

    async _refresh() {
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

            let metadata = null;
            let usedProvider = '';
            for (const pName of sequence) {
                try {
                    let providerObj;
                    if (pName === 'wikimedia') {
                        providerObj = new WikimediaProvider(this._settings, this._session);
                    } else {
                        providerObj = new BingProvider(this._settings, this._session);
                    }

                    // Get primary monitor width for thumbnail fetching
                    const monitor = Main.layoutManager.primaryMonitor;
                    const width = monitor ? monitor.width : 3840;

                    metadata = await providerObj.fetchMetadata(width);
                    usedProvider = pName;
                    break; // Success, exit fallback loop
                } catch (e) {
                    // Try next provider
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

            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            this._setStatus(`Updated: ${time} (${usedProvider})`, false);
        } catch (e) {
            console.error(`[POTD] Global refresh error: ${e.message}`);
            this._setStatus(`Error: ${e.message}`, true);
        }
    }

    _setStatus(text, isError) {
        if (this._statusItem) {
            this._statusItem.label.text = text;
        }
        if (this._icon) {
            this._icon.opacity = isError ? 140 : 255;
        }
    }

    async _updateWallpaper(url) {
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
                    destFile.delete(null);
                } else {
                    this._setWallpaper(destPath);
                    return;
                }
            } catch (e) { }
        }

        const message = Soup.Message.new('GET', url);

        return new Promise((resolve, reject) => {
            this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    const status = message.status_code;

                    if (status !== 200) {
                        throw new Error(`HTTP Error: ${status}`);
                    }

                    destFile.replace_contents(bytes.get_data(), null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
                    this._setWallpaper(destPath);
                    resolve();
                } catch (e) {
                    console.error(`[POTD] Download error: ${e.message}`);
                    reject(e);
                }
            });
        });
    }

    _setWallpaper(path) {
        const uri = Gio.File.new_for_path(path).get_uri();

        // Apply placement options
        const placement = this._settings.get_string('picture-options') || 'zoom';
        this._bgSettings.set_string('picture-options', placement);

        this._bgSettings.set_string('picture-uri', uri);
        this._bgSettings.set_string('picture-uri-dark', uri);
    }
}
