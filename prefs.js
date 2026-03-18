import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class DailyPhotoPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        // Localization Group
        const langGroup = new Adw.PreferencesGroup({
            title: 'Localisation',
            description: 'Language and translation configuration',
        });
        page.add(langGroup);

        const langModel = Gtk.StringList.new(['Automatique', 'Français', 'English']);
        const langRow = new Adw.ComboRow({
            title: 'Description language',
            model: langModel,
        });

        const currentLang = settings.get_string('language');
        const langIndex = ['auto', 'fr', 'en'].indexOf(currentLang);
        if (langIndex !== -1) {
            langRow.selected = langIndex;
        }

        langRow.connect('notify::selected', () => {
            const languages = ['auto', 'fr', 'en'];
            settings.set_string('language', languages[langRow.selected]);
        });

        langGroup.add(langRow);

        const translateRow = new Adw.SwitchRow({
            title: 'Automatic translation',
            subtitle: 'Translate to French via MyMemory if native description is unavailable',
        });
        settings.bind('auto-translate', translateRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        langGroup.add(translateRow);

        // Image Sources Group
        const autoGroup = new Adw.PreferencesGroup({
            title: 'Image Sources',
            description: 'The extension rotates between enabled sources throughout the day. If only one is enabled, it stays fixed.',
        });
        page.add(autoGroup);

        const bingRow = new Adw.SwitchRow({
            title: 'Bing',
            subtitle: 'Include new images from Bing',
        });
        settings.bind('enable-bing', bingRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        autoGroup.add(bingRow);

        const wikimediaRow = new Adw.SwitchRow({
            title: 'Wikimedia Commons',
            subtitle: 'Include new images from Wikimedia',
        });
        settings.bind('enable-wikimedia', wikimediaRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        autoGroup.add(wikimediaRow);
    }
}
