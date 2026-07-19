# NEXUS ONE Multilingual Support

Supported locales:
- `en-US` — English (United States), default
- `en-GB` — English (United Kingdom), including UK spelling/terminology
- `fr` — French
- `es` — Spanish

The language selector is available on every public and operational page. The selected locale is saved in browser local storage under `nexusLocale`, applied to dynamically rendered content, and reused across modules.

## Developer API

```js
NexusI18n.setLocale('fr');
NexusI18n.getLocale();
NexusI18n.t('Book a Ride');
NexusI18n.formatCurrency(125.50);
NexusI18n.formatDate(new Date());
```

New user-facing text should be added to `public/i18n.js`. Production translation review by qualified healthcare-language reviewers is recommended before using translated clinical, consent, billing, or emergency content.
