import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import type {
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { assertAiBaseUrlSafe, getAiSettings } from "@/lib/ai-settings";
import {
  type CoordinatePair,
  isWithinKoreaCoordinates,
} from "@/lib/coordinates";
import { searchKakaoLocalCoordinates } from "@/lib/geocoding";
import {
  type AssemblyProtestInput,
  type AssemblyProtestUpdateResult,
  listAssemblyProtests,
  recordApiLog,
  replaceAssemblyProtestsForDate,
} from "@/lib/points-db";
import { getRuntimeApiKeys } from "@/lib/runtime-config";

declare global {
  // Required by @rhwp/core while laying out HWP/HWPX pages.
  var measureTextWidth: ((font: string, text: string) => number) | undefined;
}

export type AssemblyPoliceAgency =
  | "seoul"
  | "busan"
  | "daegu"
  | "incheon"
  | "gwangju"
  | "daejeon"
  | "ulsan"
  | "sejong"
  | "gyeonggi-south"
  | "gyeonggi-north"
  | "gangwon"
  | "chungbuk"
  | "chungnam"
  | "jeonbuk"
  | "jeonnam"
  | "gyeongbuk"
  | "gyeongnam"
  | "jeju";

type AssemblySourceType = "gn-json" | "html-table" | "legacy-board";

type AssemblySource = {
  agency: string;
  id: AssemblyPoliceAgency;
  listUrl: string;
  sourceType: AssemblySourceType;
};

type BoardPost = {
  attachmentUrls: string[];
  detailUrl: string | null;
  recordId: string;
  text: string | null;
  title: string;
};

type AssemblyParsedEvent = {
  crowdSize?: number | null;
  endsAt?: string | null;
  location?: string | null;
  locationScope?: string | null;
  startsAt?: string | null;
};

type AssemblyCoordinateMatch = CoordinatePair & {
  matchedAddress: string | null;
  query: string;
  source: string;
};

type GeocodePlaceToolArguments = {
  query: string;
  searchMode: "address" | "both" | "keyword";
};

type AssemblyCoordinateResolver = (params: {
  agency: AssemblyPoliceAgency;
  agencyName: string;
  date: string;
  detailText: string;
  location: string;
  locationScope: string | null;
  title: string;
}) => Promise<AssemblyCoordinateMatch | null>;

type AssemblyCrawlOptions = {
  agency?: AssemblyPoliceAgency;
  coordinateResolver?: AssemblyCoordinateResolver;
  date: string;
  enrichLocations?: boolean;
};

type GyeongnamBoardListResponse = {
  list?: Array<{
    BBS_ID?: string;
    CPDS_CONTENT?: string;
    CPDS_NAME?: string;
    CPDS_SUBJECT?: string;
    CPDS_WDATE?: string;
    IPDS_IDX?: string;
    IPDS_NUM?: number;
  }>;
};

export const ASSEMBLY_SOURCES: AssemblySource[] = [
  {
    agency: "Seoul Metropolitan Police Agency",
    id: "seoul",
    listUrl: "https://smpa.go.kr/user/nd54882.do",
    sourceType: "html-table",
  },
  {
    agency: "Busan Metropolitan Police Agency",
    id: "busan",
    listUrl: "https://www.bspolice.go.kr/view.do?no=72",
    sourceType: "html-table",
  },
  {
    agency: "Daegu Metropolitan Police Agency",
    id: "daegu",
    listUrl: "https://www.dgpolice.go.kr/bbs/List.do?bbsId=d495f174",
    sourceType: "html-table",
  },
  {
    agency: "Incheon Metropolitan Police Agency",
    id: "incheon",
    listUrl:
      "https://www.icpolice.go.kr/board/rg4_board/list.php?bbs_code=ic015",
    sourceType: "legacy-board",
  },
  {
    agency: "Gwangju Metropolitan Police Agency",
    id: "gwangju",
    listUrl: "https://gjpolice.go.kr/sub.do?r=gjpolice&mid=7020030",
    sourceType: "legacy-board",
  },
  {
    agency: "Daejeon Metropolitan Police Agency",
    id: "daejeon",
    listUrl: "https://www.djpolice.go.kr/",
    sourceType: "html-table",
  },
  {
    agency: "Ulsan Metropolitan Police Agency",
    id: "ulsan",
    listUrl: "https://www.uspolice.go.kr/m/board.jsp?tab=bo20141217142954",
    sourceType: "legacy-board",
  },
  {
    agency: "Sejong Police Agency",
    id: "sejong",
    listUrl: "https://www.sjpolice.go.kr/SEO/SJ/main.php?bo=sjpol2&mxPn=02_02",
    sourceType: "legacy-board",
  },
  {
    agency: "Gyeonggi Nambu Provincial Police Agency",
    id: "gyeonggi-south",
    listUrl: "https://www.ggpolice.go.kr/main/bbslist.do?bbsId=FD2",
    sourceType: "html-table",
  },
  {
    agency: "Gyeonggi Bukbu Provincial Police Agency",
    id: "gyeonggi-north",
    listUrl:
      "https://www.ggbpolice.go.kr/main/cop/bbs/selectBoardList.do?bbsId=Assembly_main",
    sourceType: "html-table",
  },
  {
    agency: "Gangwon Provincial Police Agency",
    id: "gangwon",
    listUrl: "https://www.gwpolice.go.kr/gw/sub02/sub02_05.jsp?groupNo=11026",
    sourceType: "legacy-board",
  },
  {
    agency: "Chungbuk Provincial Police Agency",
    id: "chungbuk",
    listUrl:
      "https://www.cbpolice.go.kr/main_sub/sub.php?folder_idx=2&folder_page_idx=18",
    sourceType: "legacy-board",
  },
  {
    agency: "Chungnam Provincial Police Agency",
    id: "chungnam",
    listUrl: "https://www.cnpolice.go.kr/2014/main.php?mxPn=3_1_1",
    sourceType: "legacy-board",
  },
  {
    agency: "Jeonbuk Provincial Police Agency",
    id: "jeonbuk",
    listUrl:
      "https://www.jbpolice.go.kr/index.police?menuCd=DOM_000000202008000000",
    sourceType: "html-table",
  },
  {
    agency: "Jeonnam Provincial Police Agency",
    id: "jeonnam",
    listUrl: "https://www.jnpolice.go.kr/?pid=AP0306",
    sourceType: "legacy-board",
  },
  {
    agency: "Gyeongbuk Provincial Police Agency",
    id: "gyeongbuk",
    listUrl: "https://www.gbpolice.go.kr/bbs/List.do?bbsId=8&sid=gbpolice",
    sourceType: "html-table",
  },
  {
    agency: "Gyeongnam Provincial Police Agency",
    id: "gyeongnam",
    listUrl: "https://www.gnpolice.go.kr/gnpolice/page.do?MENU_ID=NF05",
    sourceType: "gn-json",
  },
  {
    agency: "Jeju Provincial Police Agency",
    id: "jeju",
    listUrl: "https://www.jjpolice.go.kr/jjpolice/notice/assembly.htm",
    sourceType: "html-table",
  },
];

const ASSEMBLY_TEXT_PATTERN = /\uC9D1\uD68C|\uC2DC\uC704/u;
const ATTACHMENT_TEXT_LIMIT = 12_000;
const ATTACHMENT_DOWNLOAD_LIMIT_BYTES = 4_000_000;
const DETAIL_TEXT_LIMIT = 12_000;
export const ASSEMBLY_GEOCODE_PLACE_TOOL = {
  function: {
    description:
      "Resolve one Korean place, landmark, station exit, plaza, or address query to coordinates using the configured map/geocoding provider. Returns no raw provider payload.",
    name: "geocode_place",
    parameters: {
      additionalProperties: false,
      properties: {
        query: {
          description:
            "One Korean map search query copied or conservatively normalized from the parsed police notice.",
          maxLength: 160,
          minLength: 1,
          type: "string",
        },
        searchMode: {
          enum: ["both", "keyword", "address"],
          type: "string",
        },
      },
      required: ["query", "searchMode"],
      type: "object",
    },
  },
  type: "function",
} satisfies ChatCompletionTool;
const GYEONGNAM_BBS_ID = "GNPMNG_D101";
const USER_AGENT =
  "Platelets public-safety data crawler (contact: local operator)";
const PDFJS_LEGACY_MODULE = ["pdfjs-dist", "legacy/build/pdf.mjs"].join("/");
let rhwpCorePromise: Promise<typeof import("@rhwp/core")> | null = null;
const AGENCY_GEOCODING_PREFIX: Record<AssemblyPoliceAgency, string> = {
  busan: "\uBD80\uC0B0",
  chungbuk: "\uCDA9\uBD81",
  chungnam: "\uCDA9\uB0A8",
  daegu: "\uB300\uAD6C",
  daejeon: "\uB300\uC804",
  gangwon: "\uAC15\uC6D0",
  gwangju: "\uAD11\uC8FC",
  "gyeonggi-north": "\uACBD\uAE30\uBD81\uBD80",
  "gyeonggi-south": "\uACBD\uAE30",
  gyeongbuk: "\uACBD\uBD81",
  gyeongnam: "\uACBD\uB0A8",
  incheon: "\uC778\uCC9C",
  jeju: "\uC81C\uC8FC",
  jeonbuk: "\uC804\uBD81",
  jeonnam: "\uC804\uB0A8",
  sejong: "\uC138\uC885",
  seoul: "\uC11C\uC6B8",
  ulsan: "\uC6B8\uC0B0",
};

const HTML_ENTITY_REPLACEMENTS: Record<string, string> = {
  "#39": "'",
  amp: "&",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
  rarr: "->",
};

type PdfTextItem = {
  str?: string;
};

type PdfJsModule = {
  getDocument: (params: {
    data: Uint8Array;
    disableFontFace?: boolean;
    useSystemFonts?: boolean;
  }) => {
    destroy: () => Promise<void>;
    promise: Promise<{
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{ items: PdfTextItem[] }>;
      }>;
      numPages: number;
    }>;
  };
};

function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(#\d+|#39|amp|gt|lt|nbsp|quot|rarr);/g,
    (match, entity: string) => {
      if (entity.startsWith("#") && entity !== "#39") {
        const codepoint = Number(entity.slice(1));
        return Number.isFinite(codepoint)
          ? String.fromCodePoint(codepoint)
          : match;
      }

      return HTML_ENTITY_REPLACEMENTS[entity] ?? match;
    },
  );
}

function removeAngleBracketMarkup(value: string) {
  let result = "";
  let insideMarkup = false;

  for (const character of value) {
    if (character === "<") {
      insideMarkup = true;
      result += " ";
      continue;
    }

    if (character === ">") {
      insideMarkup = false;
      result += " ";
      continue;
    }

    if (!insideMarkup) {
      result += character;
    }
  }

  return result;
}

function firstAngleBracketContent(value: string) {
  const start = value.indexOf("<");
  if (start < 0) return null;

  const end = value.indexOf(">", start + 1);
  if (end < 0) return null;

  const content = value
    .slice(start + 1, end)
    .replace(/\s+/g, " ")
    .trim();
  return content && !/^-+$/.test(content) ? content : null;
}

function stripHtml(value: string) {
  return removeAngleBracketMarkup(decodeHtmlEntities(value))
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(url: string) {
  const response = await fetch(url, {
    headers: {
      "accept-language": "ko-KR,ko;q=0.9,en;q=0.5",
      "user-agent": USER_AGENT,
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const bytes = await response.arrayBuffer();
  const asciiPreview = Buffer.from(bytes).toString("latin1").slice(0, 4096);
  const charset =
    contentType.match(/charset=([^;\s]+)/i)?.[1] ??
    asciiPreview.match(/charset=["']?([^"'>;\s]+)/i)?.[1] ??
    "utf-8";
  const html = new TextDecoder(charset).decode(bytes);

  return { html, url: response.url };
}

function dateParts(date: string) {
  const [, year, month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  return year && month && day
    ? {
        day: Number(day),
        month: Number(month),
        shortYear: year.slice(2),
        year: Number(year),
      }
    : null;
}

function dateTokens(date: string) {
  const parts = dateParts(date);
  if (!parts) return [];
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");

  return [
    `${parts.shortYear}${month}${day}`,
    `${parts.shortYear}.${month}.${day}`,
    `'${parts.shortYear}.${month}.${day}`,
    `${parts.year}.${parts.month}.${parts.day}`,
    `${parts.year}. ${parts.month}. ${parts.day}`,
    `${month}${day}`,
    `${month}.${day}`,
    `${parts.month}.${parts.day}`,
    `${parts.month}. ${parts.day}`,
    `${parts.month}/${parts.day}`,
    `${parts.shortYear}\uB144${parts.month}\uC6D4${parts.day}\uC77C`,
    `${parts.shortYear}\uB144 ${parts.month}\uC6D4 ${parts.day}\uC77C`,
    `${parts.month}\uC6D4${parts.day}\uC77C`,
    `${parts.month}\uC6D4 ${parts.day}\uC77C`,
  ];
}

function dayWithinRange(params: {
  endDay: number;
  endMonth: number;
  targetDay: number;
  targetMonth: number;
}) {
  if (
    params.targetMonth < params.endMonth &&
    params.targetMonth > params.endMonth - 2
  ) {
    return params.targetDay >= 1;
  }
  return (
    params.targetMonth === params.endMonth && params.targetDay <= params.endDay
  );
}

function titleRangeMatchesDate(title: string, date: string) {
  const parts = dateParts(date);
  if (!parts || !title.includes("~")) return false;

  const compact = title.replace(/\s+/g, "");
  const numericRange = compact.match(/(\d{2})(\d{2}).*~.*?(\d{2})(\d{2})/);
  if (numericRange) {
    const startMonth = Number(numericRange[1]);
    const startDay = Number(numericRange[2]);
    const endMonth = Number(numericRange[3]);
    const endDay = Number(numericRange[4]);
    return (
      parts.month === startMonth &&
      parts.day >= startDay &&
      dayWithinRange({
        endDay,
        endMonth,
        targetDay: parts.day,
        targetMonth: parts.month,
      })
    );
  }

  const dottedRange = compact.match(
    /(\d{1,2})\.(\d{1,2})\.?.*~(?:(\d{1,2})\.)?(\d{1,2})/,
  );
  if (dottedRange) {
    const startMonth = Number(dottedRange[1]);
    const startDay = Number(dottedRange[2]);
    const endMonth = Number(dottedRange[3] ?? dottedRange[1]);
    const endDay = Number(dottedRange[4]);
    return (
      parts.month === startMonth &&
      parts.day >= startDay &&
      dayWithinRange({
        endDay,
        endMonth,
        targetDay: parts.day,
        targetMonth: parts.month,
      })
    );
  }

  return false;
}

function titleMatchesDate(title: string, date: string) {
  const compact = title.replace(/\s+/g, "");
  return (
    dateTokens(date).some((token) =>
      compact.includes(token.replace(/\s+/g, "")),
    ) || titleRangeMatchesDate(title, date)
  );
}

function extractRows(html: string) {
  return [...html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
}

function extractCells(rowHtml: string) {
  return [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
    (match) => stripHtml(match[1]),
  );
}

function extractDetailUrl(rowHtml: string, baseUrl: string) {
  const seoulMatch = rowHtml.match(
    /goBoardView\('([^']+)'\s*,\s*'View'\s*,\s*'([^']+)'\)/,
  );
  if (seoulMatch) {
    return new URL(
      `${decodeHtmlEntities(seoulMatch[1])}?View&boardNo=${seoulMatch[2]}`,
      baseUrl,
    ).toString();
  }

  const ggbMatch = rowHtml.match(
    /fn_inqire_notice\('([^']+)'\s*,\s*'([^']+)'\)/,
  );
  if (ggbMatch) {
    return new URL(
      `/main/cop/bbs/anonymous/selectBoardArticle.do?nttId=${ggbMatch[1]}&bbsId=${ggbMatch[2]}`,
      baseUrl,
    ).toString();
  }

  const busanMatch = rowHtml.match(
    /linkPage\(\s*\d+\s*,\s*'view'\s*,\s*'([^']+)'\s*\)/,
  );
  if (busanMatch) {
    return new URL(
      `/view.do?no=72&seq=1&view=view&idx=${busanMatch[1]}`,
      baseUrl,
    ).toString();
  }

  const hrefMatch = rowHtml.match(
    /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/i,
  );
  if (!hrefMatch) return null;

  const href = decodeHtmlEntities(hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3]);
  if (href === "#" || href.startsWith("#")) {
    return null;
  }

  try {
    const resolved = new URL(href, baseUrl);
    return resolved.protocol === "http:" || resolved.protocol === "https:"
      ? resolved.toString()
      : null;
  } catch {
    return null;
  }
}

function extractRecordId(
  rowHtml: string,
  cells: string[],
  detailUrl: string | null,
) {
  const seoulMatch = rowHtml.match(
    /goBoardView\('[^']+'\s*,\s*'View'\s*,\s*'([^']+)'\)/,
  );
  if (seoulMatch) return seoulMatch[1];

  const ggbMatch = rowHtml.match(
    /fn_inqire_notice\('([^']+)'\s*,\s*'([^']+)'\)/,
  );
  if (ggbMatch) return `${ggbMatch[2]}:${ggbMatch[1]}`;

  const busanMatch = rowHtml.match(
    /linkPage\(\s*\d+\s*,\s*'view'\s*,\s*'([^']+)'\s*\)/,
  );
  if (busanMatch) return busanMatch[1];

  const detailRecordId =
    detailUrl?.match(
      /[?&](?:IPDS_IDX|bd_num|boardNo|dataSid|idx|ku|num|nttId|seq|wr_id)=([^&]+)/,
    )?.[1] ?? null;

  return detailRecordId ?? cells[0] ?? "unknown";
}

function extractAttachmentUrls(html: string, baseUrl: string) {
  return [
    ...html.matchAll(/<a\b[^>]*href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi),
  ]
    .map((match) => decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? ""))
    .filter((href) =>
      /download|file|atch|\.pdf(?:[?#]|$)|\.hwp(?:[?#]|$)|\.hwpx(?:[?#]|$)/i.test(
        href,
      ),
    )
    .map((href) => {
      try {
        return new URL(href, baseUrl).toString();
      } catch {
        return null;
      }
    })
    .filter((href): href is string => href !== null);
}

function attachmentExtension(url: string) {
  const pathname = new URL(url).pathname.toLowerCase();
  return pathname.match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

function cleanExtractedDocumentText(value: string) {
  return removeAngleBracketMarkup(decodeHtmlEntities(value))
    .replace(/\\[rnt]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ATTACHMENT_TEXT_LIMIT);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
) {
  const output = new Array<R>(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, worker),
  );
  return output;
}

async function extractPdfText(buffer: Buffer) {
  const pdfjs = (await import(PDFJS_LEGACY_MODULE)) as PdfJsModule;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;

  try {
    const pageCount = Math.min(document.numPages, 10);
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => item.str ?? "")
          .filter(Boolean)
          .join(" "),
      );
    }

    return cleanExtractedDocumentText(pages.join(" "));
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

function extractSvgText(svg: string) {
  return cleanExtractedDocumentText(
    [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)]
      .map((match) => match[1])
      .join(" ") || svg,
  );
}

async function loadRhwpCore() {
  if (!rhwpCorePromise) {
    rhwpCorePromise = (async () => {
      if (typeof globalThis.measureTextWidth !== "function") {
        globalThis.measureTextWidth = (_font: string, text: string) =>
          text.length * 10;
      }

      const rhwp = await import("@rhwp/core");
      const wasmUrl = new URL(
        "rhwp_bg.wasm",
        import.meta.resolve("@rhwp/core"),
      );
      await rhwp.default({
        module_or_path: await readFile(fileURLToPath(wasmUrl)),
      });
      return rhwp;
    })();
  }

  return rhwpCorePromise;
}

async function extractHwpTextWithRhwp(buffer: Buffer) {
  const rhwp = await loadRhwpCore();
  const document = new rhwp.HwpDocument(new Uint8Array(buffer));
  const pageCount = Math.min(document.pageCount(), 10);
  const pages: string[] = [];

  for (let page = 0; page < pageCount; page += 1) {
    pages.push(extractSvgText(document.renderPageSvg(page)));
  }

  return cleanExtractedDocumentText(pages.join(" "));
}

export async function extractTextFromAssemblyAttachment(params: {
  buffer: Buffer;
  contentType?: string | null;
  url: string;
}) {
  const extension = attachmentExtension(params.url);
  const contentType = params.contentType?.toLowerCase() ?? "";

  if (extension === "hwpx" || contentType.includes("zip")) {
    return extractHwpTextWithRhwp(params.buffer).catch(() => "");
  }
  if (extension === "pdf" || contentType.includes("pdf")) {
    return extractPdfText(params.buffer).catch(() => "");
  }
  if (extension === "hwp" || contentType.includes("hwp")) {
    return extractHwpTextWithRhwp(params.buffer).catch(() => "");
  }

  return "";
}

async function fetchAttachmentText(url: string) {
  const response = await fetch(url, {
    headers: {
      "accept-language": "ko-KR,ko;q=0.9,en;q=0.5",
      "user-agent": USER_AGENT,
    },
    redirect: "follow",
  });
  if (!response.ok) return "";

  const contentLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > ATTACHMENT_DOWNLOAD_LIMIT_BYTES
  ) {
    return "";
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > ATTACHMENT_DOWNLOAD_LIMIT_BYTES) return "";

  return await extractTextFromAssemblyAttachment({
    buffer,
    contentType: response.headers.get("content-type"),
    url: response.url,
  });
}

async function fetchAttachmentTexts(urls: string[]) {
  const texts = await mapWithConcurrency(urls.slice(0, 3), 3, async (url) =>
    fetchAttachmentText(url).catch(() => ""),
  );
  return texts.join(" ").slice(0, ATTACHMENT_TEXT_LIMIT);
}

function extractBoardPosts(html: string, baseUrl: string, date: string) {
  const posts: BoardPost[] = [];

  for (const row of extractRows(html)) {
    const cells = extractCells(row);
    const title = cells.find((cell) => ASSEMBLY_TEXT_PATTERN.test(cell)) ?? "";
    if (!title || !titleMatchesDate(title, date)) continue;

    const detailUrl = extractDetailUrl(row, baseUrl);
    posts.push({
      attachmentUrls: [],
      detailUrl,
      recordId: extractRecordId(row, cells, detailUrl),
      text: stripHtml(row),
      title,
    });
  }

  return posts;
}

function extractMainText(html: string) {
  return stripHtml(html).slice(0, DETAIL_TEXT_LIMIT);
}

function parseCrowdSize(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  const match = String(value ?? "").match(/[\d,]+/);
  return match ? Number(match[0].replaceAll(",", "")) : null;
}

function validCoordinate(latitude: unknown, longitude: unknown) {
  const parsed = {
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
  return Number.isFinite(parsed.latitude) &&
    Number.isFinite(parsed.longitude) &&
    isWithinKoreaCoordinates(parsed)
    ? parsed
    : { latitude: null, longitude: null };
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const value of values) {
    const trimmed = value?.replace(/\s+/g, " ").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    results.push(trimmed);
  }

  return results;
}

function normalizeAssemblyLocationForSearch(value: string) {
  return value
    .replace(/<->|<=>|\u2194|\u21C4/g, " ")
    .replace(/->|=>|\u2192|~|-/g, " ")
    .replace(/\([^)]*(?:m|km|\uCC28\uB85C)[^)]*\)/gi, " ")
    .replace(
      /([A-Za-z\uAC00-\uD7A3]+)(\d+)\s*\u51FA/g,
      "$1 $2\uBC88\uCD9C\uAD6C",
    )
    .replace(/(\d+)\s*\u51FA/g, "$1\uBC88\uCD9C\uAD6C")
    .replace(/\u51FA/g, "\uCD9C\uAD6C")
    .replace(/\bR\b/g, "\uAD50\uCC28\uB85C")
    .replace(/([\uAC00-\uD7A3])(\d+)R\b/g, "$1$2\uAC00 \uAD50\uCC28\uB85C")
    .replace(/[<>[\]{}]/g, " ")
    .replace(/[,:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstRouteSegment(value: string | null) {
  if (!value) return null;
  return value.split(/<->|<=>|\u2194|\u21C4|->|=>|\u2192|~|-/)[0] ?? null;
}

export function buildAssemblyGeocodingCandidates(params: {
  agency: AssemblyPoliceAgency;
  location: string;
  locationScope?: string | null;
}) {
  const prefix = AGENCY_GEOCODING_PREFIX[params.agency];
  const location = normalizeAssemblyLocationForSearch(params.location);
  const scopeStart = normalizeAssemblyLocationForSearch(
    firstRouteSegment(params.locationScope ?? null) ?? "",
  );

  return uniqueNonEmpty([
    location ? `${prefix} ${location}` : null,
    scopeStart ? `${prefix} ${scopeStart}` : null,
    location,
    scopeStart,
  ]);
}

function toKstDateTime(date: string, time: string | null) {
  return time ? `${date}T${time.padStart(5, "0")}:00+09:00` : null;
}

function splitLocationAndScope(value: string) {
  const arrowPlaceholder = "__PLATELETS_BIDIRECTIONAL_ARROW__";
  const normalized = value.replaceAll("<->", arrowPlaceholder);
  const scope = firstAngleBracketContent(normalized);
  return {
    location: removeAngleBracketMarkup(normalized)
      .replaceAll(arrowPlaceholder, "<->")
      .replace(/\s+/g, " ")
      .trim(),
    locationScope: scope,
  };
}

function trimBoardChrome(value: string) {
  const stopTokens = [
    "\uC778\uC1C4\uD558\uAE30",
    "\uC774\uC804\uAE00",
    "\uB2E4\uC74C\uAE00",
    "\uBAA9\uB85D",
    "Copyright",
  ];
  const stopIndex = stopTokens
    .map((token) => value.indexOf(token))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  return (stopIndex === undefined ? value : value.slice(0, stopIndex))
    .replace(/\s+/g, " ")
    .trim();
}

function extractEventsFromText(
  text: string,
  date: string,
): AssemblyParsedEvent[] {
  const markerPattern = /\d+\.\s*\uC9D1\uD68C\s*\uC77C\uC2DC\s*:/g;
  const starts = [...text.matchAll(markerPattern)].map(
    (match) => match.index ?? 0,
  );
  if (starts.length === 0) return extractLabelledEventsFromText(text, date);

  return starts
    .map((start, index) =>
      text.slice(start, starts[index + 1] ?? text.length).trim(),
    )
    .map((block) => {
      const timeMatch = block.match(
        /\uC9D1\uD68C\s*\uC77C\uC2DC\s*:\s*([0-2]?\d:[0-5]\d)\s*~\s*([0-2]?\d:[0-5]\d)/,
      );
      const locationMatch = block.match(
        /\uC9D1\uD68C\s*\uC7A5\uC18C\s*:\s*([\s\S]*?)(?=\s*\uC2E0\uACE0\s*\uC778\uC6D0\s*:|\s*\uAD00\uD560\uC11C\s*:|$)/,
      );
      const crowdMatch = block.match(
        /\uC2E0\uACE0\s*\uC778\uC6D0\s*:\s*([\d,]+)\s*\uBA85/,
      );
      const locationParts = splitLocationAndScope(locationMatch?.[1] ?? block);

      return {
        crowdSize: parseCrowdSize(crowdMatch?.[1]),
        endsAt: toKstDateTime(date, timeMatch?.[2] ?? null),
        location: locationParts.location || block.slice(0, 200),
        locationScope: locationParts.locationScope,
        startsAt: toKstDateTime(date, timeMatch?.[1] ?? null),
      };
    });
}

function extractLabelledEventsFromText(
  text: string,
  date: string,
): AssemblyParsedEvent[] {
  const markerPattern = /\uC77C\uC2DC\s*:/g;
  const starts = [...text.matchAll(markerPattern)].map(
    (match) => match.index ?? 0,
  );
  if (starts.length === 0) return [];

  return starts
    .map((start, index) =>
      text.slice(start, starts[index + 1] ?? text.length).trim(),
    )
    .map((block) => {
      const timeMatch = block.match(
        /\uC77C\uC2DC\s*:\s*(?:(\d{1,2})[./]\s*(\d{1,2})\.[^\d]*)?([0-2]?\d:[0-5]\d)\s*~\s*([0-2]?\d:[0-5]\d)/,
      );
      const locationMatch = block.match(
        /\uC7A5\uC18C\s*:\s*([\s\S]*?)(?=\s*(?:\uC2E0\uACE0\s*)?\uC778\uC6D0\s*:|\s*\uD589\uC9C4\s*:|$)/,
      );
      const crowdMatch = block.match(
        /(?:\uC2E0\uACE0\s*)?\uC778\uC6D0\s*:\s*([\d,]+)\s*\uBA85/,
      );
      const marchMatch = block.match(/\uD589\uC9C4\s*:\s*([\s\S]*?)$/);
      const locationParts = splitLocationAndScope(locationMatch?.[1] ?? block);

      return {
        crowdSize: parseCrowdSize(crowdMatch?.[1]),
        endsAt: toKstDateTime(date, timeMatch?.[4] ?? null),
        location: locationParts.location || block.slice(0, 200),
        locationScope:
          locationParts.locationScope ??
          (marchMatch ? trimBoardChrome(marchMatch[1]) : null),
        startsAt: toKstDateTime(date, timeMatch?.[3] ?? null),
      };
    });
}

async function getOpenAiClient() {
  const { openaiApiKey } = await getRuntimeApiKeys();
  if (!openaiApiKey) return null;

  const settings = await getAiSettings();
  return {
    client: new OpenAI({
      apiKey: openaiApiKey,
      baseURL: await assertAiBaseUrlSafe(settings.baseUrl),
      maxRetries: 1,
      timeout: 60_000,
    }),
    settings,
  };
}

export function parseGeocodePlaceToolArguments(
  value: string,
): GeocodePlaceToolArguments | null {
  const parsed = JSON.parse(value) as {
    query?: unknown;
    searchMode?: unknown;
  };
  const query = String(parsed.query ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const searchMode =
    parsed.searchMode === "address" || parsed.searchMode === "keyword"
      ? parsed.searchMode
      : "both";

  return query ? { query, searchMode } : null;
}

async function tryKakaoAssemblyQuery(
  query: string,
  searchMode: GeocodePlaceToolArguments["searchMode"] = "both",
) {
  if (searchMode === "address") {
    return searchKakaoLocalCoordinates({
      action: "assembly-protests:geocode",
      kind: "address",
      query,
    });
  }

  const keyword = await searchKakaoLocalCoordinates({
    action: "assembly-protests:geocode",
    kind: "keyword",
    query,
  });

  return searchMode === "keyword"
    ? keyword
    : (keyword ??
        (await searchKakaoLocalCoordinates({
          action: "assembly-protests:geocode",
          kind: "address",
          query,
        })));
}

async function runGeocodePlaceTool(args: GeocodePlaceToolArguments) {
  const result = await tryKakaoAssemblyQuery(args.query, args.searchMode);

  return result
    ? {
        ...result,
        source: `geocode_place:${result.source}`,
      }
    : null;
}

function isGeocodePlaceToolCall(
  call: ChatCompletionMessageToolCall,
): call is ChatCompletionMessageFunctionToolCall {
  return (
    call.type === "function" &&
    "function" in call &&
    call.function.name === "geocode_place"
  );
}

async function resolveAssemblyCoordinateWithLlmMapTool(params: {
  agencyName: string;
  candidateQueries: string[];
  date: string;
  location: string;
  locationScope: string | null;
  title: string;
}) {
  const openAi = await getOpenAiClient();
  if (!openAi) return null;

  const { client, settings } = openAi;
  const completion = await client.chat.completions.create({
    messages: [
      {
        role: "developer",
        content: [
          "You help resolve Korean police assembly/protest places to map coordinates.",
          "You must call geocode_place exactly once.",
          "Do not return or invent latitude/longitude yourself.",
          "Use the parsed notice fields and deterministic candidate queries only to choose or conservatively improve one Korean map query.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          agencyName: params.agencyName,
          candidateQueries: params.candidateQueries,
          date: params.date,
          location: params.location,
          locationScope: params.locationScope,
          title: params.title,
        }),
      },
    ],
    model: settings.model,
    reasoning_effort: settings.reasoningEffort,
    store: false,
    tool_choice: {
      function: { name: "geocode_place" },
      type: "function",
    },
    tools: [ASSEMBLY_GEOCODE_PLACE_TOOL],
  });
  const toolCall = completion.choices[0]?.message.tool_calls?.find(
    isGeocodePlaceToolCall,
  );
  const toolArgs = toolCall
    ? parseGeocodePlaceToolArguments(toolCall.function.arguments)
    : null;

  return toolArgs ? runGeocodePlaceTool(toolArgs) : null;
}

async function defaultAssemblyCoordinateResolver(params: {
  agency: AssemblyPoliceAgency;
  agencyName: string;
  date: string;
  location: string;
  locationScope: string | null;
  title: string;
}): Promise<AssemblyCoordinateMatch | null> {
  const candidateQueries = buildAssemblyGeocodingCandidates({
    agency: params.agency,
    location: params.location,
    locationScope: params.locationScope,
  });

  for (const query of candidateQueries) {
    const result = await tryKakaoAssemblyQuery(query);
    if (result) return result;
  }

  return resolveAssemblyCoordinateWithLlmMapTool({
    ...params,
    candidateQueries,
  }).catch(() => null);
}

function fallbackEvent(title: string): AssemblyParsedEvent {
  return {
    crowdSize: null,
    endsAt: null,
    location: title,
    locationScope: null,
    startsAt: null,
  };
}

function announcesNoAssembly(value: string) {
  return (
    ASSEMBLY_TEXT_PATTERN.test(value) &&
    (value.includes("\uC5C6\uC2B5\uB2C8\uB2E4") ||
      value.includes("\uC5C6\uC74C"))
  );
}

async function buildProtestsFromPost(params: {
  coordinateResolver: AssemblyCoordinateResolver | null;
  date: string;
  detailText: string;
  detailUrl: string | null;
  enrichLocations: boolean;
  post: BoardPost;
  source: AssemblySource;
}) {
  if (announcesNoAssembly(`${params.post.title} ${params.detailText}`)) {
    return [];
  }

  const parsedEvents = extractEventsFromText(params.detailText, params.date);
  const events =
    parsedEvents.length > 0 ? parsedEvents : [fallbackEvent(params.post.title)];

  return mapWithConcurrency(
    events,
    3,
    async (event, index): Promise<AssemblyProtestInput> => {
      const location = event.location?.trim() || params.post.title;
      const locationScope = event.locationScope?.trim() || null;
      const coordinateMatch =
        params.enrichLocations && params.coordinateResolver
          ? await params.coordinateResolver({
              agency: params.source.id,
              agencyName: params.source.agency,
              date: params.date,
              detailText: params.detailText,
              location,
              locationScope,
              title: params.post.title,
            })
          : null;
      const coordinates = validCoordinate(
        coordinateMatch?.latitude,
        coordinateMatch?.longitude,
      );

      return {
        agency: params.source.agency,
        crowdSize: parseCrowdSize(event.crowdSize),
        date: params.date,
        detailUrl: params.detailUrl,
        endsAt: event.endsAt ?? null,
        latitude: coordinates.latitude,
        location,
        locationScope,
        longitude: coordinates.longitude,
        raw: {
          attachmentUrls: params.post.attachmentUrls,
          detailText: params.detailText,
          geocoding: coordinateMatch,
          postTitle: params.post.title,
          sourceType: params.source.sourceType,
        },
        sourceId: params.source.id,
        sourceRecordId: `${params.post.recordId}:${index}`,
        sourceTitle: params.post.title,
        sourceUrl: params.source.listUrl,
        startsAt: event.startsAt ?? null,
      };
    },
  );
}

async function fetchGyeongnamPosts(date: string) {
  const response = await fetch(
    "https://www.gnpolice.go.kr/gnpmng/sec/getBbsList.do",
    {
      body: new URLSearchParams({
        BBS_ID: GYEONGNAM_BBS_ID,
        CURRENT_PAGE: "1",
        FROM_DATE: "",
        PAGE_UNIT: "20",
        SEARCH_CONTITION: "",
        SEARCH_KEYWORD: "",
        TO_DATE: "",
      }),
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        referer: "https://www.gnpolice.go.kr/gnpolice/page.do?MENU_ID=NF05",
        "user-agent": USER_AGENT,
        "x-requested-with": "XMLHttpRequest",
      },
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch Gyeongnam board: ${response.status}`);
  }

  const payload = (await response.json()) as GyeongnamBoardListResponse;
  return (payload.list ?? [])
    .filter((post) => titleMatchesDate(post.CPDS_SUBJECT ?? "", date))
    .map(
      (post): BoardPost => ({
        attachmentUrls: [],
        detailUrl: post.IPDS_IDX
          ? `https://www.gnpolice.go.kr/gnpolice/page.do?Mode=view&MENU_ID=NF05&IPDS_IDX=${post.IPDS_IDX}`
          : null,
        recordId:
          post.IPDS_IDX ??
          (post.IPDS_NUM === undefined ? null : String(post.IPDS_NUM)) ??
          post.CPDS_SUBJECT ??
          "unknown",
        text: stripHtml(post.CPDS_CONTENT ?? ""),
        title: post.CPDS_SUBJECT ?? "",
      }),
    );
}

async function crawlSource(
  source: AssemblySource,
  date: string,
  enrichLocations: boolean,
  coordinateResolver: AssemblyCoordinateResolver | null,
) {
  if (source.sourceType === "gn-json") {
    const postResults = await mapWithConcurrency(
      await fetchGyeongnamPosts(date),
      3,
      async (post) =>
        buildProtestsFromPost({
          coordinateResolver,
          date,
          detailText: post.text ?? post.title,
          detailUrl: post.detailUrl,
          enrichLocations,
          post,
          source,
        }),
    );
    return postResults.flat();
  }

  const listPage = await fetchPage(source.listUrl);
  const htmlPosts = extractBoardPosts(listPage.html, listPage.url, date);
  const postResults = await mapWithConcurrency(htmlPosts, 3, async (post) => {
    const detailPage = post.detailUrl ? await fetchPage(post.detailUrl) : null;
    const detailText = detailPage
      ? extractMainText(detailPage.html)
      : (post.text ?? "");
    const attachmentUrls = detailPage
      ? extractAttachmentUrls(detailPage.html, detailPage.url)
      : [];
    const attachmentText =
      attachmentUrls.length > 0
        ? await fetchAttachmentTexts(attachmentUrls)
        : "";
    const combinedDetailText = [detailText, attachmentText]
      .filter(Boolean)
      .join(" ")
      .slice(0, DETAIL_TEXT_LIMIT + ATTACHMENT_TEXT_LIMIT);

    return buildProtestsFromPost({
      coordinateResolver,
      date,
      detailText: combinedDetailText,
      detailUrl: detailPage?.url ?? post.detailUrl,
      enrichLocations,
      post: {
        ...post,
        attachmentUrls,
      },
      source,
    });
  });

  return postResults.flat();
}

function hasAssemblyCoordinates(protest: AssemblyProtestInput) {
  return protest.latitude !== null && protest.longitude !== null;
}

export function isAssemblyPoliceAgency(
  value: string,
): value is AssemblyPoliceAgency {
  return ASSEMBLY_SOURCES.some((source) => source.id === value);
}

export async function crawlAssemblyProtests(
  options: AssemblyCrawlOptions,
): Promise<AssemblyProtestUpdateResult> {
  const sources = options.agency
    ? ASSEMBLY_SOURCES.filter((source) => source.id === options.agency)
    : ASSEMBLY_SOURCES;
  const fetchedAt = new Date().toISOString();
  const protests: AssemblyProtestInput[] = [];
  const enrichLocations = options.enrichLocations !== false;
  const coordinateResolver = enrichLocations
    ? (options.coordinateResolver ?? defaultAssemblyCoordinateResolver)
    : null;
  const sourceOutcomes = await mapWithConcurrency(
    sources,
    4,
    async (source) => {
      try {
        const sourceProtests = await crawlSource(
          source,
          options.date,
          enrichLocations,
          coordinateResolver,
        );

        return {
          completedSourceId: source.id,
          protests: sourceProtests,
          result: {
            agency: source.agency,
            geocodedCount: sourceProtests.filter(hasAssemblyCoordinates).length,
            importedCount: sourceProtests.length,
            sourceId: source.id,
            status: "success" as const,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordApiLog({
          action: `assembly-protests:${source.id}`,
          category: "dataset",
          level: "warn",
          message,
          metadata: { agency: source.agency, date: options.date },
          status: "failure",
        });

        return {
          completedSourceId: null,
          protests: [],
          result: {
            agency: source.agency,
            error: message,
            geocodedCount: 0,
            importedCount: 0,
            sourceId: source.id,
            status: "failure" as const,
          },
        };
      }
    },
  );
  const completedSourceIds = sourceOutcomes
    .map((outcome) => outcome.completedSourceId)
    .filter((sourceId): sourceId is AssemblyPoliceAgency => sourceId !== null);
  const sourceResults = sourceOutcomes.map((outcome) => outcome.result);
  protests.push(...sourceOutcomes.flatMap((outcome) => outcome.protests));

  await replaceAssemblyProtestsForDate({
    date: options.date,
    fetchedAt,
    protests,
    sourceIds: completedSourceIds,
  });
  await recordApiLog({
    action: "assembly-protests",
    category: "dataset",
    level: "info",
    message: "Assembly and protest daily crawl completed.",
    metadata: {
      date: options.date,
      failedSourceCount: sourceResults.filter(
        (result) => result.status === "failure",
      ).length,
      geocodedCount: protests.filter(hasAssemblyCoordinates).length,
      importedCount: protests.length,
      sourceCount: sources.length,
    },
    status: "success",
  });

  return {
    date: options.date,
    failedSourceCount: sourceResults.filter(
      (result) => result.status === "failure",
    ).length,
    fetchedAt,
    geocodedCount: protests.filter(hasAssemblyCoordinates).length,
    importedCount: protests.length,
    sourceResults,
    sourceCount: sources.length,
  };
}

export async function getAssemblyProtests(options: {
  date?: string;
  limit?: number;
}) {
  return listAssemblyProtests(options);
}
