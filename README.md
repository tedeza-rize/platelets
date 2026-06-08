# Platelets

Responsive Next.js map UI with a top navigation bar and selectable VWorld or
OpenStreetMap tile layers.

## Environment

Create `.env.local` in the project root and set the keys you need:

```bash
NEXT_PUBLIC_VWORLD_API_KEY=your_vworld_api_key
NAVER_MAPS_CLIENT_ID=your_naver_maps_client_id
NAVER_MAPS_CLIENT_SECRET=your_naver_maps_client_secret
PUBLIC_DATA_API_KEY=your_data_go_kr_service_key
```

VWorld is the default provider. If the key is missing, the UI keeps the VWorld
selection visible and falls back to OSM tiles while showing a localized status
message.

`PUBLIC_DATA_API_KEY` is shared by public data portal integrations such as AED
and Korea Meteorological Administration earthquake/tsunami events.

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
