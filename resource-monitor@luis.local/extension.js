import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {
    cpuUsage,
    driveLabel,
    formatBytes,
    formatRate,
    parseCpuLine,
    parseDefaultRoute,
    parseMeminfo,
    parseMounts,
    parseNetDev,
    percentOf,
} from './metrics.js';

const POLL_SECONDS = 1;
const STORAGE_EVERY_TICKS = 10;
const DRIVES_EVERY_TICKS = 30;

export default class ResourceMonitorExtension extends Extension {
    enable() {
        this._active = true;
        this._warnedPaths = new Set();
        this._settings = this.getSettings();
        this._settingsChangedId = 0;
        this._show = null;
        this._files = {
            stat: Gio.File.new_for_path('/proc/stat'),
            meminfo: Gio.File.new_for_path('/proc/meminfo'),
            route: Gio.File.new_for_path('/proc/net/route'),
            netdev: Gio.File.new_for_path('/proc/net/dev'),
            mounts: Gio.File.new_for_path('/proc/mounts'),
        };

        this._previousCpu = null;
        this._cpuUsage = null;
        this._memory = null;
        this._netIface = null;
        this._previousNet = null;
        this._previousNetTime = 0;
        this._rxRate = null;
        this._txRate = null;
        this._storage = null;
        this._drives = [];
        this._tick = 0;
        this._timeoutId = 0;
        this._menuOpenId = 0;
        this._mountSignalIds = [];

        this._settingsChangedId = this._settings.connect('changed',
            (_settings, key) => {
                if (key.startsWith('show-'))
                    this._applyVisibility();
            });

        this._buildIndicator();
        this._buildMenu();
        this._applyVisibility();

        this._volumeMonitor = Gio.VolumeMonitor.get();
        this._mountSignalIds = [
            'mount-added',
            'mount-removed',
            'mount-changed',
        ].map(signal => this._volumeMonitor.connect(signal, () => {
            this._refreshDrives();
            this._updateMenu();
        }));

        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            POLL_SECONDS,
            () => {
                if (!this._active)
                    return GLib.SOURCE_REMOVE;

                this._refresh();
                return GLib.SOURCE_CONTINUE;
            });
    }

    disable() {
        this._active = false;

        if (this._settings && this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }
        this._settings = null;
        this._show = null;

        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        if (this._volumeMonitor) {
            for (const signalId of this._mountSignalIds)
                this._volumeMonitor.disconnect(signalId);
        }
        this._mountSignalIds = [];
        this._volumeMonitor = null;

        if (this._indicator) {
            if (this._menuOpenId)
                this._indicator.menu.disconnect(this._menuOpenId);
            this._menuOpenId = 0;

            this._indicator.destroy();
            this._indicator = null;
        }

        this._files = null;
        this._menuRows = null;
        this._panelMetrics = null;
        this._placeholder = null;
        this._drivesHeader = null;
        this._drivesSection = null;
        this._settingsItem = null;
        this._settingsSeparator = null;
        this._cpuValue = null;
        this._ramValue = null;
        this._storageValue = null;
        this._netValue = null;
        this._storage = null;
        this._drives = [];
    }

    _buildIndicator() {
        this._indicator = new PanelMenu.Button(0.5, 'Resource Monitor', false);
        this._indicator.add_style_class_name('resource-monitor');

        const box = new St.BoxLayout({
            style_class: 'resource-monitor-box',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._indicator.add_child(box);

        this._panelMetrics = {
            cpu: this._addMetric(box, 'CPU'),
            memory: this._addMetric(box, 'RAM'),
            storage: this._addMetric(box, 'DISK'),
            network: this._addNetworkMetric(box),
        };

        this._placeholder = new St.Label({
            text: 'MON',
            style_class: 'resource-monitor-placeholder',
            visible: false,
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._placeholder);

        this._cpuValue = this._panelMetrics.cpu.value;
        this._ramValue = this._panelMetrics.memory.value;
        this._storageValue = this._panelMetrics.storage.value;
        this._netValue = this._panelMetrics.network.value;

        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');

        // The Shell destroys the panel while shutting down, possibly before
        // the extension's disable() runs. Stop touching labels once that
        // happens instead of logging "object has already been disposed".
        this._indicator.connect('destroy', () => {
            this._active = false;
        });

        this._menuOpenId = this._indicator.menu.connect('open-state-changed',
            (_menu, isOpen) => {
                if (!isOpen)
                    return;

                if (this._show?.storage)
                    this._refreshStorage();
                if (this._show?.disks)
                    this._refreshDrives();
                this._updatePanel();
                this._updateMenu();
            });
    }

    _addMetric(parent, label) {
        const separator = this._addSeparator(parent);

        const metric = new St.BoxLayout({
            style_class: 'resource-monitor-metric',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const name = new St.Label({
            text: label,
            style_class: 'resource-monitor-name',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const value = new St.Label({
            text: '—',
            style_class: 'resource-monitor-value',
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
        });

        metric.add_child(name);
        metric.add_child(value);
        parent.add_child(metric);

        return {
            box: metric,
            separator,
            value,
        };
    }

    _addNetworkMetric(parent) {
        const separator = this._addSeparator(parent);

        const metric = new St.BoxLayout({
            style_class: 'resource-monitor-metric',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const value = new St.Label({
            text: '↓— ↑—',
            style_class: 'resource-monitor-value resource-monitor-net',
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
        });

        metric.add_child(value);
        parent.add_child(metric);

        return {
            box: metric,
            separator,
            value,
        };
    }

    _addSeparator(parent) {
        const separator = new St.Widget({
            style_class: 'resource-monitor-separator',
            y_align: Clutter.ActorAlign.CENTER,
        });
        parent.add_child(separator);

        return separator;
    }

    _buildMenu() {
        const menu = this._indicator.menu;
        menu.removeAll();
        this._menuRows = {};

        this._addMenuRow('CPU', 'cpu');
        this._addMenuRow('RAM', 'ram');
        this._addMenuRow('Network', 'network');
        this._addMenuRow('Storage', 'storage');

        this._drivesHeader = new PopupMenu.PopupSeparatorMenuItem('Disks');
        menu.addMenuItem(this._drivesHeader);

        this._drivesSection = new PopupMenu.PopupMenuSection();
        menu.addMenuItem(this._drivesSection);

        this._settingsSeparator = new PopupMenu.PopupSeparatorMenuItem();
        menu.addMenuItem(this._settingsSeparator);

        this._settingsItem = new PopupMenu.PopupMenuItem('Settings');
        this._settingsItem.connect('activate', () => this.openPreferences());
        menu.addMenuItem(this._settingsItem);
    }

    _applyVisibility() {
        if (!this._active || !this._settings || !this._panelMetrics ||
            !this._menuRows)
            return;

        const previous = this._show;
        const next = {
            cpu: this._settings.get_boolean('show-cpu'),
            memory: this._settings.get_boolean('show-memory'),
            storage: this._settings.get_boolean('show-storage'),
            network: this._settings.get_boolean('show-network'),
            disks: this._settings.get_boolean('show-disks'),
        };
        this._show = next;

        let firstVisible = true;
        for (const key of ['cpu', 'memory', 'storage', 'network']) {
            const record = this._panelMetrics[key];
            const visible = next[key];

            record.box.visible = visible;
            record.separator.visible = visible && !firstVisible;
            if (visible)
                firstVisible = false;
        }
        this._placeholder.visible = firstVisible;

        for (const key of ['cpu', 'memory', 'network', 'storage']) {
            const row = this._menuRows[key];
            if (row)
                row.item.visible = next[key];
        }

        this._drivesHeader.visible = next.disks;
        this._drivesSection.actor.visible = next.disks;

        const hasMenuDetails = next.cpu || next.memory || next.network ||
            next.storage || next.disks;
        this._settingsSeparator.visible = hasMenuDetails;
        this._settingsItem.visible = true;

        if (next.memory && !previous?.memory)
            this._refreshMemory();
        if (next.storage && !previous?.storage)
            this._refreshStorage();
        if (next.disks && !previous?.disks)
            this._refreshDrives();
        if (next.cpu && !previous?.cpu) {
            this._cpuUsage = null;
            this._primeCpu();
        }
        if (next.network && !previous?.network)
            this._primeNetwork();

        this._updatePanel();
        this._updateMenu();
    }

    _addMenuRow(label, key) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        const row = new St.BoxLayout({
            style_class: 'resource-monitor-menu-row',
            x_expand: true,
        });
        const name = new St.Label({
            text: label,
            style_class: 'resource-monitor-menu-name',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const value = new St.Label({
            text: '—',
            style_class: 'resource-monitor-menu-value',
            x_expand: true,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
        });

        row.add_child(name);
        row.add_child(value);
        item.add_child(row);
        this._indicator.menu.addMenuItem(item);

        this._menuRows[key] = {
            item,
            value,
        };
    }

    _addDriveRow(drive) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        const row = new St.BoxLayout({
            style_class: 'resource-monitor-menu-row',
            x_expand: true,
        });
        const device = drive.source.split('/').pop();
        const name = new St.Label({
            text: `${driveLabel(drive.mountpoint)} · ${device}`,
            style_class: 'resource-monitor-menu-name',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const value = new St.Label({
            text: `${formatBytes(drive.used)} / ${formatBytes(drive.total)}  ${drive.percent}%`,
            style_class: 'resource-monitor-menu-value',
            x_expand: true,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
        });

        row.add_child(name);
        row.add_child(value);
        item.add_child(row);
        this._drivesSection.addMenuItem(item);
    }

    _primeCpu() {
        const text = this._read('stat');
        this._previousCpu = text ? parseCpuLine(text) : null;
    }

    _primeNetwork() {
        const routeText = this._read('route');
        this._netIface = routeText ? parseDefaultRoute(routeText) : null;

        const netText = this._netIface ? this._read('netdev') : null;
        this._previousNet = netText ? parseNetDev(netText, this._netIface) : null;
        this._previousNetTime = GLib.get_monotonic_time() / 1e6;
        this._rxRate = null;
        this._txRate = null;
    }

    _refresh() {
        if (!this._active)
            return;

        this._tick++;

        if (this._show?.cpu)
            this._refreshCpu();
        if (this._show?.memory)
            this._refreshMemory();
        if (this._show?.network)
            this._refreshNetwork();

        if (this._show?.storage && this._tick % STORAGE_EVERY_TICKS === 0)
            this._refreshStorage();

        if (this._show?.disks && this._tick % DRIVES_EVERY_TICKS === 0)
            this._refreshDrives();

        this._updatePanel();
        this._updateMenu();
    }

    _refreshCpu() {
        const text = this._read('stat');
        if (!text)
            return;

        const sample = parseCpuLine(text);
        if (!sample)
            return;

        if (this._previousCpu) {
            const usage = cpuUsage(this._previousCpu, sample);
            if (usage !== null)
                this._cpuUsage = usage;
        }

        this._previousCpu = sample;
    }

    _refreshMemory() {
        const text = this._read('meminfo');
        if (!text)
            return;

        this._memory = parseMeminfo(text);
    }

    _refreshNetwork() {
        const routeText = this._read('route');
        const iface = routeText ? parseDefaultRoute(routeText) : null;

        if (iface !== this._netIface) {
            this._netIface = iface;
            this._previousNet = null;
            this._previousNetTime = 0;
            this._rxRate = null;
            this._txRate = null;
        }

        const netText = iface ? this._read('netdev') : null;
        const sample = netText ? parseNetDev(netText, iface) : null;
        const now = GLib.get_monotonic_time() / 1e6;

        if (!sample) {
            this._previousNet = null;
            this._previousNetTime = now;
            this._rxRate = null;
            this._txRate = null;
            return;
        }

        if (this._previousNet && this._previousNetTime > 0) {
            const elapsed = now - this._previousNetTime;
            if (elapsed > 0.2) {
                const received = sample.rx >= this._previousNet.rx
                    ? sample.rx - this._previousNet.rx
                    : 0;
                const sent = sample.tx >= this._previousNet.tx
                    ? sample.tx - this._previousNet.tx
                    : 0;

                this._rxRate = received / elapsed;
                this._txRate = sent / elapsed;
            }
        } else {
            this._rxRate = 0;
            this._txRate = 0;
        }

        this._previousNet = sample;
        this._previousNetTime = now;
    }

    _refreshStorage() {
        if (!this._active || !this._show?.storage)
            return;

        this._storage = this._queryFilesystem('/');
    }

    _refreshDrives() {
        if (!this._active || !this._show?.disks)
            return;

        const text = this._read('mounts');
        if (!text)
            return;

        const drives = [];
        for (const entry of parseMounts(text)) {
            const filesystem = this._queryFilesystem(entry.mountpoint);
            if (!filesystem)
                continue;

            drives.push({
                ...entry,
                ...filesystem,
            });
        }

        drives.sort((a, b) => {
            const rank = mountpoint => {
                if (mountpoint === '/')
                    return 0;
                if (mountpoint === '/boot')
                    return 1;
                if (mountpoint === '/boot/efi')
                    return 2;
                return 3;
            };

            return rank(a.mountpoint) - rank(b.mountpoint) ||
                a.mountpoint.localeCompare(b.mountpoint);
        });

        this._drives = drives;
        this._rebuildDriveRows();
    }

    _queryFilesystem(path) {
        try {
            const info = Gio.File.new_for_path(path).query_filesystem_info(
                'filesystem::size,filesystem::used,filesystem::free', null);

            if (!info.has_attribute('filesystem::used') ||
                !info.has_attribute('filesystem::free'))
                return null;

            const used = info.get_attribute_uint64('filesystem::used');
            const free = info.get_attribute_uint64('filesystem::free');
            const available = used + free;
            if (available <= 0)
                return null;

            // df-style percentage: btrfs reserves space that is part of
            // filesystem::size but not part of used + available.
            const size = info.has_attribute('filesystem::size')
                ? info.get_attribute_uint64('filesystem::size')
                : available;

            return {
                used,
                free,
                total: size > 0 ? size : available,
                percent: percentOf(used, available),
            };
        } catch (e) {
            return null;
        }
    }

    _rebuildDriveRows() {
        if (!this._drivesSection)
            return;

        this._drivesSection.removeAll();
        for (const drive of this._drives)
            this._addDriveRow(drive);
    }

    _updatePanel() {
        if (!this._active)
            return;

        const memoryPercent = this._memory
            ? percentOf(this._memory.used, this._memory.total)
            : null;

        this._setLabel(this._cpuValue,
            this._cpuUsage === null ? '—' : `${this._cpuUsage}%`);
        this._setLabel(this._ramValue,
            memoryPercent === null ? '—' : `${memoryPercent}%`);
        this._setLabel(this._storageValue,
            !this._storage || this._storage.percent === null
                ? '—'
                : `${this._storage.percent}%`);

        const hasRates = this._netIface && this._rxRate !== null &&
            this._txRate !== null;
        this._setLabel(this._netValue, hasRates
            ? `↓${formatRate(this._rxRate)} ↑${formatRate(this._txRate)}`
            : '↓— ↑—');
    }

    _updateMenu() {
        if (!this._active || !this._menuRows)
            return;

        const memoryPercent = this._memory
            ? percentOf(this._memory.used, this._memory.total)
            : null;

        this._setLabel(this._menuRows.cpu.value,
            this._cpuUsage === null
                ? '—'
                : `${this._cpuUsage}% · ${GLib.get_num_processors()} threads`);

        this._setLabel(this._menuRows.ram.value,
            !this._memory || memoryPercent === null
                ? '—'
                : `${formatBytes(this._memory.used)} / ${formatBytes(this._memory.total)}  (${memoryPercent}%)`);

        const down = this._rxRate === null ? '—' : `${formatBytes(this._rxRate)}/s`;
        const up = this._txRate === null ? '—' : `${formatBytes(this._txRate)}/s`;
        this._setLabel(this._menuRows.network.value,
            this._netIface
                ? `${this._netIface}  ↓ ${down}  ↑ ${up}`
                : `no default route  ↓ ${down}  ↑ ${up}`);

        this._setLabel(this._menuRows.storage.value,
            !this._storage || this._storage.percent === null
                ? '—'
                : `${formatBytes(this._storage.used)} / ${formatBytes(this._storage.total)}  (${this._storage.percent}%)`);
    }

    _setLabel(label, text) {
        if (label && label.text !== text)
            label.text = text;
    }

    _read(name) {
        const file = this._files?.[name];
        if (!file)
            return null;

        try {
            const [ok, contents] = file.load_contents(null);
            if (!ok)
                return null;

            return new TextDecoder('utf-8').decode(contents);
        } catch (e) {
            if (!this._warnedPaths.has(name)) {
                this._warnedPaths.add(name);
                logError(e, `Resource Monitor: could not read ${name}`);
            }
            return null;
        }
    }
}
