import Link from "next/link";
import { DATA_LICENSE_ENTRIES } from "@/lib/data-licenses";

export default function LicensesPage() {
  return (
    <main className="licensePage">
      <header className="licenseHeader">
        <Link href="/">지도</Link>
        <h1>데이터 출처 및 라이선스</h1>
        <p>
          외부 데이터와 생성된 파생 파일은 공개 저장소와 납품 환경 모두에서
          출처와 이용 조건을 추적해야 합니다.
        </p>
      </header>

      <section className="licenseList">
        {DATA_LICENSE_ENTRIES.map((entry) => (
          <article className="licenseCard" key={entry.id}>
            <div>
              <span>{entry.id}</span>
              <h2>{entry.sourceName}</h2>
            </div>
            <dl>
              <div>
                <dt>제공기관</dt>
                <dd>{entry.provider}</dd>
              </div>
              <div>
                <dt>사용처</dt>
                <dd>{entry.usage}</dd>
              </div>
              <div>
                <dt>라이선스</dt>
                <dd>{entry.license}</dd>
              </div>
              <div>
                <dt>출처</dt>
                <dd>
                  <a href={entry.sourceUrl} rel="noreferrer" target="_blank">
                    {entry.sourceUrl}
                  </a>
                </dd>
              </div>
              <div>
                <dt>비고</dt>
                <dd>{entry.notes}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </main>
  );
}
