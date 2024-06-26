/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {Blend} from "../blend/blend.js";
import {CorePalette} from "../palettes/core_palette.js";
import {Scheme} from "../scheme/scheme.js";
import {sourceColorFromImage} from "./image_utils.js";
import {hexFromArgb} from "./string_utils.js";

/**
 * Generate a theme from a source color
 *
 * @param source Source color
 * @param customColors Array of custom colors
 * @return Theme object
 */
export function themeFromSourceColor(source, customColors = []) {
    const palette = new CorePalette(source);
    return {
        source,
        schemes: {
            light: Scheme.light(palette),
            dark: Scheme.dark(palette),
        },
        palettes: {
            primary: palette.a1,
            secondary: palette.a2,
            tertiary: palette.a3,
            neutral: palette.n1,
            neutralVariant: palette.n2,
            error: palette.error,
        },
        customColors: customColors.map((c) => customColor(source, c)),
    };
}
/**
 * Generate a theme from an image source
 *
 * @param image Image element
 * @param customColors Array of custom colors
 * @return Theme object
 */
export function themeFromImage(image, customColors = []) {
    const source = sourceColorFromImage(image);
    return themeFromSourceColor(source, customColors);
}
/**
 * Generate custom color group from source and target color
 *
 * @param source Source color
 * @param color Custom color
 * @return Custom color group
 *
 * @link https://m3.material.io/styles/color/the-color-system/color-roles
 */
export function customColor(source, color) {
    let value = color.value;
    const from = value;
    const to = source;
    if (color.blend) {
        value = Blend.harmonize(from, to);
    }
    const palette = new CorePalette(value);
    const tones = palette.a1;
    return {
        color,
        value,
        light: {
            color: tones.tone(40),
            onColor: tones.tone(100),
            colorContainer: tones.tone(90),
            onColorContainer: tones.tone(10),
        },
        dark: {
            color: tones.tone(80),
            onColor: tones.tone(20),
            colorContainer: tones.tone(30),
            onColorContainer: tones.tone(90),
        },
    };
}
/**
 * Apply a theme to an element
 *
 * @param theme Theme object
 * @param options Options
 */
export function applyTheme(theme, options) {
    var _a;
    const target = (options === null || options === void 0 ? void 0 : options.target) || document.body;
    const isDark = (_a = options === null || options === void 0 ? void 0 : options.dark) !== null && _a !== void 0 ? _a : false;
    const scheme = isDark ? theme.schemes.dark : theme.schemes.light;
    for (const [key, value] of Object.entries(scheme.toJSON())) {
        const token = key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
        const color = hexFromArgb(value);
        target.style.setProperty(`--md-sys-color-${token}`, color);
    }
}
//# sourceMappingURL=theme_utils.js.map