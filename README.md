# Multiview

A full-screen, no-wasted-space grid player for watching several live streams
at once. Paste in stream URLs (HLS `.m3u8` or an iframe embed), pick a stream
count, and go full screen.

## Running it

No build step, no install — just serve the folder as static files and open
it in Chrome:

```
python -m http.server 8743
```

Then open **http://localhost:8743**.

(Opening `index.html` directly via `file://` mostly works too, but some
stream hosts block `null`-origin requests — a local server avoids that.)

## Using it

- **Streams: 2 / 4 / 6 / 8 / 9** sets the slot count, or use **+ Slot** to
  add one at a time (any count works — these buttons are just shortcuts).
- Each slot: a label, a type (**HLS** for a direct `.m3u8` link, **Iframe
  embed** for a page that only gives you an embeddable player), and the URL.
  The stream loads as soon as you leave the URL field (Tab/Enter/click away);
  clicking into the URL field selects its current contents so pasting a new
  link replaces it in one step.
- **▾ Hide URLs / ▸ Show URLs** collapses the slot-editing panel so the grid
  reclaims that vertical space — handy once your streams are already set and
  you just want more picture. State is remembered between visits.
- **Click a tile** to make it the audio tile — every other tile mutes
  automatically. Click again to un-focus (mute everything).
- **Drag a tile** onto another to swap their positions.
- **Full Screen** (or press `F`) hides all UI chrome — just the grid, edge to
  edge. `Esc` or `F` again exits.
- Keyboard shortcuts (when not typing in a field): `F` fullscreen, `1`-`9`
  focus audio on tile N, `M` mute/unmute the focused tile.
- **Presets**: type a name and hit **Save** to store the current set of
  streams; reload any saved preset from the dropdown. Your last-used layout
  is also remembered automatically between visits.

## How the grid sizes itself

`js/tiling.js` computes a **full-bleed** layout: every row's tiles are
stretched to exactly fill the container's width, and rows stack to exactly
fill its height, so there is never leftover black space — the whole screen
is picture. Among the possible row/column splits for the current tile
count, it picks whichever one keeps each tile's cell closest to a 16:9
shape (minimizing cropping). Because the fill is exact rather than
aspect-preserving, each tile's video uses `object-fit: cover` and gets
cropped slightly (not letterboxed) to fill its cell — the same tradeoff
video-wall / security-camera UIs make.

The layout recalculates on every resize (including entering/exiting full
screen), so it adapts correctly whether you're on an ultrawide monitor, a
laptop screen, or a TV over HDMI.

## Project layout

```
index.html        page shell
css/style.css      layout, theme, fullscreen chrome-hiding
js/tiling.js        grid-packing algorithm
js/player.js         per-tile media (hls.js video or iframe)
js/storage.js        localStorage presets + last-used layout
js/app.js            wiring: UI, grid sync, fullscreen, shortcuts, DnD
```

## Notes

- HLS playback uses [hls.js](https://github.com/video-dev/hls.js); Safari
  plays `.m3u8` natively and skips it.
- This is a generic player — it has no built-in stream directory. You
  provide the URLs.
