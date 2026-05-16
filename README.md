# Picture of the Day (Potd) - GNOME Extension

A GNOME Shell extension that automatically updates your wallpaper with daily images from Bing and Wikimedia Commons, featuring a minimalist credits overlay and automatic translation. 

<img src="potd-overview.png" alt="Picture of the day"/>

## Features

- **Automatic Rotation**: Switches between enabled image sources throughout the day.
  - Images provided by [Bing](https://www.bing.com) and [Wikimedia Commons](https://commons.wikimedia.org/)
- **Description Overlay**: Displays a minimalist info box on desktop with the image title, author, and copyright credits.

## Compatibility

| GNOME Shell Version | Supported |
|---------------------|-----------|
| 48                  | ✅        |
| 49                  | ✅        |
| 50                  | ✅        |


## Installation

### From Source

1. Clone this repository into your local extensions directory:
   ```bash
   git clone https://github.com/dmachard/gnome-shell-extension-potd.git ~/.local/share/gnome-shell/extensions/potd@dmachard.dev
   ```

2. Compile the settings schema:
   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/potd@dmachard.dev/schemas/
   ```

3. Restart GNOME Shell (or logout/login on Wayland) or run the following command
  ```bash
  dbus-run-session gnome-shell --nested --wayland
  ```

## Build for website

Developers Guide: https://gjs.guide/extensions/

Update the version in `metadata.json`
Zip and upload at  https://extensions.gnome.org/upload/

```bash
cd ~/.local/share/gnome-shell/extensions/potd@dmachard.dev

zip -r ~/potd@dmachard.dev.shell-extension.zip \
    extension.js \
    prefs.js \
    bing.js \
    wikimedia.js \
    overlay.js \
    provider.js \
    metadata.json \
    schemas/org.gnome.shell.extensions.potd.gschema.xml
```

Before uploading, you can run the Shexli static analyzer locally to catch common packaging and review issues early.

```bash
virtualenv venv
. venv/bin/activate
pip install -U shexli
shexli path_to_zip_or_folder
```