#!/usr/bin/env python3
"""Pad the GNOME panel status icons on WhiteSur's 16px grid.

The custom icon theme already ships Wi-Fi, volume, battery and power-profile
SVGs on a 22x22 canvas whose artwork occupies a 16x16 optical box.  Every other
panel indicator is inherited from WhiteSur, where most SVGs are 16x16 and
full-bleed.  At the same St icon-size those inherited icons look roughly a
third larger.

This script wraps each name in ``panel-status-icons.txt`` in a 22x22 canvas,
centring the source artwork in a 16x16 box.  It reads the artwork from the
user's installed WhiteSur theme (and from GNOME Shell's icon gresource for the
few names WhiteSur does not ship), so no third-party SVG needs to be committed
to this repository.

Generated files are tracked in ``.generated-status-icons`` so a re-run can
remove stale copies before writing the new set.
"""

from __future__ import annotations

import argparse
import html
import os
import re
import subprocess
import sys
from pathlib import Path

CANVAS = 22.0
BOX = 16.0
MANIFEST = ".generated-status-icons"
SHELL_GRESOURCE = Path("/usr/share/gnome-shell/gnome-shell-icons.gresource")
CONTEXT_PRIORITY = (
    "status",
    "actions",
    "devices",
    "apps",
    "categories",
    "places",
    "mimetypes",
    "emblems",
)

ROOT_RE = re.compile(
    r"(?s)\A\s*(?:<\?xml[^>]*\?>\s*)?(?:<!DOCTYPE[^>]*>\s*)?<svg\b([^>]*)>(.*)</svg>\s*\Z"
)
ATTR_RE = re.compile(r"([\w:.-]+)\s*=\s*(?:\"([^\"]*)\"|'([^']*)')")
NUMBER_RE = re.compile(r"^\s*(-?\d+(?:\.\d+)?)")

DROP_ROOT_ATTRS = {
    "width",
    "height",
    "viewbox",
    "version",
    "xmlns",
    "xmlns:svg",
    "baseprofile",
    "preserveaspectratio",
    "x",
    "y",
}


def parse_root(svg_text: str):
    match = ROOT_RE.match(svg_text)
    if not match:
        raise ValueError("could not find a single <svg> root")
    attrs_text, inner = match.groups()
    attrs = {}
    for name, double, single in ATTR_RE.findall(attrs_text):
        attrs[name] = double if double != "" else single
    return attrs, inner


def number(value: str) -> float:
    match = NUMBER_RE.match(value)
    if not match:
        raise ValueError(f"not a number: {value!r}")
    return float(match.group(1))


def viewbox(attrs: dict[str, str]) -> tuple[float, float, float, float]:
    value = attrs.get("viewBox")
    if value:
        parts = [p for p in re.split(r"[\s,]+", value.strip()) if p]
        if len(parts) == 4:
            return tuple(float(p) for p in parts)  # type: ignore[return-value]
    width = number(attrs["width"]) if "width" in attrs else BOX
    height = number(attrs["height"]) if "height" in attrs else BOX
    return 0.0, 0.0, width, height


def wrap_svg(svg_text: str) -> str:
    attrs, inner = parse_root(svg_text)
    vbx, vby, vbw, vbh = viewbox(attrs)
    if vbw <= 0 or vbh <= 0:
        raise ValueError("empty viewBox")

    scale = BOX / max(vbw, vbh)
    tx = (CANVAS - vbw * scale) / 2.0 - vbx * scale
    ty = (CANVAS - vbh * scale) / 2.0 - vby * scale

    root_transform = attrs.get("transform")
    transforms = [f"translate({tx:.4f} {ty:.4f})", f"scale({scale:.6f})"]
    if root_transform:
        transforms.append(root_transform)

    inherited = []
    for name, value in attrs.items():
        if name.lower() in DROP_ROOT_ATTRS or name == "transform":
            continue
        inherited.append(f'{name}="{html.escape(value, quote=True)}"')

    group_attrs = f' transform="{" ".join(transforms)}"'
    if inherited:
        group_attrs += " " + " ".join(inherited)

    return (
        '<svg width="22" height="22" viewBox="0 0 22 22" version="1.1" '
        'xmlns="http://www.w3.org/2000/svg">\n'
        f" <g{group_attrs}>\n"
        f"{inner}\n"
        " </g>\n"
        "</svg>\n"
    )


def source_roots(theme: str) -> list[Path]:
    roots = []
    xdg = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    roots.append(xdg / "icons" / theme)
    roots.append(Path.home() / ".local" / "share" / "icons" / theme)
    roots.append(Path("/usr/share/icons") / theme)
    unique = []
    for root in roots:
        if root not in unique:
            unique.append(root)
    return unique


def find_source(name: str, roots: list[Path]) -> Path | None:
    for root in roots:
        for context in CONTEXT_PRIORITY:
            candidate = root / context / "symbolic" / f"{name}.svg"
            if candidate.is_file():
                return candidate
        matches = sorted(root.glob(f"*/symbolic/{name}.svg"))
        if matches:
            return matches[0]
    return None


def gresource_listing() -> list[str]:
    try:
        result = subprocess.run(
            ["gresource", "list", str(SHELL_GRESOURCE)],
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return []
    return result.stdout.splitlines()


def find_builtin(name: str, listing: list[str]) -> str | None:
    if not SHELL_GRESOURCE.is_file():
        return None
    matches = [path for path in listing if path.endswith(f"/{name}.svg")]
    if not matches:
        return None
    for context in CONTEXT_PRIORITY:
        for path in matches:
            if f"/{context}/" in path:
                return path
    return matches[0]


def read_builtin(path: str) -> str:
    result = subprocess.run(
        ["gresource", "extract", str(SHELL_GRESOURCE), path],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def read_names(list_path: Path) -> list[str]:
    names = []
    for line in list_path.read_text().splitlines():
        name = line.split("#", 1)[0].strip()
        if name:
            names.append(name)
    return names


def remove_generated(target: Path, manifest: Path) -> None:
    if not manifest.is_file():
        return
    for line in manifest.read_text().splitlines():
        rel = line.strip()
        if not rel:
            continue
        path = Path(rel)
        if path.is_absolute() or ".." in path.parts:
            continue
        candidate = target / path
        if candidate.is_file():
            candidate.unlink()
    manifest.unlink()


def write_manifest(manifest: Path, entries: list[str]) -> None:
    manifest.parent.mkdir(parents=True, exist_ok=True)
    tmp = manifest.with_name(manifest.name + ".tmp")
    tmp.write_text("".join(f"{entry}\n" for entry in entries))
    os.replace(tmp, manifest)


def generate(target: Path, list_path: Path, theme: str) -> int:
    names = read_names(list_path)
    manifest = target / MANIFEST
    remove_generated(target, manifest)

    roots = source_roots(theme)
    builtin_listing = gresource_listing()
    generated: list[str] = []
    skipped: list[str] = []
    missing: list[str] = []

    for name in names:
        rel = Path("status") / "symbolic" / f"{name}.svg"
        destination = target / rel
        if destination.exists():
            skipped.append(name)
            continue

        source = find_source(name, roots)
        if source is not None:
            text = source.read_text()
        else:
            builtin = find_builtin(name, builtin_listing)
            if builtin is None:
                missing.append(name)
                continue
            text = read_builtin(builtin)

        try:
            wrapped = wrap_svg(text)
        except Exception as error:  # noqa: BLE001 - report the file and continue
            missing.append(f"{name} ({error})")
            continue

        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(wrapped)
        generated.append(rel.as_posix())

    write_manifest(manifest, generated)

    print(
        f"Padded status icons: {len(generated)} generated, "
        f"{len(skipped)} already shipped, {len(missing)} unavailable."
    )
    if missing:
        print("Unavailable sources (left to the inherited theme):", file=sys.stderr)
        for item in missing:
            print(f"  {item}", file=sys.stderr)
    return 0


def check(target: Path, list_path: Path, theme: str) -> int:
    names = read_names(list_path)
    manifest = target / MANIFEST
    if not manifest.is_file():
        print(f"Missing generated-icon manifest: {manifest}", file=sys.stderr)
        return 1

    entries = [line.strip() for line in manifest.read_text().splitlines() if line.strip()]
    missing_sources = []
    errors = []

    for rel in entries:
        path = target / rel
        if not path.is_file():
            errors.append(f"missing generated file: {rel}")
            continue
        try:
            attrs, _ = parse_root(path.read_text())
        except Exception as error:  # noqa: BLE001
            errors.append(f"unreadable generated file: {rel} ({error})")
            continue
        if (
            attrs.get("width") != "22"
            or attrs.get("height") != "22"
            or attrs.get("viewBox") != "0 0 22 22"
        ):
            errors.append(f"unexpected canvas in {rel}")

    roots = source_roots(theme)
    builtin_listing = gresource_listing()
    generated = set(entries)
    for name in names:
        rel = (Path("status") / "symbolic" / f"{name}.svg").as_posix()
        if rel in generated:
            continue
        if (target / rel).is_file():
            continue
        if find_source(name, roots) is not None or find_builtin(name, builtin_listing):
            errors.append(f"missing padded icon for available source: {name}")
        else:
            missing_sources.append(name)

    if missing_sources:
        print(
            "Unavailable sources (not checked): " + ", ".join(missing_sources),
            file=sys.stderr,
        )
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1

    print(f"Padded status icons: {len(entries)} entries verified.")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path, help="installed theme directory")
    parser.add_argument("--check", action="store_true", help="verify instead of generate")
    parser.add_argument(
        "--list",
        type=Path,
        default=Path(__file__).with_name("panel-status-icons.txt"),
        help="icon-name list",
    )
    parser.add_argument("--theme", default="WhiteSur", help="source icon theme")
    args = parser.parse_args(argv)

    if not args.target.is_dir():
        print(f"Theme directory does not exist: {args.target}", file=sys.stderr)
        return 1
    if not args.list.is_file():
        print(f"Icon list does not exist: {args.list}", file=sys.stderr)
        return 1

    if args.check:
        return check(args.target, args.list, args.theme)
    return generate(args.target, args.list, args.theme)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
