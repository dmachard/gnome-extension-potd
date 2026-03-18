# Picture of the Day (Potd) - GNOME Extension

A GNOME Shell extension that automatically updates your wallpaper with daily images from Bing and Wikimedia Commons, featuring a minimalist credits overlay and automatic translation. 

<img src="potd-overview.png" alt="Live-RADIO" width="200"/>

## Features

- **Automatic Rotation**: Switches between enabled image sources throughout the day.
  - Images provided by [Bing](https://www.bing.com) and [Wikimedia Commons](https://commons.wikimedia.org/)
- **Description Overlay**: Displays a minimalist info box on desktop with the image title, author, and copyright credits.
- **Localization & Translation**:
  - Supports multiple languages for the UI.
  - Features **Automatic Translation** of image descriptions into your local language (using the MyMemory API).

## Compatibility

| GNOME Shell Version | Supported |
|---------------------|-----------|
| 48                  | ✅        |
| 49                  | ✅        |


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
