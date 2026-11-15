import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const BOX_WIDTH = 450;
const BOX_MARGIN = 20;
const PAD_H = 24;
const PAD_TOP = 14;
const PAD_BOTTOM = 14;
const GAP = 4;

const LABEL_WIDTH = BOX_WIDTH - PAD_H * 2;

function buildBoxStyle() {
    return [
        `background-color: rgba(25, 25, 25, 0.65)`,
        `border: 1px solid rgba(255, 255, 255, 0.2)`,
        `border-radius: 12px`,
        `padding: ${PAD_TOP}px ${PAD_H}px ${PAD_BOTTOM}px ${PAD_H}px`,
    ].join('; ') + ';';
}

const STYLE_TITLE = [
    `color: white`,
    `font-size: 18px`,
    `font-weight: bold`,
    `text-shadow: 0px 2px 4px rgba(0,0,0,0.5)`,
].join('; ') + ';';

const STYLE_SUBTITLE = [
    `color: rgba(255, 255, 255, 0.85)`,
    `font-size: 14px`,
    `font-weight: normal`,
    `margin-top: ${GAP}px`,
].join('; ') + ';';

export class Overlay {
    constructor() {
        this._container = null;
    }

    show(metadata) {
        this.hide();

        this._container = new St.BoxLayout({
            vertical: true,
            style: buildBoxStyle(),
            opacity: 0,
        });

        // Fixed width via Clutter — required in backgroundGroup
        this._container.set_width(BOX_WIDTH);

        // Title
        if (metadata.title) {
            const titleLabel = new St.Label({
                text: metadata.title,
                style: STYLE_TITLE,
            });
            titleLabel.set_width(LABEL_WIDTH);
            titleLabel.clutter_text.line_wrap = true;
            titleLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this._container.add_child(titleLabel);
        }

        // Description + Author
        const descParts = [];
        if (metadata.description) descParts.push(metadata.description.trim());
        if (metadata.author) {
            const clean = metadata.author.replace(/[©()]/g, '').trim();
            descParts.push(`© ${clean}`);
        }

        if (descParts.length > 0) {
            const descLabel = new St.Label({
                text: descParts.join('\n'),
                style: STYLE_SUBTITLE,
            });
            descLabel.set_width(LABEL_WIDTH);
            descLabel.clutter_text.line_wrap = true;
            descLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this._container.add_child(descLabel);
        }

        // backgroundGroup = behind windows, in front of wallpaper
        const bgGroup = Main.layoutManager.backgroundGroup
            ?? Main.layoutManager._backgroundGroup;
        bgGroup.add_child(this._container);

        // Position just below the top bar (more robust via Main.panel)
        const monitorGeom = Main.layoutManager.primaryMonitor
            ?? Main.layoutManager.monitors?.[0];
        const monitorX = monitorGeom ? monitorGeom.x : 0;
        const panel = Main.panel;
        const panelHeight = panel ? panel.height : 0;
        const panelY = panel ? panel.y : 0;

        this._container.set_position(
            monitorX + BOX_MARGIN,
            panelY + panelHeight + BOX_MARGIN,
        );

        // Since backgroundGroup is not a normal layout manager, it doesn't 
        // force height allocation for children during text wrapping.
        // We manually request the preferred height and apply it.
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            if (!this._container) return GLib.SOURCE_REMOVE;
            let [, natHeight] = this._container.get_preferred_height(BOX_WIDTH);
            this._container.set_height(natHeight);
            return GLib.SOURCE_REMOVE;
        });

        // Fading entrance
        this._container.ease({
            opacity: 255,
            duration: 800,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    hide() {
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
    }
}