#!/usr/bin/env -S uv run --quiet --script
# /// script
# dependencies = [
#     "pillow>=10.0.0",
#     "cairosvg>=2.7.0",
# ]
# ///
"""
Create .icns icon file for macOS from SVG.

This script converts the favicon.svg to a .icns file with multiple resolutions.
"""

import io
import struct
from pathlib import Path
from PIL import Image
import cairosvg


def create_icns_from_svg(svg_path: Path, output_path: Path):
    """
    Create a macOS .icns file from an SVG file.

    Args:
        svg_path: Path to the source SVG file
        output_path: Path where the .icns file will be created
    """
    # Read SVG
    svg_data = svg_path.read_bytes()

    # Define icon sizes needed for .icns
    # Format: (size, ostype)
    icon_sizes = [
        (16, b'icp4'),
        (32, b'icp5'),
        (64, b'icp6'),
        (128, b'ic07'),
        (256, b'ic08'),
        (512, b'ic09'),
        (1024, b'ic10'),
        # Retina versions
        (32, b'ic11'),  # 16x16@2x
        (64, b'ic12'),  # 32x32@2x
        (256, b'ic13'), # 128x128@2x
        (512, b'ic14'), # 256x256@2x
    ]

    icns_data = io.BytesIO()

    # Write ICNS header
    icns_data.write(b'icns')
    # File size placeholder (we'll update this at the end)
    size_pos = icns_data.tell()
    icns_data.write(struct.pack('>I', 0))

    for size, ostype in icon_sizes:
        # Convert SVG to PNG at this size
        png_data = cairosvg.svg2png(
            bytestring=svg_data,
            output_width=size,
            output_height=size,
        )

        # Write icon entry
        icns_data.write(ostype)
        icns_data.write(struct.pack('>I', len(png_data) + 8))  # 8 bytes for header
        icns_data.write(png_data)

    # Update file size in header
    total_size = icns_data.tell()
    icns_data.seek(size_pos)
    icns_data.write(struct.pack('>I', total_size))

    # Write to file
    output_path.write_bytes(icns_data.getvalue())
    print(f"Created {output_path} ({total_size} bytes)")


def main():
    # Paths
    script_dir = Path(__file__).parent
    launcher_dir = script_dir.parent
    project_root = launcher_dir.parent.parent
    svg_path = project_root / 'assets' / 'favicon.svg'
    output_path = project_root / 'assets' / 'icon.icns'

    if not svg_path.exists():
        print(f"ERROR: SVG file not found: {svg_path}")
        return 1

    print(f"Converting {svg_path} to {output_path}...")
    create_icns_from_svg(svg_path, output_path)
    print("Done!")
    return 0


if __name__ == '__main__':
    import sys
    sys.exit(main())
