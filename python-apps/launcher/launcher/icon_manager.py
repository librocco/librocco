"""Icon manager for generating status-aware tray icons with badge indicators."""

from pathlib import Path
from typing import Dict

from PyQt6.QtCore import Qt
from PyQt6.QtGui import QIcon, QPixmap, QPainter, QColor, QBrush
from PyQt6.QtSvg import QSvgRenderer


class IconManager:
    """Manages tray icons with colored badge indicators for different states."""

    # State color definitions (maps daemon status to colors)
    COLORS = {
        "active": "#00C853",       # Green - service running
        "starting": "#FFB300",     # Yellow - service starting
        "error": "#D50000",        # Red - service error
        "stopped": "#757575",      # Gray - service stopped
    }

    def __init__(self):
        """Initialize the icon manager and load the base favicon."""
        self._icon_cache: Dict[str, QIcon] = {}
        self._base_pixmap = self._load_favicon()

    def _load_favicon(self) -> QPixmap:
        """Load the favicon.svg from the shared assets directory."""
        # Find project root (go up from launcher/launcher/ to project root)
        project_root = Path(__file__).parent.parent.parent.parent
        favicon_path = project_root / "assets" / "favicon.svg"

        if not favicon_path.exists():
            raise FileNotFoundError(f"Favicon not found at {favicon_path}")

        # Load SVG and render to pixmap with white rounded square background
        renderer = QSvgRenderer(str(favicon_path))
        pixmap = QPixmap(64, 64)
        pixmap.fill(Qt.GlobalColor.transparent)
        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        # Draw white rounded square background
        painter.setBrush(QBrush(Qt.GlobalColor.white))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawRoundedRect(0, 0, 64, 64, 8, 8)  # 8px corner radius

        # Render SVG on top
        renderer.render(painter)
        painter.end()

        return pixmap

    def _create_icon_with_badges(self, caddy_color: str, syncserver_color: str) -> QIcon:
        """Create an icon with two colored badge dots (one per service).

        Args:
            caddy_color: Hex color string for Caddy badge (e.g., "#00C853")
            syncserver_color: Hex color string for Sync Server badge

        Returns:
            QIcon with two colored badge overlays
        """
        # Create a copy of the base pixmap
        pixmap = self._base_pixmap.copy()

        # Draw two colored circle badges in bottom-right corner
        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.setPen(Qt.PenStyle.NoPen)

        # Badge configuration
        badge_size = 10
        margin = 2
        spacing = 2

        # Draw left badge (Caddy)
        left_x = pixmap.width() - (badge_size * 2) - spacing - margin
        y = pixmap.height() - badge_size - margin
        painter.setBrush(QBrush(QColor(caddy_color)))
        painter.drawEllipse(left_x, y, badge_size, badge_size)

        # Draw right badge (Sync Server)
        right_x = pixmap.width() - badge_size - margin
        painter.setBrush(QBrush(QColor(syncserver_color)))
        painter.drawEllipse(right_x, y, badge_size, badge_size)

        painter.end()

        return QIcon(pixmap)

    def get_icon_for_states(self, caddy_state: str, syncserver_state: str) -> QIcon:
        """Get a cached icon for the given daemon states.

        Args:
            caddy_state: Caddy daemon status ("active", "starting", "error", "stopped")
            syncserver_state: Sync Server daemon status

        Returns:
            QIcon with two badge overlays showing each service's state
        """
        # Create cache key from both states
        cache_key = f"{caddy_state}:{syncserver_state}"

        if cache_key not in self._icon_cache:
            caddy_color = self.COLORS.get(caddy_state, self.COLORS["stopped"])
            syncserver_color = self.COLORS.get(syncserver_state, self.COLORS["stopped"])
            self._icon_cache[cache_key] = self._create_icon_with_badges(caddy_color, syncserver_color)

        return self._icon_cache[cache_key]
