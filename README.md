# Platelets

Responsive Next.js map UI with a top navigation bar and selectable VWorld or
OpenStreetMap tile layers.

## Environment

Create `.env.local` in the project root and set the VWorld browser key:

```bash
NEXT_PUBLIC_VWORLD_API_KEY=your_vworld_api_key
```

VWorld is the default provider. If the key is missing, the UI keeps the VWorld
selection visible and falls back to OSM tiles while showing a localized status
message.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm run lint
npm run build
npm run format
```
