#!/usr/bin/env -S gjs -m

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

let failures = 0;
let checks = 0;

function equal(name, actual, expected) {
    checks++;
    if (actual !== expected) {
        failures++;
        printerr(`FAIL ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function deepEqual(name, actual, expected) {
    checks++;
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
        failures++;
        printerr(`FAIL ${name}: expected ${expectedJson}, got ${actualJson}`);
    }
}

const stat = [
    'cpu  100 0 50 850 0 0 0 0 0 0',
    'cpu0 50 0 25 425 0 0 0 0 0 0',
].join('\n');

deepEqual('parseCpuLine', parseCpuLine(stat), {idle: 850, total: 1000});
equal('cpuUsage', cpuUsage({idle: 850, total: 1000}, {idle: 1700, total: 2000}), 15);
equal('cpuUsage without samples', cpuUsage(null, {idle: 1, total: 2}), null);
equal('cpuUsage with no elapsed jiffies', cpuUsage({idle: 1, total: 2}, {idle: 1, total: 2}), null);

const meminfo = [
    'MemTotal:       16384 kB',
    'MemFree:         2048 kB',
    'MemAvailable:    8192 kB',
    'Buffers:          256 kB',
    'Cached:          1024 kB',
].join('\n');

deepEqual('parseMeminfo', parseMeminfo(meminfo), {
    total: 16384 * 1024,
    available: 8192 * 1024,
    used: 8192 * 1024,
});
equal('memory percentage', percentOf(8192, 16384), 50);

const route = [
    'Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT',
    'wlp1s0\t00000000\t0164A8C0\t0003\t0\t0\t600\t00000000\t0\t0\t0',
    'wlp1s0\t0064A8C0\t00000000\t0001\t0\t0\t600\t00FFFFFF\t0\t0\t0',
    'enp0s1\t00000000\t0164A8C0\t0003\t0\t0\t100\t00000000\t0\t0\t0',
].join('\n');

equal('parseDefaultRoute picks lowest metric', parseDefaultRoute(route), 'enp0s1');
equal('parseDefaultRoute with no default', parseDefaultRoute(route.split('\n')[0]), null);

const netdev = [
    'Inter-|   Receive                                                |  Transmit',
    ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
    '    lo: 962730419  592756    0    0    0     0          0         0 962730419  592756    0    0    0     0       0          0',
    'wlp1s0: 2048 1 0 0 0 0 0 0 1024 1 0 0 0 0 0 0',
].join('\n');

deepEqual('parseNetDev', parseNetDev(netdev, 'wlp1s0'), {rx: 2048, tx: 1024});
equal('parseNetDev missing interface', parseNetDev(netdev, 'eth9'), null);

const mounts = [
    '/dev/nvme0n1p3 / btrfs rw,relatime,subvol=/root 0 0',
    '/dev/nvme0n1p3 /home btrfs rw,relatime,subvol=/home 0 0',
    '/dev/nvme0n1p2 /boot ext4 rw,relatime 0 0',
    '/dev/sda2 /run/media/luis/My\\040Drive fuseblk rw,nosuid 0 0',
    'tmpfs /run tmpfs rw,nosuid 0 0',
].join('\n');

const parsedMounts = parseMounts(mounts);
equal('parseMounts filters and deduplicates', parsedMounts.length, 3);
equal('parseMounts keeps the shortest mountpoint', parsedMounts[0].mountpoint, '/');
equal('parseMounts decodes spaces', parsedMounts[2].mountpoint, '/run/media/luis/My Drive');

equal('driveLabel root', driveLabel('/'), 'System');
equal('driveLabel boot', driveLabel('/boot'), 'Boot');
equal('driveLabel EFI', driveLabel('/boot/efi'), 'EFI');
equal('driveLabel removable', driveLabel('/run/media/luishowin/MX500'), 'MX500');

equal('formatBytes zero', formatBytes(0), '0 B');
equal('formatBytes MiB', formatBytes(1024 * 1024), '1.0 MiB');
equal('formatBytes GiB', formatBytes(158.1 * 1024 ** 3), '158 GiB');
equal('formatRate zero', formatRate(0), '0');
equal('formatRate bytes', formatRate(512), '512B');
equal('formatRate KiB', formatRate(1536), '1.5K');
equal('formatRate MiB', formatRate(1.5 * 1024 ** 2), '1.5M');
equal('percentOf empty filesystem', percentOf(0, 0), null);

if (failures > 0)
    throw new Error(`${failures} of ${checks} checks failed`);

print(`ok — ${checks} checks passed`);
