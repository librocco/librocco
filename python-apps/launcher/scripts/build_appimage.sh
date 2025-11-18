#!/bin/bash
set -e

# Build AppImage for Linux
# This script creates an AppImage from the PyInstaller-built executable
# Usage: ./build_appimage.sh

cd "$(dirname "$0")/../dist"

echo "Creating AppDir structure..."
mkdir -p AppDir/usr/bin
mkdir -p AppDir/usr/share/icons/hicolor/{16x16,32x32,48x48,64x64,128x128,256x256}/apps
mkdir -p AppDir/usr/share/applications

# Copy executable
echo "Copying executable..."
cp librocco AppDir/usr/bin/

# Copy desktop file
echo "Copying desktop file..."
cp ../librocco.desktop AppDir/usr/share/applications/
cp ../librocco.desktop AppDir/

# Copy icons to hicolor theme directories
echo "Copying icons..."
ICON_SOURCE="../../../assets"
for size in 16 32 48 64 128 256; do
  cp "$ICON_SOURCE/icon_${size}x${size}.png" "AppDir/usr/share/icons/hicolor/${size}x${size}/apps/librocco.png"
done

# Use 256x256 as the main icon
cp "$ICON_SOURCE/icon_256x256.png" AppDir/librocco.png

# Create AppRun script
echo "Creating AppRun script..."
cat > AppDir/AppRun << 'EOF'
#!/bin/bash
SELF=$(readlink -f "$0")
HERE=${SELF%/*}
export PATH="${HERE}/usr/bin:${PATH}"
export LD_LIBRARY_PATH="${HERE}/usr/lib:${LD_LIBRARY_PATH}"
exec "${HERE}/usr/bin/librocco" "$@"
EOF
chmod +x AppDir/AppRun

# Build AppImage
echo "Building AppImage..."
ARCH=x86_64 /tmp/appimagetool AppDir Librocco-x86_64.AppImage

echo "AppImage created successfully:"
ls -lh Librocco-x86_64.AppImage
