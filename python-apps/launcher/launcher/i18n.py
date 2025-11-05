"""
Internationalization (i18n) support for the launcher.

This module provides locale detection and translation functionality
using gettext and Babel.
"""

import gettext
import locale
import os
from pathlib import Path
from typing import Optional


DEFAULT_LANGUAGE = "en"


def _get_supported_languages() -> list[str]:
    """
    Auto-detect supported languages from available translation files.

    Scans the locales directory for compiled translation catalogs (.mo files)
    and returns a list of available language codes.

    Returns:
        List of language codes (e.g., ['en', 'de', 'it'])
    """
    locale_dir = Path(__file__).parent / "locales"
    if not locale_dir.exists():
        return [DEFAULT_LANGUAGE]

    languages = [DEFAULT_LANGUAGE]  # Always include default language
    for lang_dir in locale_dir.iterdir():
        if lang_dir.is_dir():
            mo_file = lang_dir / "LC_MESSAGES" / "launcher.mo"
            if mo_file.exists() and lang_dir.name != DEFAULT_LANGUAGE:
                languages.append(lang_dir.name)

    return sorted(languages)


# Supported languages (auto-detected from available .mo files)
SUPPORTED_LANGUAGES = _get_supported_languages()

# Global translation function (initialized by setup_i18n)
_translate = None


def detect_locale() -> str:
    """
    Detect the system locale and return the appropriate language code.

    Returns the language code (e.g., 'en', 'de', 'it') based on the system
    locale. Falls back to DEFAULT_LANGUAGE if the system locale is not supported.

    Returns:
        Language code from SUPPORTED_LANGUAGES
    """
    try:
        # Get the system locale
        system_locale, _ = locale.getdefaultlocale()

        if system_locale:
            # Extract language code (e.g., 'de_DE' -> 'de')
            language_code = system_locale.split("_")[0].lower()

            # Return if supported, otherwise fall back to default
            if language_code in SUPPORTED_LANGUAGES:
                return language_code
    except Exception:
        # If locale detection fails, fall back to default
        pass

    return DEFAULT_LANGUAGE


def setup_i18n(language: Optional[str] = None) -> None:
    """
    Initialize the internationalization system.

    This function must be called before using the translation function (_).
    It sets up gettext with the appropriate locale based on either the
    provided language code or the detected system locale.

    Args:
        language: Optional language code (e.g., 'en', 'de', 'it').
                 If None, the system locale will be detected automatically.
    """
    global _translate

    # Use provided language or detect from system
    if language is None:
        language = detect_locale()

    # Ensure the language is supported
    if language not in SUPPORTED_LANGUAGES:
        language = DEFAULT_LANGUAGE

    # Get the locale directory (relative to this module)
    locale_dir = Path(__file__).parent / "locales"

    try:
        # Load the translation catalog for the selected language
        translation = gettext.translation(
            "launcher",  # domain (must match .po/.mo filename)
            localedir=str(locale_dir),
            languages=[language],
            fallback=True,  # Fall back to default if translation not found
        )
        _translate = translation.gettext
    except Exception as exc:
        # If loading fails, use fallback (returns untranslated strings)
        print(f"Warning: Failed to load translations for '{language}': {exc}")
        _translate = lambda s: s


def _(message: str) -> str:
    """
    Translate a message to the current locale.

    This is the main translation function used throughout the application.
    Must call setup_i18n() before using this function.

    Args:
        message: The message to translate

    Returns:
        Translated message, or original message if translation not available
    """
    if _translate is None:
        raise RuntimeError(
            "i18n not initialized. Call setup_i18n() before using _()."
        )
    return _translate(message)


# Export the translation function
__all__ = ["setup_i18n", "detect_locale", "_", "SUPPORTED_LANGUAGES", "DEFAULT_LANGUAGE"]
