/*
 * Pure parsing and formatting helpers for the resource monitor.
 *
 * Nothing in this file imports GNOME Shell or Gio, so selftest.js can run it
 * with plain gjs, outside a running session.
 */

const BYTE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
const RATE_UNITS = ['K', 'M', 'G', 'T'];

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function percentOf(used, total) {
    if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0)
        return null;
    return clamp(Math.round((used / total) * 100), 0, 100);
}

export function parseCpuLine(text) {
    const line = text.split('\n').find(candidate => candidate.startsWith('cpu '));
    if (!line)
        return null;

    const values = line.trim().split(/\s+/).slice(1).map(Number);
    if (values.length < 4 || values.some(Number.isNaN))
        return null;

    const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0, steal = 0] = values;
    const total = user + nice + system + idle + iowait + irq + softirq + steal;

    return {
        idle: idle + iowait,
        total,
    };
}

export function cpuUsage(previous, current) {
    if (!previous || !current)
        return null;

    const total = current.total - previous.total;
    const idle = current.idle - previous.idle;
    if (total <= 0 || idle < 0)
        return null;

    return clamp(Math.round((1 - idle / total) * 100), 0, 100);
}

export function parseMeminfo(text) {
    const values = new Map();

    for (const line of text.split('\n')) {
        const match = line.match(/^([A-Za-z0-9_()]+):\s+(\d+)\s+kB/);
        if (match)
            values.set(match[1], Number(match[2]) * 1024);
    }

    const total = values.get('MemTotal');
    if (!total)
        return null;

    const available = values.get('MemAvailable') ??
        (values.get('MemFree') ?? 0) +
        (values.get('Buffers') ?? 0) +
        (values.get('Cached') ?? 0);

    return {
        total,
        available,
        used: Math.max(0, total - available),
    };
}

export function parseDefaultRoute(text) {
    let best = null;

    for (const line of text.split('\n').slice(1)) {
        const columns = line.trim().split(/\s+/);
        if (columns.length < 8)
            continue;

        const [iface, destination, , flags, , , metric] = columns;
        if (destination !== '00000000')
            continue;

        const numericFlags = Number.parseInt(flags, 16);
        if ((numericFlags & 0x1) === 0)
            continue;

        const candidate = {
            iface,
            metric: Number(metric) || 0,
        };

        if (!best || candidate.metric < best.metric)
            best = candidate;
    }

    return best?.iface ?? null;
}

export function parseNetDev(text, iface) {
    if (!iface)
        return null;

    for (const line of text.split('\n')) {
        const separator = line.indexOf(':');
        if (separator < 0)
            continue;

        if (line.slice(0, separator).trim() !== iface)
            continue;

        const fields = line.slice(separator + 1).trim().split(/\s+/).map(Number);
        if (fields.length < 9 || fields.some(Number.isNaN))
            return null;

        return {
            rx: fields[0],
            tx: fields[8],
        };
    }

    return null;
}

export function decodeMountField(value) {
    return value.replace(/\\([0-7]{3})/g, (_, octal) =>
        String.fromCharCode(Number.parseInt(octal, 8)));
}

export function parseMounts(text) {
    const bySource = new Map();

    for (const line of text.split('\n')) {
        const columns = line.trim().split(/\s+/);
        if (columns.length < 3)
            continue;

        const [rawSource, rawMountpoint, fstype] = columns;
        if (!rawSource.startsWith('/dev/') || fstype === 'swap')
            continue;

        const source = decodeMountField(rawSource);
        const mountpoint = decodeMountField(rawMountpoint);
        const existing = bySource.get(source);

        if (!existing || mountpoint.length < existing.mountpoint.length) {
            bySource.set(source, {
                source,
                mountpoint,
                fstype,
            });
        }
    }

    return [...bySource.values()];
}

export function driveLabel(mountpoint) {
    if (mountpoint === '/')
        return 'System';
    if (mountpoint === '/boot')
        return 'Boot';
    if (mountpoint === '/boot/efi')
        return 'EFI';

    return mountpoint.split('/').filter(Boolean).pop() ?? mountpoint;
}

export function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0)
        return '—';
    if (bytes === 0)
        return '0 B';

    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
        value /= 1024;
        unit++;
    }

    const digits = value >= 100 ? 0 : 1;
    return `${value.toFixed(digits)} ${BYTE_UNITS[unit]}`;
}

export function formatRate(bytesPerSecond) {
    if (!Number.isFinite(bytesPerSecond) || bytesPerSecond < 0)
        return '—';
    if (bytesPerSecond < 1)
        return '0';
    if (bytesPerSecond < 1024)
        return `${Math.round(bytesPerSecond)}B`;

    let value = bytesPerSecond / 1024;
    let unit = 0;
    while (value >= 1024 && unit < RATE_UNITS.length - 1) {
        value /= 1024;
        unit++;
    }

    const digits = value >= 100 ? 0 : 1;
    return `${value.toFixed(digits)}${RATE_UNITS[unit]}`;
}
