# Picture of the Day (Potd) - GNOME Extension

A GNOME Shell extension that automatically updates your wallpaper with daily images from Bing and Wikimedia Commons, featuring a minimalist credits overlay. 

<img src="potd-overview.png" alt="Picture of the day"/>

## Features

- **Automatic Rotation**: Switches between enabled image sources throughout the day.
  - Images provided by [Bing](https://www.bing.com), [Wikimedia Commons](https://commons.wikimedia.org/), or Windows Spotlight
- **Description Overlay**: Displays a minimalist info box on desktop with the image title, author, and copyright credits.
- **Top Bar Menu**: Panel indicator for quick access to extension settings.

## Requirements

- GNOME Shell `48`, `49`, `50`, or `51`

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/dmachard/gnome-shell-extension-potd.git
   cd gnome-shell-extension-potd
   ```

2. Install the extension:
   ```bash
   ./install.sh
   ```

3. Restart GNOME Shell (or logout/login on Wayland), then enable the extension:
   ```bash
   gnome-extensions enable potd@dmachard.dev
   ```

### Local Testing

Run an isolated nested GNOME Shell session without touching your host configuration:
```bash
./test-local.sh
```

## Build for website

Developers Guide: https://gjs.guide/extensions/

Update the version in `metadata.json`
Zip and upload at  https://extensions.gnome.org/upload/

```bash
zip -r ~/potd@dmachard.dev.shell-extension.zip \
    extension.js \
    prefs.js \
    bing.js \
    wikimedia.js \
    spotlight.js \
    overlay.js \
    provider.js \
    metadata.json \
    icons \
    schemas/org.gnome.shell.extensions.potd.gschema.xml
```

Before uploading, you can run the Shexli static analyzer locally to catch common packaging and review issues early.

```bash
virtualenv venv
. venv/bin/activate
pip install -U shexli
shexli ~/potd@dmachard.dev.shell-extension.zip
```