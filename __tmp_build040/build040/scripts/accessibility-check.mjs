import fs from 'node:fs';

const checks = [];
const source = fs.readFileSync('src/main.jsx', 'utf8');
const css = fs.readFileSync('src/styles.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const operations = fs.readFileSync('public/operations.html', 'utf8');

function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
}

check('Document language is declared', /<html lang="en">/i.test(index));
check('Page has a descriptive title', /<title>[^<]{8,}<\/title>/i.test(index));
check('Skip link is present', source.includes('href="#main-content"'));
check('Main landmark is focusable', source.includes('id="main-content" tabIndex="-1"'));
check('Primary navigation is labelled', source.includes('aria-label="Primary navigation"'));
check('Mobile menu exposes expanded state', source.includes('aria-expanded={mobile}'));
check('Carousel has pause control', source.includes('Pause automatic slide rotation'));
check('Carousel respects reduced motion', source.includes('useReducedMotion'));
check('Dialogs use aria-modal', source.includes('aria-modal="true"'));
check('Dialogs have labelled title and description', source.includes('aria-labelledby={titleId}') && source.includes('aria-describedby={descriptionId}'));
check('Dialog focus trap is present', source.includes("if(e.key==='Tab')"));
check('Status and errors use live regions', source.includes('aria-live="polite"') && source.includes('role="alert"'));
check('Accessibility controls expose pressed state', source.includes('aria-pressed={largeText}') && source.includes('aria-pressed={highContrast}') && source.includes('aria-pressed={reduceMotion}'));
check('Visible focus indicator is defined', css.includes(':focus-visible'));
check('Reduced motion media query is defined', css.includes('@media (prefers-reduced-motion:reduce)'));
check('Forced colors support is defined', css.includes('@media (forced-colors:active)'));
check('Operations page declares language', /<html lang="en">/i.test(operations));
check('Operations inputs have explicit labels', operations.includes('for="key"') && operations.includes('Administrator key'));
check('Operations status messages use live region', operations.includes('aria-live="polite"'));
check('Accessibility statement is included', fs.existsSync('public/accessibility.html'));

const failures = checks.filter(item => !item.passed);
for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'}: ${item.name}`);
if (failures.length) {
  console.error(`\n${failures.length} accessibility regression check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} accessibility regression checks passed.`);
