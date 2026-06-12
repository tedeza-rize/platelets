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
- `seoul-119-call-reception.csv`
- `busan-ems-dispatches.csv`
- `busan-rescue-dispatches.csv`
- `jeonbuk-119-call-reception.csv`

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
- `서울소방재난본부_119신고접수 현황.csv`
- `신고접수_2024.csv`
- `부산소방재난본부_구급출동 현황_2023_부산.csv`
- `부산소방재난본부_구급출동 현황.csv`
- `부산소방재난본부_구조출동 현황_2024_부산.csv`
- `부산소방재난본부_구조출동 현황.csv`
- `전북특별자치도소방본부_119신고접수 현황.csv`
- `신고접수현황_2023.csv`

Sources:

| Local file | Platform product | Goods management serial | Goods ID | Public sample rows | Full CSV files listed by platform |
| --- | --- | --- | --- | ---: | --- |
| `seoul-fire-safety-targets.csv` | 서울소방재난본부_특정소방대상물 현황 | [378](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=378) | `C1440102` | 10 | `특정소방대상물_2024.csv`, `특정소방대상물_2023.csv`, `특정소방대상물_2022.csv` |
| `seoul-fire-water-sources.csv` | 서울소방재난본부_소방용수 현황 | [380](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=380) | `C1440302` | 10 | `소방용수_2024.csv`, `소방용수_2023.csv`, `소방용수_2022.csv` |
| `busan-fire-safety-targets.csv` | 부산소방재난본부_특정소방대상물 현황 | [404](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=404) | `C1540101` | 10 | `부산소방재난본부_특정소방대상물 현황_2025_부산.csv`, `특정소방대상물_2023.csv`, `특정소방대상물_2022.csv`, `특정소방대상물_2021.csv` |
| `busan-fire-water-sources.csv` | 부산소방재난본부_소방용수 현황 | [403](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=403) | `C1530202` | 10 | `부산소방재난본부_소방용수 현황_2025_부산.csv`, `소방용수_2023.csv`, `소방용수_2022.csv` |
| `national-fire-force.csv` | 전국 시군구별 화재현황 및 소방력 정보 | [9](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=9) | `C0000008` | 10 | `화재_소방력_2021_전국.csv` |
| `seoul-119-call-reception.csv` | 서울소방재난본부_119신고접수 현황 | [377](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=377) | `C1430101` | 100 | `신고접수_2024.csv`, `신고접수_2023.csv`, `신고접수_2022.csv`, `신고접수_2021.csv`, `신고접수_2020.csv`, `신고접수_2019.csv`, `신고접수_2018.csv`, `신고접수_2017.csv` |
| `busan-ems-dispatches.csv` | 부산소방재난본부_구급출동 현황 | [390](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=390) | `C1510101` | 10 | `부산소방재난본부_구급출동 현황_2023_부산.csv`, `구급출동_2022.csv`, `구급출동_2021_2019.csv`, `구급출동_2018_2016.csv` |
| `busan-rescue-dispatches.csv` | 부산소방재난본부_구조출동 현황 | [381](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=381) | `C1500101` | 10 | `부산소방재난본부_구조출동 현황_2024_부산.csv`, `구조출동_2023.csv`, `구조출동_2022.csv`, `구조출동_2021.csv` |
| `jeonbuk-119-call-reception.csv` | 전북특별자치도소방본부_119신고접수 현황 | [296](https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=296) | `C1130111` | 110 | `신고접수현황_2015.csv`, `신고접수현황_2016.csv`, `신고접수현황_2021.csv`, `신고접수현황_2022.csv`, `신고접수현황_2019.csv`, `신고접수현황_2018.csv`, `신고접수현황_2017.csv`, `신고접수현황_2023.csv`, `신고접수현황_2020.csv`, `신고접수현황_2014.csv`, `신고접수현황_2013.csv`, `신고접수현황_2012.csv`, `신고접수현황_2011.csv` |

`manifest.json` stores the exact `downloadedAt`, sample download URLs,
platform file serials, listed full CSV file names, issued dates, and file sizes
captured by `npm run download:bigdata119`.

If these files are absent, the importer uses clearly marked presentation sample
records so local demos still render map layers.

Current MVP usage:

- `seoul-fire-safety-targets.csv` and `busan-fire-safety-targets.csv` are
  loaded directly by the disaster dashboard and rendered as the
  `특정소방대상물` map layer.
- `seoul-fire-water-sources.csv` and `busan-fire-water-sources.csv` are loaded
  directly by the disaster dashboard and rendered as the `소방용수` map layer.
- The four facility/water CSV products are summarized in the dashboard side
  panel so evaluators can confirm which Fire Safety Big Data Platform products
  are driving the visible map points.
- `national-fire-force.csv` is consumed by `RiskPredictionService` rather than
  imported as map points. It influences rule-based regional risk scoring,
  risk-factor explanations, and resource placement recommendations.
- `seoul-119-call-reception.csv`, `busan-ems-dispatches.csv`,
  `busan-rescue-dispatches.csv`, and `jeonbuk-119-call-reception.csv` are
  summarized by `bigdata119-operational-data.ts`. Their region, type, time, and
  dispatch-distance fields are shown in the dashboard and add a bounded
  rule-based operational-load factor to matching risk areas.
