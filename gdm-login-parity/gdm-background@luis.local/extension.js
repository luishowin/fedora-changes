import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// The stylesheet is loaded automatically by GNOME Shell.  The extension is
// GDM-only via metadata.json, so its `#lockDialogGroup` rule cannot affect the
// user session's lock screen.
export default class GdmBackgroundExtension extends Extension {}
