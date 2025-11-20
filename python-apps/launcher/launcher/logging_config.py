"""
Logging configuration for the launcher application.
"""

import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler


def setup_logging(logs_dir: Path, log_level: int = logging.INFO) -> logging.Logger:
    """
    Configure logging for the application.

    Sets up both file and console logging with rotation.

    Args:
        logs_dir: Directory where log files will be stored
        log_level: Logging level (default: INFO)

    Returns:
        Configured logger instance
    """
    # Ensure logs directory exists
    logs_dir.mkdir(parents=True, exist_ok=True)

    # Create logger
    logger = logging.getLogger("launcher")
    logger.setLevel(log_level)

    # Avoid adding handlers multiple times if called again
    if logger.handlers:
        return logger

    # File handler with rotation (10MB max, keep 5 backup files)
    log_file = logs_dir / "launcher.log"
    file_handler = RotatingFileHandler(
        log_file, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"  # 10MB
    )
    file_handler.setLevel(log_level)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)

    # Formatter with timestamps and level
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    # Add handlers
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger


def get_logger(name: str = "launcher") -> logging.Logger:
    """
    Get a logger instance.

    Args:
        name: Logger name (default: "launcher")

    Returns:
        Logger instance
    """
    return logging.getLogger(name)
