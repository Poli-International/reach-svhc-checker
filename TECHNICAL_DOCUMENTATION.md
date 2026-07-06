# REACH SVHC Pigment Checker - Technical Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Schemas](#data-schemas)
3. [Calculation / Logic Algorithms](#calculation--logic-algorithms)
4. [API Reference](#api-reference)
5. [Integration Guide](#integration-guide)
6. [Customization](#customization)
7. [Performance](#performance)
8. [Browser Compatibility](#browser-compatibility)
9. [Security](#security)
10. [Version History](#version-history)
11. [Support and Contact](#support-and-contact)

## Architecture Overview

### Technology Stack

- **HTML5** - Semantic markup with ARIA roles for accessibility
- **CSS3** - Single stylesheet (`css/style.css`) with CSS custom properties (variables) for theming
- **Vanilla JavaScript (ES6+)** - No frameworks, libraries, or build tools
- **No external dependencies** - Fully self-contained static application

### File Structure

```
/tools/reach-svhc-checker/
├── index.html          # Main application page
├── css/
│   └── style.css       # All styling (referenced but not provided in source)
└── js/
    ├── svhc-data.js    # SVHC substance database (80 curated entries)
    └── app.js          # Application logic, UI handlers, search algorithms
```

### Component / Logic Breakdown

The application consists of two primary functional areas:

1. **Single Search Tab** (`#panel-search`)
   - Text input for ingredient name, CAS number, or EC number
   - Search button and Enter key handler
   - Results display area with flagged or not-found cards

2. **Bulk SDS Scan Tab** (`#panel-bulk`)
   - Textarea for pasting Safety Data Sheet Section 3 or ingredient lists
   - Scan and Clear buttons
   - Results display with statistics bar, alert banners, and categorized results

### Data Flow

```
User Input → Input Sanitization (escHtml) → Query Parsing → 
  SVHC_DATA Array Lookup → Result Card Generation → DOM Rendering
```

## Data Schemas

### Constants (defined in `svhc-data.js`)

```javascript
const SVHC_LIST_DATE = '2026-01-14';
const SVHC_TOTAL_OFFICIAL = 244;
```

### SVHC_DATA Array

Array of 80 substance objects with the following schema:

```javascript
{
  id: 'nickel',                    // String - unique identifier
  name: 'Nickel',                  // String - primary substance name
  cas: ['7440-02-0'],              // Array of Strings - CAS numbers (may have multiple)
  ec: '231-111-4',                 // String - EC number (may be ', ')
  reason: 'Carcinogenic (Cat. 1A), Mutagenic (Cat. 2)',  // String - full hazard description
  reason_short: 'CMR',             // String - abbreviated hazard classification
  category: 'metal',               // String - substance category
  body_art_relevance: 'high',      // String - 'high', 'medium', or 'low'
  found_in: [                      // Array of Strings - product types where found
    'piercing jewelry (low-grade alloys)',
    'tattoo inks (trace)',
    'studio tools & needles'
  ],
  also_known_as: [                 // Array of Strings - alternative names/aliases
    'Ni',
    'nickel metal',
    'nickel powder'
  ],
  echa_url: 'https://echa.europa.eu/...'  // String - ECHA substance page URL
}
```

### Category Values

- `'metal'` - Metals and inorganic compounds
- `'pah'` - Polycyclic Aromatic Hydrocarbons
- `'plasticizer'` - Phthalates
- `'amine'` - Aromatic amines and azo dye precursors
- `'solvent'` - Solvents and chemical intermediates
- `'endocrine'` - Endocrine disruptors (phenols, surfactants)
- `'halogenated'` - Halogenated/perfluorinated compounds

### body_art_relevance Values

- `'high'` - Commonly found in tattoo inks, piercing jewelry, or studio products
- `'medium'` - Found in manufacturing processes or less common formulations
- `'low'` - Rarely encountered in body art contexts

## Calculation / Logic Algorithms

### Single Search (`runSearch` function)

1. **Input Validation**: Check if query is empty; if so, clear results and return
2. **Name Matching**: Call `findByQuery(q)` which performs case-insensitive substring matching against:
   - `substance.name`
   - `substance.cas` array entries
   - `substance.ec`
   - `substance.also_known_as` array entries
3. **CAS Fallback**: If no name match found, extract CAS numbers from query using `CAS_PATTERN` regex and search `SVHC_DATA` by CAS
4. **Result Rendering**: 
   - Match found → `buildFlaggedCard()` with match type indicator
   - No match → `buildNotFoundCard()`

### Bulk Scan (`runBulkScan` function)

1. **Input Validation**: Check if textarea is empty; show idle state if so
2. **Parsing**: Call `parseIngredientBlock(text)` which:
   - Extracts CAS numbers using regex pattern `\b\d{2,7}-\d{2}-\d\b`
   - Extracts ingredient names by splitting on commas, semicolons, and newlines
   - Returns array of hit objects: `{ query, substance, type }`
3. **Deduplication**: Use Map keyed by substance `id`, preferring CAS matches over name matches
4. **Statistics Generation**: Count flagged vs. unknown substances
5. **Result Rendering**:
   - Stats bar with counts
   - Alert banner (danger if SVHC found, info if none)
   - Flagged substances section with expandable cards
   - Not-found section with safe indicators

### Matching Algorithm (`findByQuery`)

```javascript
function findByQuery(query) {
  const q = query.toLowerCase().trim();
  return SVHC_DATA.find(sub => {
    // Check primary name
    if (sub.name.toLowerCase().includes(q)) return true;
    // Check CAS numbers
    if (sub.cas.some(c => c.includes(q))) return true;
    // Check EC number
    if (sub.ec && sub.ec.toLowerCase().includes(q)) return true;
    // Check aliases
    if (sub.also_known_as && sub.also_known_as.some(a => a.toLowerCase().includes(q))) return true;
    return false;
  });
}
```

### Card Toggle Logic (`toggleCard`)

```javascript
function toggleCard(headerEl) {
  headerEl.closest('.result-card').classList.toggle('expanded');
}
```

### HTML Escaping (`escHtml`)

```javascript
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

## API Reference

### Public Functions

#### `runSearch()`
- **Parameters**: None (reads from `searchInput` DOM element)
- **Behavior**: Executes single ingredient search, renders results in `searchResults` container
- **Returns**: `undefined`

#### `runBulkScan()`
- **Parameters**: None (reads from `bulkInput` DOM element)
- **Behavior**: Parses bulk text, deduplicates matches, renders statistics and categorized results in `bulkResults` container
- **Returns**: `undefined`

#### `toggleCard(headerEl)`
- **Parameters**: 
  - `headerEl` (HTMLElement) - The card header element clicked by user
- **Behavior**: Toggles `expanded` class on parent `.result-card` element
- **Returns**: `undefined`

#### `buildFlaggedCard(sub, query, matchType)`
- **Parameters**:
  - `sub` (Object) - SVHC substance object from `SVHC_DATA`
  - `query` (String) - Original search query
  - `matchType` (String) - `'name'` or `'cas'`
- **Returns**: HTMLElement - Complete flagged result card with expandable details

#### `buildNotFoundCard(query)`
- **Parameters**:
  - `query` (String) - Original search query
- **Returns**: HTMLElement - Not-found result card with safe indicator

#### `escHtml(str)`
- **Parameters**:
  - `str` (String) - Raw string to escape
- **Returns**: String - HTML-escaped string

#### `renderIdle(msg)`
- **Parameters**:
  - `msg` (String) - Message to display
- **Returns**: String - HTML string for idle state display

### Event Handlers

| Element | Event | Handler |
|---------|-------|---------|
| `.tab-btn` | `click` | Tab switching logic |
| `#search-input` | `keydown` | `runSearch()` on Enter key |
| `#search-btn` | `click` | `runSearch()` |
| `#bulk-scan-btn` | `click` | `runBulkScan()` |
| `#bulk-clear-btn` | `click` | Clear textarea and reset results |
| `.card-header` | `click` | `toggleCard()` (delegated via inline onclick) |

### MutationObserver

```javascript
const observer = new MutationObserver(() => {
  const cards = searchResults.querySelectorAll('.result-card--flagged');
  if (cards.length === 1) cards[0].classList.add('expanded');
});
observer.observe(searchResults, { childList: true });
```

Auto-expands the single result card when only one flagged substance is found.

## Integration Guide

### Standalone Embedding (Direct URL)

The tool is hosted at:
```
https://poliinternational.com/tools/reach-svhc-checker/
```

No installation or build process required. Simply link to the live URL.

### Iframe Embedding

```html
<iframe 
  src="https://poliinternational.com/tools/reach-svhc-checker/"
  width="100%" 
  height="800px"
  style="border: none;"
  title="REACH SVHC Pigment Checker"
></iframe>
```

The tool automatically detects iframe embedding (`window.self !== window.top`) and:
- Applies dark theme by default
- Listens for `poli-theme` postMessage events to toggle between light/dark themes

### Theme Control via postMessage

```javascript
// Send from parent page to iframe
iframe.contentWindow.postMessage({
  type: 'poli-theme',
  light: true   // true for light theme, false for dark
}, '*');
```

### Dependencies

- **Zero external dependencies** - No jQuery, React, or third-party libraries
- **Self-contained** - All data and logic in two JavaScript files
- **No API calls** - Works entirely offline once loaded

## Customization

### Modifying the SVHC Database

Edit `js/svhc-data.js` to:
- Add new substances following the documented schema
- Update `SVHC_LIST_DATE` and `SVHC_TOTAL_OFFICIAL` constants
- Modify `body_art_relevance` ratings
- Add or remove `also_known_as` aliases

### Styling Customization

The tool uses CSS custom properties defined in `css/style.css` (not provided in source). Override these variables for custom theming:

```css
:root {
  --text-muted: #6b7280;
  /* Additional variables as defined in style.css */
}
```

### Tab Configuration

Tab structure is defined in `index.html`:
- Tab buttons use `data-tab` attributes matching panel IDs
- Panel IDs follow pattern `panel-{tabname}`
- Active state managed by `active` class on both buttons and panels

## Performance

### Optimization Features

- **No external requests** - All data loaded from local JavaScript files
- **Minimal DOM manipulation** - Results rendered in batches, not individual elements
- **Efficient deduplication** - Uses Map for O(1) lookups during bulk scanning
- **Lazy expansion** - Card details only rendered when expanded (CSS `display: none` toggling)

### Bundle Size

- `svhc-data.js`: ~15KB (80 substance objects)
- `app.js`: ~8KB (application logic)
- `index.html`: ~5KB (markup and inline scripts)
- **Total**: ~28KB uncompressed

### Rendering Performance

- Single search: O(n) scan of 80 substances
- Bulk scan: O(n*m) where n = substances (80) and m = parsed ingredients
- Card expansion: CSS-only toggle, no re-rendering

## Browser Compatibility

### Supported Browsers

- **Chrome** 60+
- **Firefox** 55+
- **Safari** 12+
- **Edge** 79+
- **Opera** 47+

### Features Used

- `querySelectorAll` / `querySelector` - DOM selection
- `classList.toggle` / `classList.add` / `classList.remove` - Class manipulation
- `MutationObserver` - DOM change detection
- `Array.prototype.find` / `Array.prototype.some` / `Array.prototype.includes` - Array methods
- `Map` - Keyed collection for deduplication
- `template literals` - String interpolation
- `Arrow functions` - Function syntax
- `let` / `const` - Block-scoped variables
- `postMessage` - Cross-origin communication (iframe only)

### No Polyfills Required

All features are natively supported in modern browsers. No polyfills or transpilation needed.

## Security

### XSS Prevention

The application implements multiple layers of protection:

1. **HTML Escaping**: All user input and database strings are passed through `escHtml()` before rendering:
   ```javascript
   function escHtml(str) {
     if (!str) return '';
     return String(str)
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;');
   }
   ```

2. **No innerHTML with User Data**: All dynamic content is created using `document.createElement()` and `textContent` where possible. Only controlled strings (badge labels, URLs) use `innerHTML`.

3. **Input Sanitization**: Search queries are trimmed and lowercased before processing, preventing injection through malformed input.

4. **No eval() or setTimeout with strings**: All code execution uses proper function calls and event handlers.

### Data Integrity

- All SVHC data is hardcoded in `svhc-data.js` - no external data sources
- No user data is stored, transmitted, or persisted
- No cookies, localStorage, or sessionStorage used

### Iframe Security

- The tool sets `<meta name="robots" content="noindex, nofollow">` to prevent search indexing
- Iframe embedding is supported but controlled via postMessage API
- No sensitive data exposure through cross-origin communication

## Version History

### Version 1.0.0 (2026-01-14)

- Initial release
- 80 SVHC substances curated for body art relevance
- Single ingredient search by name, CAS, or EC number
- Bulk SDS Section 3 scanning with CAS extraction
- Expandable result cards with detailed substance information
- Body art relevance ratings (high/medium/low)
- Iframe embedding support with theme control
- Dark/light theme support
- Auto-expansion of single search results
- Comprehensive legal disclaimer

## Support and Contact

For technical support, data corrections, or feature requests:

- **Email**: support@poliinternational.com
- **Website**: https://poliinternational.com
- **ECHA Official List**: https://echa.europa.eu/candidate-list-table

### Reporting Issues

When reporting issues, please include:
- Browser name and version
- Operating system
- Steps to reproduce
- Expected vs. actual behavior
- Screenshots if applicable

### Data Accuracy

The SVHC database is curated for body art relevance and may not include all 244 official ECHA substances. Always verify against the official ECHA Candidate List for legally binding compliance information.
