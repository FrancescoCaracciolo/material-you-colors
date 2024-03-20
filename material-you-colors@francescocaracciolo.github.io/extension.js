/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init, PREFS_SCHEMA */

const WALLPAPER_SCHEMA = 'org.gnome.desktop.background';
const INTERFACE_SCHEMA = 'org.gnome.desktop.interface';
const SHELL_SCHEMA = 'org.gnome.shell.extensions.user-theme';
const PREFS_SCHEMA = 'org.gnome.shell.extensions.material-you-colors';

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gdk from 'gi://Gdk';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as theme_utils from './utils/theme_utils.js';
import * as color_utils from './utils/color_utils.js';
import * as string_utils from './utils/string_utils.js';
import * as ext_utils from './utils/ext_utils.js';
import {base_presets} from './base_presets.js';
import {color_mappings} from './color_mappings.js';


export default class MaterialYou extends Extension {
    constructor(uuid) {
        super(uuid);
        this._uuid = uuid;
        this.extensiondir = GLib.get_home_dir() + '/.local/share/gnome-shell/extensions/material-you-colors@francescocaracciolo.github.io'; 
    }

    enable() {
        this.initTranslations();
        this._interfaceSettings = this.getSettings(INTERFACE_SCHEMA);
        this._interfaceSettings.connect('changed::color-scheme', () => {
            this.apply_theme(base_presets, color_mappings, true);
        });
        this._wallpaperSettings = this.getSettings(WALLPAPER_SCHEMA);
        this._wallpaperSettings.connect('changed::picture-uri', () => {
            this.apply_theme(base_presets, color_mappings, true);
        });
        this._prefsSettings = this.getSettings(PREFS_SCHEMA);
        this._prefsSettings.connect('changed::scheme', () => {
            this.apply_theme(base_presets, color_mappings, true);
        });
        this._prefsSettings.connect('changed::accent-color', () => {
            this.apply_theme(base_presets, color_mappings, true);
        });
        this._prefsSettings.connect('changed::enable-accent-colors', () => {
            this.apply_theme(base_presets, color_mappings, true);
        });
        try {
            this._shellSettings = this.getSettings(SHELL_SCHEMA);
            this._shellSettings.connect('changed::name', () => {
                // log("shell settings theme changed");
                // log(this._shellSettings.get_string("name"));
                if (this._shellSettings.get_string("name") === "reset") {
                    this._shellSettings.set_string("name", "MaterialYou");
                }
            });
        } catch (e) {
            log(e);
        }

        this.apply_theme(base_presets, color_mappings);
    }

    disable() {
        this.remove_theme();
        this._interfaceSettings = null;
        this._wallpaperSettings = null;
        this._prefsSettings = null;
    }
    init(meta) {
        return new Extension(meta.uuid);
    }
    
    apply_theme(base_presets, color_mappings, notify=false) {
        // Get prefs
        const settings = this.getSettings(PREFS_SCHEMA);
        let shell_settings = null;
        let warn_shell_theme = false;
        try {
            shell_settings = this.getSettings(SHELL_SCHEMA);
        } catch(e) {
            log(e);
            warn_shell_theme = true;
        }
        const color_scheme = settings.get_string("scheme");
        const accent_color_enabled = settings.get_boolean("enable-accent-colors");
        const accent_color = settings.get_string("accent-color");
        const show_notifications = settings.get_boolean("show-notifications");
        const extra_command = settings.get_string("extra-command");
        const height = settings.get_int("resize-height");
        const width = settings.get_int("resize-width");
        const enable_pywal_theming = settings.get_boolean("enable-pywal-theming");

        let size = {height: height, width: width};
        let color_mappings_sel = color_mappings[color_scheme.toLowerCase()];
    
        // Checking dark theme preference
        let is_dark = false;
        let interface_settings = new Gio.Settings({ schema: INTERFACE_SCHEMA });
        let dark_pref = interface_settings.get_string('color-scheme');
        if (dark_pref === "prefer-dark") {
            is_dark = true;
        }
    
        // Getting Material theme from img
        let desktop_settings = new Gio.Settings({ schema: WALLPAPER_SCHEMA });
        let wall_uri_type = "";
        if (is_dark) {
            wall_uri_type = "-dark";
        }
        let wall_path = desktop_settings.get_string('picture-uri' + wall_uri_type);
        if (wall_path.includes("file://")) {
            wall_path = Gio.File.new_for_uri(wall_path).get_path();
        }
        let pix_buf = GdkPixbuf.Pixbuf.new_from_file_at_size(wall_path, size.width, size.height);
        let theme;
        if (accent_color_enabled) {
            theme = theme_utils.themeFromSourceColor(parseInt(accent_color), []);
        } else {
            theme = theme_utils.themeFromImage(pix_buf);
        }

    
        // Configuring for light or dark theme
        let scheme = theme.schemes.light.props;
        let base_preset = base_presets.light;
        let color_mapping = color_mappings_sel.light;
        let theme_str = _("Light");
        if (is_dark) {
            scheme = theme.schemes.dark.props;
            base_preset = base_presets.dark;
            color_mapping = color_mappings_sel.dark;
            theme_str = _("Dark");
        }
    
    
        // Overwriting keys in base_preset with material colors
    
        base_preset = this.map_colors(color_mapping, base_preset, scheme);
    
        // Generating gtk css from preset
        let css = "";
        for (const key in base_preset.variables) {
            css += "@define-color " + key + " " + base_preset.variables[key] + ";\n"
        }
        for (const prefix_key in base_preset.palette) {
            for (const key_2 in base_preset.palette[prefix_key]) {
                css += "@define-color " + prefix_key + key_2 + " " + base_preset.palette[prefix_key][key_2] + ";\n"
            }
        }
        // Actions after theme created
        if (enable_pywal_theming) {
          this.run_pywal(base_preset.variables["window_bg_color"], wall_path, is_dark)
        } 
        // Run custom command
        this.run_command(extra_command);
        let config_path = GLib.get_home_dir() + "/.config";
        this.create_dir(config_path + "/gtk-4.0");
        this.create_dir(config_path + "/gtk-3.0");
        this.write_str(css, config_path + "/gtk-4.0/gtk.css");
        this.write_str(css, config_path + "/gtk-3.0/gtk.css");
         
        if (ext_utils.check_npm(this.extensiondir)) {
            const version = Config.PACKAGE_VERSION.substring(0, 2);
    
          this.modify_colors(
            this.extensiondir + "/shell/" + version + "/gnome-shell-sass/_colors.txt",
            this.extensiondir + "/shell/" + version + "/gnome-shell-sass/_colors.scss",
            this.map_colors(
                color_mappings_sel.dark,
                base_presets.dark,
                theme.schemes.dark.props
            ).variables
          );
            this.create_dir_sync(GLib.get_home_dir() + "/.local/share/themes/MaterialYou");
            this.create_dir_sync(GLib.get_home_dir() + "/.local/share/themes/MaterialYou/gnome-shell");
            this.compile_sass(
                this.extensiondir + "/shell/" + version + "/gnome-shell.scss",
                GLib.get_home_dir() + "/.local/share/themes/MaterialYou/gnome-shell/gnome-shell.css",
                shell_settings
            );
        }
    
        // Notifying user on theme change
        if (notify && show_notifications) {
            if (warn_shell_theme) {
                Main.notify("Applied Material You " + color_scheme + " " + theme_str + " Theme",
                    "WARNING! Shell theme could not be applied automatically, Some apps may require re-logging in to update");
            } else {
                Main.notify("Applied Material You " + color_scheme + " " + theme_str + " Theme",
                    "Some apps may require re-logging in to update");
            }
        }
    }
    
    remove_theme() {
        // Undoing changes to theme when disabling extension
        this.delete_file(GLib.get_home_dir() + "/.config/gtk-4.0/gtk.css");
        this.delete_file(GLib.get_home_dir() + "/.config/gtk-3.0/gtk.css");
    
        // Get prefs
        // const settings = ExtensionUtils.getSettings(PREFS_SCHEMA);
        // const show_notifications = settings.get_boolean("show-notifications");
    
        // Notifying user on theme removal
        // Main.notify("Removed Material You Theme",
        // "Some apps may require re-logging in to update");
    }
    
    async create_dir(path) {
        const file = Gio.File.new_for_path(path);
        try {
            await new Promise((resolve, reject) => {
                file.make_directory_async(
                    GLib.PRIORITY_DEFAULT,
                    null,
                    (file_, result) => {
                        try {
                            resolve(file.make_directory_finish(result));
                        } catch (e) {
                            reject(e);
                        }
                    }
                );
            });
        } catch (e) {
            log(e);
        }
    }
    
    create_dir_sync(path) {
        const file = Gio.File.new_for_path(path);
        // Synchronous, blocking method
        try {
            file.make_directory(null);
        } catch(e) {
            log(e);
        }
    }
    
    async delete_file(path) {
        const file = Gio.File.new_for_path(path);
        try {
            await new Promise((resolve, reject) => {
                file.delete_async(
                    GLib.PRIORITY_DEFAULT,
                    null,
                    (file_, result) => {
                        try {
                            resolve(file.delete_finish(result));
                        } catch (e) {
                            reject(e);
                        }
                    }
                );
            });
        } catch (e) {
            log(e);
        }
    }
    
    async write_str(str, path) {
        const file = Gio.File.new_for_path(path);
        try {
            await new Promise((resolve, reject) => {
                file.replace_contents_bytes_async(
                    new GLib.Bytes(str),
                    null,
                    false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION,
                    null,
                    (file_, result) => {
                        try {
                            resolve(file.replace_contents_finish(result));
                        } catch (e) {
                            reject(e);
                        }
                    }
                );
            });
        } catch (e) {
            log(e);
        }
    }
    
    write_str_sync(str, path) {
        const file = Gio.File.new_for_path(path);
        const [, etag] = file.replace_contents(str, null, false,
        Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    }
    
    read_file(path) {
        const file = Gio.File.new_for_path(path);
        const [, contents, etag] = file.load_contents(null);
        const decoder = new TextDecoder('utf-8');
        const contentsString = decoder.decode(contents);
    
        return contentsString;
    }
    
    modify_colors(scss_path, output_path, vars) {
        let colors_template = this.read_file(scss_path);
        for (const key in vars) {
            colors_template = colors_template.replace("{{" + key + "}}", vars[key]);
        }
        this.write_str_sync(colors_template, output_path);
    }
    
    compile_sass(scss_path, output_path, shell_settings) {
    
        try {
            let proc = Gio.Subprocess.new(
                [this.extensiondir + '/node_modules/sass/sass.js', scss_path, output_path],
                Gio.SubprocessFlags.NONE
            );
    
            // NOTE: triggering the cancellable passed to these functions will only
            //       cancel the function NOT the process.
            let cancellable = new Gio.Cancellable();
    
            proc.wait_async(cancellable, (proc, result) => {
                try {
                    // Strictly speaking, the only error that can be thrown by this
                    // function is Gio.IOErrorEnum.CANCELLED.
                    proc.wait_finish(result);
    
                    // The process has completed and you can check the exit status or
                    // ignore it if you just need notification the process completed.
                    if (proc.get_successful()) {
                        // log('the process succeeded');
                        if (shell_settings != null) {
                            shell_settings.set_string("name", "reset");
                        }
                    } else {
                        // log('the process failed');
                    }
                } catch (e) {
                    logError(e);
                }
            });
        } catch (e) {
            logError(e);
        }
    }
    
    map_colors(color_mapping, base_preset, scheme) {
        let rgba_str;
        for (const key in color_mapping) {
            if (!Array.isArray(color_mapping[key])) {
                if (color_mapping[key].opacity == 1) {
                    base_preset.variables[key] = string_utils.hexFromArgb(
                        scheme[color_mapping[key].color]
                    );
                } else {
                    let argb = scheme[color_mapping[key].color];
                    let r = color_utils.redFromArgb(argb);
                    let g = color_utils.greenFromArgb(argb);
                    let b = color_utils.blueFromArgb(argb);
                    rgba_str =
                        "rgba(" +
                        r +
                        ", " +
                        g +
                        ", " +
                        b +
                        ", " +
                        color_mapping[key].opacity +
                        ")";
                    base_preset.variables[key] = rgba_str;
                }
            } else if (color_mapping[key].length > 0) {
                let total_color = scheme[color_mapping[key][0].color]; // Setting base color
                // Mixing in added colors
                for (let i = 1; i < color_mapping[key].length; i++) {
                    let argb = scheme[color_mapping[key][i].color];
                    let r = color_utils.redFromArgb(argb);
                    let g = color_utils.greenFromArgb(argb);
                    let b = color_utils.blueFromArgb(argb);
                    let a = color_mapping[key][i].opacity;
                    let added_color = color_utils.argbFromRgba(r, g, b, a);
                    total_color = color_utils.blendArgb(total_color, added_color);
                }
                base_preset.variables[key] = string_utils.hexFromArgb(total_color);
            }
        }
        return base_preset;
    }
    run_pywal(background, image, is_dark) {
      try {
          if (is_dark) {
              Gio.Subprocess.new(
                  ['wal', '-b', background, '-i', image, '-nqe'],
                  Gio.SubprocessFlags.NONE
              );
          } else {
              Gio.Subprocess.new(
                  ['wal', '-b', background, '-i', image, '-nqel'],
                  Gio.SubprocessFlags.NONE
              );
          }
      } catch (e) {
          logError(e);
      }
    }

    run_command(command) {
      try {
          Gio.Subprocess.new(
              ['bash', '-c', command],
              Gio.SubprocessFlags.NONE
          );
      } catch (e) {
          logError(e);
      }
  }
    
}