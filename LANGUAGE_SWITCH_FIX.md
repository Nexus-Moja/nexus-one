# Language Switching Fix

The language selector previously stopped during translation when it encountered attributes such as `aria-label`.
The implementation attempted to store original attribute text in `dataset` using keys that contained hyphens, which can throw a browser DOM exception and abort the language update.

This release stores original attributes in a `WeakMap`, safely reapplies translations, preserves the original page title, and includes error handling around locale changes.

Supported locales:
- English (US)
- English (UK)
- French
- Spanish
