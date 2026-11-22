import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class DailyPhotoPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

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

        const spotlightRow = new Adw.SwitchRow({
            title: 'Windows Spotlight',
            subtitle: 'Include new images from Windows Spotlight',
        });
        settings.bind('enable-spotlight', spotlightRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        autoGroup.add(spotlightRow);

        // Display Group
        const displayGroup = new Adw.PreferencesGroup({
            title: 'Display',
            description: 'Configure how the image is displayed on your desktop',
        });
        page.add(displayGroup);

        const optionsModel = Gtk.StringList.new([
            'Zoom',
            'Centered',
            'Scaled',
            'Stretched',
            'Spanned',
            'None'
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

        // Downloads Group
        const downloadsGroup = new Adw.PreferencesGroup({
            title: 'Downloads',
        });
        page.add(downloadsGroup);

        const defaultDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'daily-scenery']);
        const getActiveDir = () => settings.get_string('download-folder') || defaultDir;

        const folderRow = new Adw.ActionRow({
            title: 'Download folder',
            subtitle: getActiveDir(),
        });

        const openButton = new Gtk.Button({
            label: 'Open folder',
            valign: Gtk.Align.CENTER,
        });
        openButton.connect('clicked', () => {
            const dirPath = getActiveDir();
            GLib.mkdir_with_parents(dirPath, 0o755);
            const launcher = Gtk.FileLauncher.new(Gio.File.new_for_path(dirPath));
            launcher.launch(window, null, null);
        });

        const changeButton = new Gtk.Button({
            label: 'Change folder',
            valign: Gtk.Align.CENTER,
        });
        changeButton.connect('clicked', () => {
            const dialog = new Gtk.FileDialog({
                title: 'Select Download Folder',
                initial_folder: Gio.File.new_for_path(getActiveDir()),
            });
            dialog.select_folder(window, null, (dlg, result) => {
                try {
                    const file = dlg.select_folder_finish(result);
                    const path = file?.get_path();
                    if (path) {
                        settings.set_string('download-folder', path);
                        folderRow.subtitle = path;
                    }
                } catch (_e) {
                    // User cancelled dialog
                }
            });
        });

        folderRow.add_suffix(openButton);
        folderRow.add_suffix(changeButton);
        downloadsGroup.add(folderRow);
    }
}
