# Lowe's Lumber Unit Price (Edge extension)

Adds a small badge under each price on lowes.com showing:

- **Sheet goods** (plywood, OSB, MDF, panels): `$ / sq ft` and total sq ft
- **Dimensional lumber, boards, trim**: `$ / ft` (linear) and `$ / bd ft`

The cheapest item in each comparable group on the page gets a green **Best value** badge.
Groups are the same sheet thickness, or the same nominal lumber size (all 2x4s compared with each other, and so on).

## Install

1. Open `edge://extensions`.
2. Turn on **Developer mode** (bottom-left).
3. Click **Load unpacked** and pick this `lowes-unit-price` folder.
4. Reload a lowes.com search or category page.

After editing the files, click **Reload** on the extension card.

## How it works

The size comes from the product title, e.g. `2-in x 4-in x 8-ft` or `1/2-in x 4-ft x 8-ft`.
Fractions and mixed numbers like `92-5/8-in` are handled.

- If the last two dimensions are both 16 in or more, it's a sheet: area = width x length.
- Otherwise it's linear stock: length = last dimension.
- Board feet use the nominal size from the title (2x4 = 2 x 4), the way lumber is normally quoted.

Where it shows up: search and category grids, the "You may also like" carousels, and product pages (using the page's structured data, badge under the title).

Products with no `A x B x C` size in the title are skipped.

## License
MIT. See `LICENSE`.
