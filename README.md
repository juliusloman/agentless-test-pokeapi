# Pokédex — PokeAPI SPA

A small single-page application that lists Pokémon from the public
[PokeAPI](https://pokeapi.co/), shows detail cards, and provides search.

## Features

- **Paginated listing** — browse Pokémon in pages of 24 with a *Load more* button.
- **XHR requests** — every API call uses `XMLHttpRequest` (see `app.js`), not `fetch`.
- **Detail view** — click any card (or press Enter) to open a modal with the
  official artwork, types, height/weight/base XP, base stats, and abilities.
- **Search** — look up a Pokémon by exact name (e.g. `pikachu`) or number (e.g. `25`).
  Clearing the box restores the full list.
- No build step, no dependencies — plain HTML/CSS/JS.

## Run it

Because browsers restrict `XMLHttpRequest` on `file://` pages, serve the folder
over HTTP. Any static server works:

```bash
# Python 3
python3 -m http.server 8080

# or Node
npx serve .
```

Then open <http://localhost:8080>.

## Files

| File         | Purpose                                            |
|--------------|----------------------------------------------------|
| `index.html` | Markup and layout                                  |
| `styles.css` | Styling (dark theme, type colors, modal, spinner)  |
| `app.js`     | XHR data layer, rendering, search, detail modal    |

## API endpoints used

- `GET /api/v2/pokemon?limit=&offset=` — paginated name/URL list
- `GET /api/v2/pokemon/{name|id}` — full detail for one Pokémon
