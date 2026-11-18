**English** · [Türkçe](README.tr.md)

# Seyirlik

A movie and TV show watchlist that runs in the browser. No installation or build; open `index.html` with a server:

```bash
python3 -m http.server 8769 --directory ~/Projeler/seyirlik
```

🎬 **Open in your browser:** https://muhammedozkul.github.io/seyirlik/

## Features
- **Discover:** a ready-made catalog of 102 titles (69 movies, 33 shows), search, movie/show and genre filters, sorting.
- **Automatic posters:** posters for shows in the catalog come from TVmaze automatically. If you enter a TMDB key, movie posters come too.
- **Add a title:** type its name and pick from the results with posters; it's added to your list with year, genre, runtime and episode count. You can also add it manually.
- **My list:** Watching, Plan to watch, Watched, Dropped, Favorites.
- **Details:** status, rating out of 10, notes, favorite, episode counter for shows, "Open on IMDb".
- **What should I watch?:** a suggestion wheel that filters by mood, length and source.
- **Stats:** movies and episodes watched, total hours, average rating, genre breakdown, last 6 months, top-rated titles.
- **Badges:** 14 achievements.
- Light/dark theme, JSON backup download/upload. Data stays in the browser (`localStorage`).

## TMDB key (optional)
Create a free account at themoviedb.org → Settings → API → copy the "API Key" value → in Seyirlik, ⚙ Settings → paste it into the Automatic posters field. The key is stored only in this browser and is not included in backup files.

## Files
- `index.html` page structure · `stil.css` styles · `katalog.js` built-in catalog · `uygulama.js` all behavior

## Credits
Show data and posters: [TVmaze](https://www.tvmaze.com) (CC BY-SA). Movie data: [TMDB](https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB. Catalog summaries were written for Seyirlik.
