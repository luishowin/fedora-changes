import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const METRICS = [
    {
        key: 'show-cpu',
        title: 'CPU usage',
        subtitle: 'Processor utilization in the panel and dropdown.',
    },
    {
        key: 'show-memory',
        title: 'RAM usage',
        subtitle: 'Memory used and total in the panel and dropdown.',
    },
    {
        key: 'show-storage',
        title: 'Storage usage',
        subtitle: 'Root filesystem usage in the panel and Storage row.',
    },
    {
        key: 'show-network',
        title: 'Network throughput',
        subtitle: 'Download and upload rates for the default-route interface.',
    },
    {
        key: 'show-disks',
        title: 'Drive breakdown',
        subtitle: 'Per-drive used and total space in the dropdown.',
    },
];

export default class ResourceMonitorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Metrics',
            icon_name: 'utilities-system-monitor-symbolic',
        });

        const group = new Adw.PreferencesGroup({
            title: 'Visible metrics',
            description: 'Changes apply immediately. Disabled metrics are not sampled.',
        });

        for (const {key, title, subtitle} of METRICS) {
            const row = new Adw.SwitchRow({
                title,
                subtitle,
            });
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        }

        page.add(group);
        window.add(page);
    }
}
