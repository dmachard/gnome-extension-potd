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

        // Display Group
        const displayGroup = new Adw.PreferencesGroup({
            title: 'Display',
            description: 'Configure how the image is displayed on your desktop',
        });
        page.add(displayGroup);

        const optionsModel = Gtk.StringList.new([
            'Zoom (Remplir)',
            'Centered (Centrer)',
            'Scaled (Ajuster)',
            'Stretched (Étirer)',
            'Spanned (Étendre)',
            'None (Aucun)'
        ]);

        const optionsRow = new Adw.ComboRow({
            title: 'Image placement',
            model: optionsModel,
        });

        const currentOption = settings.get_string('picture-options');
        const optionsValues = ['zoom', 'centered', 'scaled', 'stretched', 'spanned', 'none'];
        const optionIndex = optionsValues.indexOf(currentOption);
        if (optionIndex !== -1) {
            optionsRow.selected = optionIndex;
        }

        optionsRow.connect('notify::selected', () => {
            settings.set_string('picture-options', optionsValues[optionsRow.selected]);
        });

        displayGroup.add(optionsRow);
    }
}
