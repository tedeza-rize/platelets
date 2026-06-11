# Fire Safety Big Data Platform CSV Imports

Place approved CSV downloads from the Fire Safety Big Data Platform here.

For local MVP/demo data, run:

```powershell
npm run download:bigdata119
```

That command downloads the platform's public `sample_info` XLSX files, converts
them to the recommended CSV names below, and writes `manifest.json` with the
source product/file metadata. Full CSV files are exposed by the platform through
its login/free-purchase flow, so they still need to be obtained with an approved
account before operational or public release use.

Recommended names:

- `seoul-fire-safety-targets.csv`
- `seoul-fire-water-sources.csv`
- `busan-fire-safety-targets.csv`
- `busan-fire-water-sources.csv`
- `national-fire-force.csv`

Also accepted:

- `서울소방재난본부_특정소방대상물 현황.csv`
- `특정소방대상물_2024.csv`
- `서울소방재난본부_소방용수 현황.csv`
- `소방용수_2024.csv`
- `부산소방재난본부_특정소방대상물 현황_2025_부산.csv`
- `부산소방재난본부_특정소방대상물 현황.csv`
- `부산소방재난본부_소방용수 현황_2025_부산.csv`
- `부산소방재난본부_소방용수 현황.csv`
- `화재_소방력_2021_전국.csv`
- `전국_시군구별_화재현황_소방력.csv`
- `시군구별 화재현황 및 소방력 정보.csv`

Sources:

| Local file | Platform product | Goods management serial | Goods ID | Public sample rows | Full CSV files listed by platform |
| --- | --- | --- | --- | ---: | --- |
| `seoul-fire-safety-targets.csv` | 서울소방재난본부_특정소방대상물 현황 | [378](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=378) | `C1440102` | 10 | `특정소방대상물_2024.csv`, `특정소방대상물_2023.csv`, `특정소방대상물_2022.csv` |
| `seoul-fire-water-sources.csv` | 서울소방재난본부_소방용수 현황 | [380](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=380) | `C1440302` | 10 | `소방용수_2024.csv`, `소방용수_2023.csv`, `소방용수_2022.csv` |
| `busan-fire-safety-targets.csv` | 부산소방재난본부_특정소방대상물 현황 | [404](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=404) | `C1540101` | 10 | `부산소방재난본부_특정소방대상물 현황_2025_부산.csv`, `특정소방대상물_2023.csv`, `특정소방대상물_2022.csv`, `특정소방대상물_2021.csv` |
| `busan-fire-water-sources.csv` | 부산소방재난본부_소방용수 현황 | [403](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=403) | `C1530202` | 10 | `부산소방재난본부_소방용수 현황_2025_부산.csv`, `소방용수_2023.csv`, `소방용수_2022.csv` |
| `national-fire-force.csv` | 전국 시군구별 화재현황 및 소방력 정보 | [9](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=9) | `C0000008` | 10 | `화재_소방력_2021_전국.csv` |

`manifest.json` stores the exact `downloadedAt`, sample download URLs,
platform file serials, listed full CSV file names, issued dates, and file sizes
captured by `npm run download:bigdata119`.

If these files are absent, the importer uses clearly marked presentation sample
records so local demos still render map layers.

The national fire/force CSV is consumed by the disaster-response risk scoring
service rather than imported as map points. It influences regional risk factors
and resource placement recommendations.
