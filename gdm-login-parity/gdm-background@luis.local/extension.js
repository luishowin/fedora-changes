import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GnomeDesktop from 'gi://GnomeDesktop';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

/*
 * GDM login screen, modelled on ~/Downloads/log in.svg (1920x1080):
 *
 *   - live-blurred wallpaper with a 20% black scrim
 *   - one avatar/name pill at the centre
 *   - click the avatar: the pill and a password pill sit side by side
 *   - a large time/date above the pill, faded out once authentication starts
 *   - one "Options" menu at the bottom right
 *
 * The greeter is a separate gnome-shell --mode=gdm process.  Its LoginDialog
 * is not the user session's UnlockDialog, so this extension uses the greeter's
 * own actors and a few internal properties.  Every optional step is guarded:
 * if an internal name disappears in a future Shell version, stock GDM login
 * still works.
 */

const BLUR_RADIUS = 10;
const CLOCK_FADE_TIME = 250;
const CLOCK_TOP_FRACTION = 0.185;
const DIALOG_RETRY_MS = 50;
const DIALOG_RETRY_LIMIT = 200;

const BACKGROUND_SCHEMA = 'org.gnome.desktop.background';
const INTERFACE_SCHEMA = 'org.gnome.desktop.interface';
const A11Y_INTERFACE_SCHEMA = 'org.gnome.desktop.a11y.interface';
const A11Y_APPLICATIONS_SCHEMA = 'org.gnome.desktop.a11y.applications';
const A11Y_KEYBOARD_SCHEMA = 'org.gnome.desktop.a11y.keyboard';
const WM_SCHEMA = 'org.gnome.desktop.wm.preferences';

const LIVE_BACKGROUND_CLASS = 'gdm-live-background';
const OPTIONS_SECTION = '';

export default class GdmLoginExtension extends Extension {
    enable() {
        this._settings = [];
        this._backgroundManagers = [];
        this._dialogAttempts = 0;
        this._dialogTimeoutId = 0;
        this._dialog = null;
        this._authPrompt = null;
        this._notListedButton = null;
        this._authButton = null;
        this._a11yButton = null;
        this._dateMenu = null;
        this._dateMenuWasVisible = false;
        this._dateMenuHidden = false;
        this._liveBackground = false;
        this._backgroundWidget = null;
        this._scrim = null;
        this._clock = null;
        this._wallClock = null;
        this._themeContext = null;
        this._screenShieldGroup = null;
        this._lockDialogGroup = null;
        this._backgroundSettings = null;
        this._interfaceSettings = null;

        this._setupBackground();
        this._setupClock();
        this._hidePanelClock();
        this._watchForDialog();

        Main.layoutManager.connectObject(
            'startup-complete', () => this._hidePanelClock(), this);
    }

    disable() {
        if (this._dialogTimeoutId) {
            GLib.source_remove(this._dialogTimeoutId);
            this._dialogTimeoutId = 0;
        }

        if (this._wallClock) {
            this._wallClock.run_dispose();
            this._wallClock = null;
        }

        if (this._interfaceSettings) {
            try {
                this._interfaceSettings.disconnectObject(this);
            } catch {
            }
            this._interfaceSettings = null;
        }

        if (this._clock) {
            this._clock.remove_all_transitions();
            this._clock.destroy();
            this._clock = null;
        }

        this._destroyBackground();

        if (this._scrim) {
            this._scrim.destroy();
            this._scrim = null;
        }

        if (this._themeContext) {
            try {
                this._themeContext.disconnectObject(this);
            } catch {
            }
            this._themeContext = null;
        }

        if (this._screenShieldGroup) {
            try {
                this._screenShieldGroup.disconnectObject(this);
            } catch {
            }
        }

        if (this._authPrompt) {
            try {
                this._authPrompt.disconnectObject(this);
            } catch {
            }
        }

        if (this._dialog?._userList) {
            try {
                this._dialog._userList.disconnectObject(this);
            } catch {
            }
        }

        if (this._notListedButton) {
            try {
                this._notListedButton.disconnectObject(this);
            } catch {
            }
        }

        if (this._lockDialogGroup)
            this._lockDialogGroup.remove_style_class_name(LIVE_BACKGROUND_CLASS);

        if (this._dateMenu && this._dateMenuHidden && this._dateMenuWasVisible) {
            try {
                const container = this._dateMenu.container ?? this._dateMenu;
                container?.show();
            } catch {
            }
        }

        if (this._a11yButton) {
            try {
                this._a11yButton.show();
            } catch {
            }
        }

        if (this._authButton) {
            try {
                this._authButton.disconnectObject(this);
            } catch {
            }
            try {
                this._authButton.set_child(null);
                this._authButton.set_icon_name('cog-wheel-symbolic');
            } catch {
            }
        }

        try {
            Main.layoutManager.disconnectObject(this);
        } catch {
        }

        this._dialog = null;
        this._authPrompt = null;
        this._authButton = null;
        this._a11yButton = null;
        this._notListedButton = null;
        this._dateMenu = null;
        this._screenShieldGroup = null;
        this._lockDialogGroup = null;
        this._settings = [];
    }

    /* ------------------------------------------------------------------ */
    /* Background                                                          */
    /* ------------------------------------------------------------------ */

    _setupBackground() {
        if (!Main.layoutManager)
            return;

        const group = Main.layoutManager.screenShieldGroup;
        const monitor = Main.layoutManager.primaryMonitor;
        if (!group || !monitor)
            return;

        this._screenShieldGroup = group;

        const settings = new Gio.Settings({schema_id: BACKGROUND_SCHEMA});
        this._backgroundSettings = settings;

        let uri = settings.get_string('picture-uri-dark');
        if (!uri)
            uri = settings.get_string('picture-uri');
        if (!uri)
            return;

        const file = Gio.File.new_for_uri(uri);
        if (!file.query_exists(null)) {
            console.warn(`gdm-login: wallpaper not found: ${uri}`);
            return;
        }

        this._createBackgroundActor();

        this._scrim = new St.Widget({
            name: 'gdm-login-scrim',
            style_class: 'gdm-login-scrim',
            reactive: false,
        });
        group.insert_child_at_index(this._scrim, 1);

        this._layoutBackgroundOverlays();

        this._themeContext = St.ThemeContext.get_for_stage(global.stage);
        this._themeContext.connectObject(
            'notify::scale-factor', () => this._updateBlur(), this);

        Main.layoutManager.connectObject('monitors-changed', () => {
            this._destroyBackgroundActor();
            this._createBackgroundActor();
            this._layoutBackgroundOverlays();
            this._updateClockPosition();
        }, this);
    }

    _createBackgroundActor() {
        if (!this._screenShieldGroup)
            return;

        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;

        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        const effect = new Shell.BlurEffect({
            name: 'blur',
            radius: BLUR_RADIUS * themeContext.scaleFactor,
        });

        const widget = new St.Widget({
            name: 'gdm-login-background',
            style_class: 'screen-shield-background',
            x: 0,
            y: 0,
            width: monitor.width,
            height: monitor.height,
            reactive: false,
            effect,
        });

        this._screenShieldGroup.insert_child_at_index(widget, 0);
        this._backgroundWidget = widget;

        const manager = new Background.BackgroundManager({
            container: widget,
            monitorIndex: Main.layoutManager.primaryIndex,
            controlPosition: false,
        });

        this._backgroundManagers.push(manager);
        manager.connect('loaded', () => this._activateLiveBackground());
        this._updateBlur();
    }

    _destroyBackgroundActor() {
        for (const manager of this._backgroundManagers) {
            try {
                manager.destroy();
            } catch {
            }
        }
        this._backgroundManagers = [];

        if (this._backgroundWidget) {
            this._backgroundWidget.destroy();
            this._backgroundWidget = null;
        }
    }

    _destroyBackground() {
        this._destroyBackgroundActor();

        if (this._backgroundSettings) {
            this._backgroundSettings = null;
        }
    }

    _updateBlur() {
        if (!this._backgroundWidget)
            return;

        const effect = this._backgroundWidget.get_effect('blur');
        if (!effect)
            return;

        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        effect.set({radius: BLUR_RADIUS * themeContext.scaleFactor});
    }

    _layoutBackgroundOverlays() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;

        if (this._backgroundWidget) {
            this._backgroundWidget.set_position(0, 0);
            this._backgroundWidget.set_size(monitor.width, monitor.height);
        }

        if (this._scrim) {
            this._scrim.set_position(0, 0);
            this._scrim.set_size(monitor.width, monitor.height);
        }
    }

    _activateLiveBackground() {
        if (this._liveBackground)
            return;

        this._liveBackground = true;
        this._lockDialogGroup = Main.screenShield?._lockDialogGroup ?? null;
        if (this._lockDialogGroup)
            this._lockDialogGroup.add_style_class_name(LIVE_BACKGROUND_CLASS);
    }

    /* ------------------------------------------------------------------ */
    /* Clock                                                               */
    /* ------------------------------------------------------------------ */

    _setupClock() {
        if (!Main.layoutManager)
            return;

        const group = Main.layoutManager.screenShieldGroup;
        if (!group)
            return;

        this._screenShieldGroup = group;

        this._clock = new St.BoxLayout({
            name: 'gdm-login-clock',
            style_class: 'gdm-login-clock',
            orientation: Clutter.Orientation.VERTICAL,
            reactive: false,
        });

        this._timeLabel = new St.Label({
            style_class: 'gdm-login-clock-time',
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._dateLabel = new St.Label({
            style_class: 'gdm-login-clock-date',
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._clock.add_child(this._timeLabel);
        this._clock.add_child(this._dateLabel);
        group.add_child(this._clock);

        this._interfaceSettings = new Gio.Settings({schema_id: INTERFACE_SCHEMA});
        this._interfaceSettings.connectObject(
            'changed::clock-format', () => this._updateClock(), this);

        this._wallClock = new GnomeDesktop.WallClock({time_only: true});
        this._wallClock.connectObject(
            'notify::clock', () => this._updateClock(), this);

        this._updateClock();
        this._syncClockVisibility();

        group.connectObject(
            'notify::allocation', () => this._updateClockPosition(), this);
    }

    _updateClock() {
        if (!this._clock || !this._wallClock)
            return;

        const date = GLib.DateTime.new_now_local();
        const clockFormat = this._interfaceSettings?.get_string('clock-format');
        this._timeLabel.text = date.format(
            clockFormat === '12h' ? '%-I:%M' : '%H:%M');
        this._dateLabel.text = date.format('%A %-d %B');

        this._clock.queue_relayout();
        this._updateClockPosition();
    }

    _updateClockPosition() {
        if (!this._clock)
            return;

        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;

        const group = this._screenShieldGroup;
        const width = group?.width || monitor.width;
        const height = group?.height || monitor.height;

        const [, natWidth] = this._clock.get_preferred_width(-1);
        this._clock.set_position(
            Math.round((width - natWidth) / 2),
            Math.round(height * CLOCK_TOP_FRACTION));
    }

    _syncClockVisibility() {
        if (!this._clock)
            return;

        const hide = !!this._authPrompt?.visible;
        this._clock.remove_all_transitions();

        if (hide) {
            this._clock.ease({
                opacity: 0,
                duration: CLOCK_FADE_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    if (this._authPrompt?.visible)
                        this._clock.hide();
                },
            });
        } else {
            this._clock.show();
            this._clock.ease({
                opacity: 255,
                duration: CLOCK_FADE_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
    }

    /* ------------------------------------------------------------------ */
    /* Panel                                                               */
    /* ------------------------------------------------------------------ */

    _hidePanelClock() {
        const dateMenu = Main.panel?.statusArea?.dateMenu;
        if (!dateMenu)
            return;

        if (!this._dateMenu)
            this._dateMenu = dateMenu;

        const container = dateMenu.container ?? dateMenu;
        if (!container)
            return;

        if (container.visible) {
            this._dateMenuWasVisible = true;
            container.hide();
        }
        this._dateMenuHidden = true;
    }

    /* ------------------------------------------------------------------ */
    /* LoginDialog                                                        */
    /* ------------------------------------------------------------------ */

    _watchForDialog() {
        const attempt = () => {
            const dialog = Main.screenShield?._dialog ?? null;
            if (dialog) {
                this._dialogTimeoutId = 0;
                this._dialog = dialog;
                this._setupDialog(dialog);
                return GLib.SOURCE_REMOVE;
            }

            if (++this._dialogAttempts >= DIALOG_RETRY_LIMIT) {
                console.warn('gdm-login: LoginDialog did not appear');
                this._dialogTimeoutId = 0;
                return GLib.SOURCE_REMOVE;
            }

            return GLib.SOURCE_CONTINUE;
        };

        if (attempt() === GLib.SOURCE_CONTINUE)
            this._dialogTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT, DIALOG_RETRY_MS, attempt);
    }

    _setupDialog(dialog) {
        this._dialog = dialog;
        this._authPrompt = dialog._authPrompt ?? null;

        if (this._liveBackground)
            this._lockDialogGroup?.add_style_class_name(LIVE_BACKGROUND_CLASS);

        if (dialog._logoBin)
            dialog._logoBin.hide();

        if (dialog._userList) {
            dialog._userList.connectObject(
                'item-added', (_list, item) => this._styleUserItem(item), this);
            for (const item of dialog._userList._items.values())
                this._styleUserItem(item);
        }

        this._setupSingleUserLink(dialog);

        if (this._authPrompt) {
            this._authPrompt.connectObject(
                'notify::visible', () => {
                    this._styleAuthPrompt();
                    this._syncClockVisibility();
                }, this);

            this._authPrompt.connectObject(
                'prompted', () => {
                    this._styleAuthPrompt();
                    this._syncClockVisibility();
                }, this);

            this._styleAuthPrompt();
        }

        this._setupOptions(dialog);
        this._syncClockVisibility();
    }

    _setupSingleUserLink(dialog) {
        const button = dialog._notListedButton;
        if (!button)
            return;

        this._notListedButton = button;

        let userCount = 1;
        try {
            userCount = dialog._userManager.list_users().length;
        } catch {
        }

        if (userCount > 1)
            return;

        const hide = () => {
            if (button.visible)
                button.hide();
        };

        button.connectObject('notify::visible', hide, this);
        hide();
    }

    _styleUserItem(item) {
        if (!item)
            return;

        item.x_expand = false;
        item.x_align = Clutter.ActorAlign.CENTER;

        const layout = item.get_first_child();
        if (!layout)
            return;

        layout.x_expand = false;
        layout.x_align = Clutter.ActorAlign.CENTER;

        const userWidget = layout.get_first_child();
        if (!userWidget)
            return;

        userWidget.orientation = Clutter.Orientation.HORIZONTAL;
        userWidget.remove_style_class_name('vertical');
        userWidget.add_style_class_name('horizontal');
        userWidget.x_align = Clutter.ActorAlign.CENTER;
    }

    _styleAuthPrompt() {
        const prompt = this._authPrompt;
        if (!prompt)
            return;

        prompt.orientation = Clutter.Orientation.HORIZONTAL;
        prompt.x_expand = false;
        prompt.y_expand = false;
        prompt.x_align = Clutter.ActorAlign.CENTER;
        prompt.translation_y = -50;

        const userWell = prompt._userWell;
        if (userWell) {
            userWell.x_expand = false;
            userWell.y_expand = false;
            userWell.x_align = Clutter.ActorAlign.START;
            userWell.y_align = Clutter.ActorAlign.CENTER;

            const userWidget = userWell.get_child();
            if (userWidget) {
                userWidget.orientation = Clutter.Orientation.HORIZONTAL;
                userWidget.remove_style_class_name('vertical');
                userWidget.add_style_class_name('horizontal');
                userWidget.x_align = Clutter.ActorAlign.CENTER;
            }

            if (!userWell._gdmClickAction) {
                userWell.reactive = true;
                const gesture = new Clutter.ClickGesture();
                gesture.connect('recognize', () => {
                    try {
                        prompt.cancel();
                    } catch (e) {
                        logError(e, 'gdm-login: cancel');
                    }
                });
                userWell.add_action(gesture);
                userWell._gdmClickAction = gesture;
            }
        }

        const inputWell = prompt._inputWell;
        if (inputWell) {
            inputWell.x_expand = false;
            inputWell.y_expand = false;
            inputWell.x_align = Clutter.ActorAlign.START;
            inputWell.y_align = Clutter.ActorAlign.START;
        }

        // The stock peek icon sits between the hint and the submit chevron in
        // this compact pill and truncates the placeholder.  Keep the entry
        // itself; drop only the eye.
        for (const entry of [prompt._passwordEntry, prompt._entry]) {
            if (entry && entry.show_peek_icon !== undefined)
                entry.show_peek_icon = false;
        }

        const message = prompt._message;
        if (message && !message._gdmSyncMessage) {
            const sync = () => {
                message.visible = !!message.text && message.opacity > 0;
            };
            message.connect('notify::text', sync);
            message.connect('notify::opacity', sync);
            message._gdmSyncMessage = true;
            sync();
        } else if (message) {
            message.visible = !!message.text && message.opacity > 0;
        }

        const cancel = prompt.cancelButton;
        if (cancel) {
            if (!cancel._gdmHidden) {
                cancel.connect('notify::visible', () => {
                    if (cancel.visible)
                        cancel.hide();
                });
                cancel._gdmHidden = true;
            }
            cancel.hide();
        }
    }

    /* ------------------------------------------------------------------ */
    /* Options                                                             */
    /* ------------------------------------------------------------------ */

    _setupOptions(dialog) {
        const authButton = dialog._authMenuButton;
        if (!authButton)
            return;

        try {
            const box = new St.BoxLayout({
                style_class: 'gdm-options-button-box',
                orientation: Clutter.Orientation.HORIZONTAL,
                y_align: Clutter.ActorAlign.CENTER,
            });
            box.add_child(new St.Label({
                text: _('Options'),
                style_class: 'gdm-options-label',
                y_align: Clutter.ActorAlign.CENTER,
            }));
            box.add_child(new St.Icon({
                icon_name: 'go-next-symbolic',
                style_class: 'gdm-options-chevron',
                y_align: Clutter.ActorAlign.CENTER,
            }));
            authButton.set_child(box);

            // AuthMenuButton only shows a section when it has more than one
            // item, so keep the three actions in one section.
            authButton.addItem({
                id: 'switch-user',
                name: _('Switch User…'),
                sectionName: OPTIONS_SECTION,
            });
            authButton.addItem({
                id: 'restart',
                name: _('Restart…'),
                sectionName: OPTIONS_SECTION,
            });
            authButton.addItem({
                id: 'power-off',
                name: _('Power Off…'),
                sectionName: OPTIONS_SECTION,
            });

            authButton.connectObject('active-item-changed', (_button, sectionName) => {
                if (sectionName !== OPTIONS_SECTION)
                    return;

                const item = authButton.getActiveItem({
                    sectionName: OPTIONS_SECTION,
                });
                authButton.closeMenu();

                if (!item)
                    return;

                if (item.id === 'switch-user')
                    this._switchUser();
                else if (item.id === 'restart')
                    this._activateSystemAction('reboot');
                else if (item.id === 'power-off')
                    this._activateSystemAction('power-off');
            }, this);

            this._addOptionsItems(authButton._menu);
            this._authButton = authButton;

            if (dialog._a11yMenuButton) {
                this._a11yButton = dialog._a11yMenuButton;
                this._a11yButton.hide();
            }
        } catch (e) {
            logError(e, 'gdm-login: options setup');
        }
    }

    _switchUser() {
        if (this._authPrompt?.visible) {
            try {
                this._authPrompt.cancel();
            } catch (e) {
                logError(e, 'gdm-login: switch user');
            }
        }

        try {
            this._dialog?._showUserList();
        } catch (e) {
            logError(e, 'gdm-login: show user list');
        }
    }

    _addOptionsItems(menu) {
        if (!menu)
            return;

        const a11yHeader = new PopupMenu.PopupMenuItem(_('Accessibility'), {
            reactive: false,
            can_focus: false,
        });
        a11yHeader.add_style_class_name('gdm-options-header');
        menu.addMenuItem(a11yHeader);

        this._addBoolSwitch(menu, _('High Contrast'),
            A11Y_INTERFACE_SCHEMA, 'high-contrast');
        this._addBoolSwitch(menu, _('Zoom'),
            A11Y_APPLICATIONS_SCHEMA, 'screen-magnifier-enabled');
        this._addLargeTextSwitch(menu);
        this._addBoolSwitch(menu, _('Screen Reader'),
            A11Y_APPLICATIONS_SCHEMA, 'screen-reader-enabled');
        this._addBoolSwitch(menu, _('Screen Keyboard'),
            A11Y_APPLICATIONS_SCHEMA, 'screen-keyboard-enabled');
        this._addBoolSwitch(menu, _('Visual Alerts'),
            WM_SCHEMA, 'visual-bell');
        this._addBoolSwitch(menu, _('Sticky Keys'),
            A11Y_KEYBOARD_SCHEMA, 'stickykeys-enable');
        this._addBoolSwitch(menu, _('Slow Keys'),
            A11Y_KEYBOARD_SCHEMA, 'slowkeys-enable');
        this._addBoolSwitch(menu, _('Bounce Keys'),
            A11Y_KEYBOARD_SCHEMA, 'bouncekeys-enable');
        this._addBoolSwitch(menu, _('Mouse Keys'),
            A11Y_KEYBOARD_SCHEMA, 'mousekeys-enable');
    }

    _activateSystemAction(action) {
        try {
            SystemActions.getDefault().activateAction(action);
        } catch (e) {
            logError(e, `gdm-login: ${action}`);
        }
    }

    _addBoolSwitch(menu, label, schema, key) {
        const settings = new Gio.Settings({schema_id: schema});
        const item = new PopupMenu.PopupSwitchMenuItem(
            label, settings.get_boolean(key));

        settings.connectObject(`changed::${key}`, () => {
            item.setToggleState(settings.get_boolean(key));
        }, item);

        item.connect('toggled', (_item, state) => {
            settings.set_boolean(key, state);
        });

        menu.addMenuItem(item);
        this._settings.push(settings);
    }

    _addLargeTextSwitch(menu) {
        const settings = new Gio.Settings({schema_id: INTERFACE_SCHEMA});
        const factor = 'text-scaling-factor';
        const item = new PopupMenu.PopupSwitchMenuItem(
            _('Large Text'), settings.get_double(factor) > 1.0);

        settings.connectObject(`changed::${factor}`, () => {
            item.setToggleState(settings.get_double(factor) > 1.0);
        }, item);

        item.connect('toggled', (_item, state) => {
            if (state)
                settings.set_double(factor, 1.25);
            else
                settings.reset(factor);
        });

        menu.addMenuItem(item);
        this._settings.push(settings);
    }
}
