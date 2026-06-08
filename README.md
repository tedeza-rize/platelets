# Platelets

Responsive Next.js map UI with a top navigation bar and selectable vector
basemaps.

## Environment

Create `.env.local` in the project root and set the keys you need:

```bash
NAVER_MAPS_CLIENT_ID=your_naver_cloud_platform_maps_api_key_id
NAVER_MAPS_CLIENT_SECRET=your_naver_cloud_platform_maps_api_key
PUBLIC_DATA_API_KEY=your_data_go_kr_service_key
```

VWorld and OSM map choices both load MapLibre vector styles instead of raster
tile layers.

`PUBLIC_DATA_API_KEY` is shared by public data portal integrations such as AED
and Korea Meteorological Administration earthquake/tsunami events.

`NAVER_MAPS_CLIENT_ID` and `NAVER_MAPS_CLIENT_SECRET` must be the Naver Cloud
Platform Maps Geocoding API Key ID and API Key used with the
`x-ncp-apigw-api-key-id` and `x-ncp-apigw-api-key` headers.

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
