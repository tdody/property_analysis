# Property Card Images — Design Spec

## Overview

Add images to property tiles on the home page. Redfin-sourced properties display the listing photo (URL stored in DB). Non-Redfin properties show a static SVG icon based on property type.

## Backend Changes

### Property Model

Add one field to `Property`:

| Field | Type | Default | Nullable |
|-------|------|---------|----------|
| `image_url` | `String(500)` | None | Yes |

### Scraper Changes

In `redfin.py`, extract the image URL from the JSON-LD `photo` field. Redfin JSON-LD blocks typically include:

```json
{
  "@type": "SingleFamilyResidence",
  "photo": "https://ssl.cdn-redfin.com/photo/...",
  ...
}
```

Add `image_url: str | None = None` to `ScrapedPropertyData` in `models.py`.

In `extract_from_jsonld`, extract `photo` from the JSON-LD dict. In `scrape_redfin_property`, map it to `data.image_url`.

In the scrape endpoint (`properties.py` router), persist `image_url` to the `Property` model when creating from scraped data.

### Schemas

Add `image_url: str | None = None` to:
- `PropertyCreate`
- `PropertyUpdate`
- `PropertyResponse`
- `PropertySummary`

### Migration

Alembic migration adding:
- `properties.image_url` (`String(500)`, nullable, no default)

## Frontend Changes

### Types

Add `image_url: string | null` to `Property` and `PropertySummary` interfaces.

### Property Type Icons

Create `frontend/src/components/shared/PropertyTypeIcon.tsx` with static inline SVGs for each property type:

| `property_type` | Icon |
|-----------------|------|
| `single_family` | House silhouette |
| `condo` | Building |
| `townhouse` | Townhouse row |
| `multi_family` | Apartment building |
| `apartment` | Apartment building (same as multi_family) |
| Default | Generic house |

Each icon renders as a centered SVG on a soft gradient background (slate-100 to slate-200), sized to fill the card's image area.

### PropertyCard Changes

Add an image area at the top of each card (before the gradient bar):

- **If `image_url` is set**: Render `<img>` with `object-cover` styling, fixed height (~160px). On error (`onError`), fall back to the property type icon.
- **If `image_url` is null**: Render the property type icon as the fallback.

The image area should be:
- Full width of the card
- Fixed height (h-40 / 160px)
- Rounded top corners to match card styling
- `object-cover` to crop to fill without distortion

### Layout

```
┌─────────────────────┐
│     Image / Icon     │  ← new (160px)
├─────────────────────┤
│ ▰▰▰▰▰ gradient bar  │  ← existing
│ Property Name        │
│ City, State          │
│ $425,000 · 3bd 2ba  │
│ ┌────────┐┌────────┐│
│ │Cashflow││CoC Ret ││
│ └────────┘└────────┘│
│ [View]      [Delete] │
└─────────────────────┘
```

## Tests

### Backend

- Scraper test: verify `image_url` extracted from JSON-LD `photo` field
- Scraper test: verify `image_url` is None when no photo in JSON-LD
- API test: verify `image_url` returned in PropertySummary

### Frontend

No automated tests — visual verification that:
- Redfin properties show listing photo
- Manual properties show property type icon
- Broken image URLs fall back to icon
