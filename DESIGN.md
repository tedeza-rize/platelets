---

id: krds-tds-assisted
name: KRDS-first TDS-assisted Design System
country: KR
category: public-service
homepage: "https://www.krds.go.kr/html/site/index.html"
primary_color: "#256EF4"
logo:
type: favicon
slug: "https://www.krds.go.kr/resources/img/guide/favicon_192.png"
verified: "2026-06-14"
omd: "0.1"
ds:
name: KRDS-first TDS-assisted Design System
url: "https://www.krds.go.kr/html/site/index.html"
type: hybrid-system
base_system:
name: KRDS — Korea Republic Design System
role: "Primary design authority"
description: "행정안전부 주관 범정부 통합 디자인 시스템. 색상, 타이포그래피, 접근성, 컴포넌트 기본값, 문체, 레이아웃의 최상위 기준."
assist_system:
name: Toss TDS
role: "Secondary interaction reference"
description: "모바일 UX, 인증번호 입력, 보안 키패드, 스켈레톤 로딩, 수치 표시, 바텀시트 등 KRDS에서 상대적으로 덜 구체적인 패턴을 참고하는 보조 체계."
description: "KRDS를 기본 디자인 규범으로 고정하고, 부족한 모바일·인증·로딩·수치 표현 패턴만 TDS에서 참고하되 모든 시각 값은 KRDS 토큰으로 재해석하는 공공 서비스용 디자인 시스템."
integration_rule: "KRDS is the law. TDS is a reference. Borrow behavior, not appearance."
og_image: "https://www.krds.go.kr/resources/img/guide/KRDS_Open_Graph.png"
tokens:
source: synthesized-from-provided-krds-and-tds-specs
extracted: "2026-06-14"
design_contract:
default_system: "KRDS"
fallback_system: "TDS"
fallback_scope:
- "mobile bottom sheet"
- "OTP and verification code input"
- "secure keypad"
- "skeleton loading"
- "numeric and amount display behavior"
- "micro-interaction references"
- "progressive density for detail screens"
prohibited_imports_from_tds:
- "Toss UI Blue #3182F6 as primary color"
- "Toss Brand Blue #0064FF as interface color"
- "Toss Product Sans as default font"
- "16px rounded visual language as default"
- "soft fintech shadow-heavy card style"
- "friendly financial app tone on public-service screens"
- "spring motion except in explicitly approved success illustrations"
colors:
primary: "#256EF4"
primary-hover: "#0B50D0"
primary-pressed: "#083891"
primary-subtle: "#ECF2FE"
primary-border-subtle: "#B1CEFB"
brand: "#256EF4"
canvas: "#FFFFFF"
foreground: "#1E2124"
body: "#464C53"
muted: "#6D7882"
placeholder: "#464C53"
on-primary: "#FFFFFF"
surface: "#F4F5F6"
surface-primary: "#ECF2FE"
divider: "#E6E8EA"
hairline: "#B1B8BE"
border: "#58616A"
border-subtle: "#B1B8BE"
border-muted: "#CDD1D5"
border-strong: "#58616A"
disabled-bg: "#CDD1D5"
disabled-fg: "#6D7882"
secondary: "#346FB2"
secondary-deep: "#063A74"
point: "#D63D4A"
point-deep: "#AB2B36"
danger: "#DE3412"
danger-deep: "#8A240F"
danger-subtle: "#FDEFEC"
warning: "#FFB114"
warning-text: "#9E6A00"
warning-deep: "#614100"
warning-subtle: "#FFF3DB"
success: "#228738"
success-deep: "#285D33"
success-subtle: "#EAF6EC"
information: "#0B78CB"
information-deep: "#085691"
information-subtle: "#E7F4FE"
overlay: "rgba(0,0,0,0.5)"
toast-bg: "#1E2124"
toast-fg: "#FFFFFF"
typography:
family:
sans: '"Pretendard GOV", "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
mono: '"SF Mono", SFMono-Regular, Menlo, Consolas, monospace'
numeric: '"Pretendard GOV", "Pretendard", -apple-system, BlinkMacSystemFont, "Noto Sans KR", sans-serif'
weight:
regular: 400
bold: 700
display-large:
size: 60
mobile: 44
weight: 700
lineHeight: 1.5
tracking: "1px"
use: "Marketing or banner display only. Do not use for body content."
display-medium:
size: 44
mobile: 32
weight: 700
lineHeight: 1.5
tracking: "1px"
use: "Large campaign or intro banner."
display-small:
size: 36
mobile: 28
weight: 700
lineHeight: 1.5
tracking: "1px"
use: "Small display banner."
heading-xlarge:
size: 40
mobile: 28
weight: 700
lineHeight: 1.5
tracking: "1px"
use: "H1 page or section top title."
heading-large:
size: 32
mobile: 24
weight: 700
lineHeight: 1.5
tracking: "1px"
use: "H1 on narrow pages or H2."
heading-medium:
size: 24
mobile: 22
weight: 700
lineHeight: 1.5
tracking: "0"
use: "H2 or H3."
heading-small:
size: 19
mobile: 19
weight: 700
lineHeight: 1.5
tracking: "0"
use: "H3 or H4."
heading-xsmall:
size: 17
mobile: 17
weight: 700
lineHeight: 1.5
tracking: "0"
use: "H4 or H5."
heading-xxsmall:
size: 15
mobile: 15
weight: 700
lineHeight: 1.5
tracking: "0"
use: "H5 or compact heading."
body-large:
size: 19
weight: 400
lineHeight: 1.5
use: "Emphasized body or key copy."
body-large-bold:
size: 19
weight: 700
lineHeight: 1.5
use: "Important body emphasis."
body-medium:
size: 17
weight: 400
lineHeight: 1.5
use: "Default body text."
body-medium-bold:
size: 17
weight: 700
lineHeight: 1.5
use: "Body-level emphasis."
body-small:
size: 15
weight: 400
lineHeight: 1.5
use: "Caption, helper text, small label."
body-small-bold:
size: 15
weight: 700
lineHeight: 1.5
use: "Small emphasis."
body-xsmall:
size: 13
weight: 400
lineHeight: 1.5
use: "Annotation, metadata, footer."
body-xsmall-bold:
size: 13
weight: 700
lineHeight: 1.5
use: "Small metadata emphasis."
numeric-large:
size: 32
weight: 700
lineHeight: 1.35
feature: "tabular-nums"
source: "TDS-informed, KRDS-styled"
use: "금액, 접수번호, 처리 건수 등 수치가 화면의 핵심 정보일 때."
numeric-medium:
size: 24
weight: 700
lineHeight: 1.4
feature: "tabular-nums"
source: "TDS-informed, KRDS-styled"
use: "상세 화면의 금액, 기간, 건수 표시."
numeric-small:
size: 17
weight: 700
lineHeight: 1.5
feature: "tabular-nums"
source: "TDS-informed, KRDS-styled"
use: "목록 행의 금액, 상태 수치, 날짜."
spacing:
xs: 2
sm: 4
md: 8
compact: 10
small: 12
base: 16
comfortable: 20
lg: 24
xl: 32
xxl: 40
xxxl: 64
section: 80
rounded:
xsmall: 2
sm: 4
md: 6
lg: 8
xl: 10
modal: 12
sheet: 12
full: 1000
shadow:
none: "none"
focus: "0 0 0 0.4rem #256EF4"
focus-inset: "inset 0 0 0 0.2rem #256EF4"
dropdown: "0 0.2rem 0 0 rgba(0,0,0,0.1), 0 0.4rem 0.8rem 0 rgba(0,0,0,0.1)"
modal: "0 0.2rem 0 0 rgba(0,0,0,0.1), 0 0.4rem 0.8rem 0 rgba(0,0,0,0.1)"
sheet: "0 -0.2rem 0.8rem 0 rgba(0,0,0,0.1)"
motion:
instant: "0ms"
base: "0.4s ease-in-out"
fade: "opacity 0.4s linear"
collapse: "max-height 0.4s ease"
collapse-width: "width 0.4s ease"
tds-informed-fast: "150ms ease-in-out"
tds-informed-standard: "250ms ease-in-out"
reduced-motion: "0ms"
layout:
content-max-width: 1200
desktop-gutter: 24
mobile-gutter: 16
mobile-baseline: 360
tds-mobile-reference-baseline: 375
components_harvested: true
components:
button-primary:
type: button
bg: "#256EF4"
fg: "#FFFFFF"
border: "1px solid #256EF4"
radius: "6px medium, 8px large and xlarge"
padding: "0 16px medium, 0 20px large, 0 24px xlarge"
height: "48px medium, 56px large, 64px xlarge"
font: "17px or 19px / 400"
hover: "#0B50D0"
active: "#083891"
disabled: "bg #CDD1D5 fg #6D7882"
focus: "0 0 0 4px #256EF4"
use: "Core action such as 신청하기, 확인하기, 제출하기. Use one primary action per screen."
button-secondary:
type: button
bg: "#ECF2FE"
fg: "#0B50D0"
border: "1px solid #256EF4"
radius: "6px medium, 8px large and xlarge"
padding: "0 16px medium, 0 20px large, 0 24px xlarge"
height: "48px medium, 56px large, 64px xlarge"
font: "17px or 19px / 400"
use: "Secondary action such as 자세히 보기, 이전 단계, 다운로드."
button-tertiary:
type: button
bg: "transparent"
fg: "#1E2124"
border: "1px solid #58616A"
radius: "6px medium, 8px large and xlarge"
padding: "0 16px medium, 0 20px large, 0 24px xlarge"
height: "48px medium, 56px large, 64px xlarge"
font: "17px or 19px / 400"
hover: "#F4F5F6"
use: "Cancel, reset, close, temporary save."
button-danger:
type: button
bg: "#DE3412"
fg: "#FFFFFF"
border: "1px solid #DE3412"
radius: "6px medium, 8px large"
height: "48px medium, 56px large"
font: "17px or 19px / 400"
use: "Destructive confirmation such as 삭제하기, 철회하기. Must be placed after clear confirmation."
input-text:
type: input
bg: "#FFFFFF"
fg: "#464C53"
border: "1px solid #58616A"
radius: "8px"
padding: "0 16px"
height: "56px"
font: "19px / 400"
focus: "0 0 0 4px #256EF4"
disabled: "bg #CDD1D5 fg #6D7882 border #B1B8BE"
error: "2px solid #DE3412"
use: "Standard text input."
textarea:
type: input
bg: "#FFFFFF"
fg: "#464C53"
border: "1px solid #58616A"
radius: "8px"
padding: "16px"
minHeight: "144px"
font: "19px / 400"
use: "Multi-line input."
select:
type: input
bg: "#FFFFFF"
fg: "#1E2124"
border: "1px solid #58616A"
radius: "6px"
padding: "0 48px 0 16px"
height: "56px"
font: "19px / 400"
error: "2px solid #AB2B36"
use: "Native select with chevron."
card:
type: card
bg: "#FFFFFF"
border: "1px solid #B1B8BE"
radius: "8px"
padding: "24px"
shadow: "none"
use: "Standard content panel."
card-info:
type: card
bg: "#ECF2FE"
fg: "#1E2124"
radius: "8px"
padding: "16px 24px"
use: "Information or help panel."
modal:
type: dialog
bg: "#FFFFFF"
fg: "#1E2124"
radius: "12px"
padding: "40px"
shadow: "modal"
backdrop: "rgba(0,0,0,0.5)"
use: "Confirmation, settings, full menu, important blocking decisions."
bottom-sheet:
type: dialog
source: "TDS-informed, KRDS-styled"
bg: "#FFFFFF"
fg: "#1E2124"
radius: "12px 12px 0 0"
padding: "24px 20px"
shadow: "0 -0.2rem 0.8rem 0 rgba(0,0,0,0.1)"
backdrop: "rgba(0,0,0,0.5)"
use: "Mobile-only or narrow viewport selection, picker, secondary form."
skeleton:
type: loading
source: "TDS-informed, KRDS-styled"
bg: "#F4F5F6"
radius: "8px"
motion: "subtle shimmer only when motion is allowed; static block when reduced motion is enabled"
use: "Loading placeholder matching final layout dimensions."
otp-input:
type: input
source: "TDS-informed, KRDS-styled"
bg: "#FFFFFF"
fg: "#1E2124"
border: "1px solid #58616A"
active: "focus halo 0 0 0 4px #256EF4"
error: "2px solid #DE3412"
radius: "8px"
size: "48px to 56px per cell"
font: "24px / 700, tabular-nums"
use: "인증번호, 확인 코드, 2단계 인증."

DESIGN.md — KRDS-first TDS-assisted Design System

0. Integration Summary

이 디자인 시스템은 KRDS를 기본 디자인으로 사용합니다. KRDS가 제공하는 색상, 타이포그래피, 레이아웃, 접근성, 컴포넌트, 문체 규칙은 최상위 기준입니다. TDS는 KRDS에서 상대적으로 구체성이 부족한 모바일 상호작용, 인증 입력, 보안 키패드, 로딩 스켈레톤, 수치 표시, 점진적 정보 밀도, 일부 마이크로 인터랙션을 보완하기 위한 참고 체계로만 사용합니다.

핵심 원칙은 다음과 같습니다.

KRDS는 법이고, TDS는 참고입니다. TDS에서 가져오는 것은 색상이나 브랜드 외형이 아니라 문제를 해결하는 방식입니다. 모든 시각 값은 KRDS 토큰으로 다시 입힙니다. Primary 색상은 언제나 KRDS Government Blue "#256EF4"입니다. Toss UI Blue "#3182F6"와 Toss Brand Blue "#0064FF"는 이 시스템의 인터페이스 색상으로 사용하지 않습니다.

이 시스템의 목적은 공공 서비스의 신뢰성, 접근성, 예측 가능성을 유지하면서도 모바일 환경에서 더 부드럽고 완성도 높은 사용 경험을 제공하는 것입니다. 따라서 공공 서비스의 문체와 구조는 KRDS를 따르고, TDS의 장점은 화면 전환, 인증 흐름, 입력 보조, 로딩 상태, 수치 표현 방식 안에서 제한적으로 반영합니다.

1. Visual Theme & Atmosphere

이 시스템의 기본 분위기는 공공 서비스의 도구성, 접근성, 신뢰성입니다. 화면은 마케팅 제품처럼 보이지 않아야 하며, 사용자가 처리해야 할 행정 업무를 명확하고 차분하게 안내해야 합니다. 순백 배경 "#FFFFFF" 위에 본문 텍스트 "#1E2124", 보조 텍스트 "#464C53", 얇은 회색 보더 "#B1B8BE" 또는 "#58616A", 그리고 핵심 행위에만 쓰이는 정부 블루 "#256EF4"가 중심이 됩니다.

KRDS의 기본 인상은 평탄하고 질서 있는 공공 유틸리티입니다. 그림자보다 보더를 사용하고, 장식보다 구조를 우선하며, 색상보다 문맥과 위계로 사용자의 다음 행동을 안내합니다. Primary 색상은 장식이 아니라 행위의 색입니다. 버튼, 활성 링크, 활성 탭, 포커스 링, 선택된 사이드 메뉴처럼 사용자가 실제로 조작하거나 현재 상태를 파악해야 하는 곳에만 사용합니다.

TDS에서 참고하는 부분은 모바일 앱 수준의 매끄러운 사용성입니다. 예를 들어 바텀시트, 인증번호 입력, 보안 키패드, 스켈레톤 로딩, 숫자 표시 방식은 TDS의 실용적 패턴을 참고할 수 있습니다. 그러나 결과물은 Toss처럼 보여서는 안 됩니다. 라운드는 KRDS 스케일에 맞추고, 그림자는 절제하며, 문체는 공공 서비스 안내문으로 유지합니다.

이 시스템이 지향하는 한 줄 요약은 다음과 같습니다.

모두가 쉽게 이해하고 안전하게 사용할 수 있는 공공 서비스 경험.

Key Characteristics

- KRDS Government Blue "#256EF4"를 유일한 Primary action 색상으로 사용합니다.
- 기본 본문은 17px, 400, line-height 1.5입니다.
- Pretendard GOV를 기본 서체로 사용합니다.
- 모든 인터랙티브 요소에 4px focus halo를 적용합니다.
- 카드와 패널은 그림자보다 1px 보더와 8px 라운드로 구분합니다.
- 모바일 특화 패턴은 TDS의 흐름을 참고하되 KRDS 색상, 폰트, 라운드, 문체로 재해석합니다.
- 색상으로만 의미를 전달하지 않습니다. 상태는 텍스트, 아이콘, ARIA 속성, 보조 설명을 함께 사용합니다.
- 입력 오류는 무엇이 문제인지, 왜 문제인지, 어떻게 수정해야 하는지를 한 문장 안에서 안내합니다.
- 공공 서비스 화면에서는 과장된 일러스트, 장식적 그라데이션, 과도한 스프링 모션을 사용하지 않습니다.
- 로딩, 실패, 빈 상태에서도 다음 행동을 제시합니다.

2. Color Palette & Roles

색상 체계는 KRDS를 기준으로 합니다. TDS의 색상은 직접 가져오지 않습니다. 특히 "#3182F6"과 "#0064FF"는 사용하지 않습니다. 두 파란색이 공존하면 공공 서비스의 행위 색상 위계가 흐려지기 때문입니다.

2.1 Brand and Primary

Role| Hex| Use
Primary Action| "#256EF4"| Primary 버튼, 활성 링크, 활성 탭, 체크 상태, focus ring
Primary Hover| "#0B50D0"| Primary hover, secondary 버튼 텍스트, pressed 전 단계
Primary Pressed| "#083891"| Primary active, pressed, 강한 강조 텍스트
Primary Subtle| "#ECF2FE"| Secondary 버튼 배경, 정보 패널, 선택된 필터 칩 배경
Primary Border Subtle| "#B1CEFB"| 약한 강조 보더, 선택 영역 보조선
On Primary| "#FFFFFF"| Primary 배경 위 텍스트

Primary는 행위에만 사용합니다. 배경 장식, 일러스트, 헤더 풀 블리드, 장식용 선, 비활성 아이콘에는 사용하지 않습니다.

2.2 Neutral and Surface

Role| Hex| Use
Canvas| "#FFFFFF"| 페이지 배경, 카드, 입력 필드
Surface Gray| "#F4F5F6"| 표 헤더, 로딩 스켈레톤, 약한 회색 표면
Divider| "#E6E8EA"| 얇은 구분선
Border Muted| "#CDD1D5"| disabled border, 부드러운 구분선
Border Subtle| "#B1B8BE"| 카드, 패널, 보조 영역 보더
Border Strong| "#58616A"| 입력, tertiary 버튼, 명확한 컨트롤 보더
Text Basic| "#1E2124"| 제목, 핵심 본문
Text Subtle| "#464C53"| 본문 보조, placeholder, 비활성 내비게이션
Text Muted| "#6D7882"| 캡션, 메타, disabled 텍스트
Black Static| "#000000"| 특수한 고대비 상황 외에는 사용 빈도 낮음

2.3 Semantic Colors

Role| Base| Subtle| Deep| Use
Danger| "#DE3412"| "#FDEFEC"| "#8A240F"| 검증 오류, 삭제, 반려, 즉시 주의
Warning| "#FFB114"| "#FFF3DB"| "#614100"| 보완 요청, 주의, 대기
Warning Text| "#9E6A00"| "#FFF3DB"| "#614100"| 밝은 배경 위 경고 텍스트
Success| "#228738"| "#EAF6EC"| "#285D33"| 완료, 승인, 성공
Information| "#0B78CB"| "#E7F4FE"| "#085691"| 진행 중, 안내, 정보
Point| "#D63D4A"| "#FBEFF0"| "#7A1F26"| 신규, 중요, 제한적 강조
Select Error| "#AB2B36"| "#FBEFF0"| "#7A1F26"| 셀렉트 오류 보더

Danger, Warning, Success, Information, Point는 상태 의미를 전달할 때만 사용합니다. 상태 텍스트 없이 색상만으로 의미를 전달하지 않습니다.

2.4 TDS Color Handling

TDS에서 참고한 색상 역할은 KRDS 색상으로 치환합니다.

TDS Role| TDS Value| KRDS Replacement
Toss UI Blue| "#3182F6"| "#256EF4"
Toss Blue Hover| "#2272EB"| "#0B50D0"
Toss Blue Light| "#E8F3FF"| "#ECF2FE"
Toss Grey 100| "#F2F4F6"| "#F4F5F6"
Toss Grey 200| "#E5E8EB"| "#E6E8EA" or "#CDD1D5"
Toss Grey 900| "#191F28"| "#1E2124"
Toss Error Red| "#F04452"| "#DE3412"
Toss Success Green| "#03B26C"| "#228738"
Toss Warning Orange| "#FE9800"| "#FFB114" plus text "#9E6A00"

2.5 Focus

Focus는 모든 인터랙티브 요소에서 가장 강한 접근성 신호입니다.

- 기본 focus ring: "0 0 0 4px #256EF4"
- inset focus ring: "inset 0 0 0 2px #256EF4"
- focus는 hover보다 우선합니다.
- focus 상태는 outline을 제거하지 않습니다.
- 키보드 사용자가 현재 위치를 즉시 파악할 수 있어야 합니다.
- 색상만으로 focus를 표시하지 않습니다. 두께와 halo를 함께 사용합니다.

2.6 Contrast Rule

모든 본문 텍스트는 WCAG 2.1 AA 수준의 대비를 만족해야 합니다.

- 일반 텍스트: 최소 4.5:1
- 큰 텍스트와 아이콘: 최소 3:1
- 가능하면 본문과 핵심 정보는 7:1 이상을 목표로 합니다.
- Primary 50 위 흰색 텍스트는 기본 조합으로 허용합니다.
- Warning 배경 위 텍스트는 "#1E2124"를 우선 사용합니다.
- 밝은 경고 배경 위 경고 텍스트는 "#9E6A00" 또는 더 진한 값을 사용합니다.

3. Typography Rules

타이포그래피는 KRDS를 따릅니다. TDS의 Toss Product Sans는 사용하지 않습니다. TDS에서 가져올 수 있는 것은 금융 앱의 수치 표현 원칙, 즉 중요한 숫자를 명확하게 표시하고 tabular numeral을 쓰는 방식뿐입니다.

3.1 Font Family

Primary font stack:

""Pretendard GOV", "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif"

Monospace font stack:

""SF Mono", SFMono-Regular, Menlo, Consolas, monospace"

Numeric rendering:

- 금액, 접수번호, 날짜, 건수, 처리 시간, 인증번호는 tabular numeral을 적용합니다.
- CSS에서는 "font-variant-numeric: tabular-nums;"를 사용합니다.
- 숫자와 단위 사이에는 서비스 문맥에 맞는 간격을 둡니다.
- 공공 문서형 화면에서는 "1,240,000원"처럼 명확한 표기를 사용합니다.
- 약식 표기인 "1.2M", "약 120만원"은 핵심 정보 표면에서 사용하지 않습니다.

3.2 Type Scale

Style| PC| Mobile| Weight| Line Height| Letter Spacing| Use
Display Large| 60px| 44px| 700| 1.5| 1px| 마케팅 또는 큰 배너 전용
Display Medium| 44px| 32px| 700| 1.5| 1px| 대형 소개 화면
Display Small| 36px| 28px| 700| 1.5| 1px| 소형 배너
Heading xlarge| 40px| 28px| 700| 1.5| 1px| H1, 페이지 최상위 제목
Heading large| 32px| 24px| 700| 1.5| 1px| 좁은 H1 또는 H2
Heading medium| 24px| 22px| 700| 1.5| 0| H2 또는 H3
Heading small| 19px| 19px| 700| 1.5| 0| H3 또는 H4
Heading xsmall| 17px| 17px| 700| 1.5| 0| H4 또는 H5
Heading xxsmall| 15px| 15px| 700| 1.5| 0| 작은 제목
Body large| 19px| 19px| 400| 1.5| 0| 강조 본문
Body medium| 17px| 17px| 400| 1.5| 0| 기본 본문
Body small| 15px| 15px| 400| 1.5| 0| 캡션, helper text
Body xsmall| 13px| 13px| 400| 1.5| 0| 메타, 주석, 푸터

3.3 Numeric Scale

TDS의 수치 표현 원칙을 KRDS 타이포그래피 안에 재해석합니다.

Style| Size| Weight| Line Height| Use
Numeric Large| 32px| 700| 1.35| 핵심 금액, 접수번호, 처리 건수
Numeric Medium| 24px| 700| 1.4| 상세 화면 금액, 날짜, 기간
Numeric Small| 17px| 700| 1.5| 목록 행의 금액, 수치, 상태 값
Numeric Caption| 15px| 400| 1.5| 보조 수치, 이전 값, 기준일

숫자는 본문과 같은 색상을 쓰되, 의미가 있는 상태에서는 semantic color를 함께 사용할 수 있습니다. 예를 들어 환급 완료 금액은 Success 텍스트를 사용할 수 있지만, 색상만으로 상태를 전달하면 안 됩니다. 반드시 "환급 완료", "반려", "보완 요청" 같은 텍스트 라벨을 함께 둡니다.

3.4 Typography Principles

- Regular 400과 Bold 700을 기본으로 사용합니다.
- Medium 500 또는 SemiBold 600은 원칙적으로 사용하지 않습니다.
- 본문 기본은 17px입니다.
- 줄간격은 1.5 이상을 유지합니다.
- 한글 본문에는 letter-spacing을 0으로 둡니다.
- Display 계층에만 1px letter-spacing을 허용합니다.
- 본문 강조는 색상보다 굵기와 위치로 처리합니다.
- 긴 문장은 60자 안팎에서 줄바꿈되도록 컨테이너 폭을 관리합니다.
- 날짜와 시간은 명확하게 씁니다. 예: "2026년 6월 14일 15:30".
- 약어는 처음 등장할 때 풀어 씁니다.

4. Component Stylings

컴포넌트는 KRDS를 기본으로 구성합니다. TDS 참고 컴포넌트는 반드시 "TDS-informed, KRDS-styled"로 취급합니다. 즉 구조나 UX 흐름은 참고할 수 있지만, 색상, 폰트, 라운드, 그림자, 문체는 KRDS를 따릅니다.

4.1 Buttons

버튼은 사용자의 행위를 명확히 구분해야 합니다. 한 화면에는 같은 위계의 Primary 버튼을 두 개 이상 배치하지 않습니다.

Primary Button

- Background: "#256EF4"
- Text: "#FFFFFF"
- Border: "1px solid #256EF4"
- Radius: medium 6px, large 이상 8px
- Hover: "#0B50D0"
- Active: "#083891"
- Disabled: background "#CDD1D5", text "#6D7882"
- Focus: "0 0 0 4px #256EF4"
- Use: 신청하기, 제출하기, 확인하기, 다음 단계, 저장하기

Size scale:

Size| Height| Radius| Padding| Font
xsmall| 32px| 4px| 0 10px| 15px / 400
small| 40px| 6px| 0 12px| 15px / 400
medium| 48px| 6px| 0 16px| 17px / 400
large| 56px| 8px| 0 20px| 19px / 400
xlarge| 64px| 8px| 0 24px| 19px / 400

Secondary Button

- Background: "#ECF2FE"
- Text: "#0B50D0"
- Border: "1px solid #256EF4"
- Radius: Primary와 동일
- Use: 자세히 보기, 이전 단계, 다운로드, 보조 확인

Secondary 버튼은 Primary의 보조 행위입니다. Primary와 나란히 놓일 수 있지만 같은 중요도로 보이면 안 됩니다.

Tertiary Button

- Background: transparent
- Text: "#1E2124"
- Border: "1px solid #58616A"
- Hover: "#F4F5F6"
- Use: 취소, 초기화, 닫기, 임시저장

Danger Button

- Background: "#DE3412"
- Text: "#FFFFFF"
- Border: "1px solid #DE3412"
- Use: 삭제하기, 철회하기, 해지하기, 영구 제거

Danger 버튼은 즉시 실행하지 않습니다. 되돌릴 수 없는 행위에는 확인 모달 또는 확인 화면을 먼저 제공합니다.

Text Button

- Background: transparent
- Text: 기본 "#1E2124", 링크형 "#0B50D0"
- Border: transparent
- Focus: 4px halo 또는 inset focus
- Use: 파일 다운로드, 도움말 열기, 문의하기, 필터 초기화

Loading Button

TDS의 loading 유지 원칙을 참고합니다.

- 버튼의 width는 로딩 중에도 변하지 않습니다.
- 텍스트는 "처리 중" 또는 해당 과업에 맞는 현재 상태로 변경합니다.
- spinner가 들어가더라도 텍스트를 완전히 제거하지 않는 것이 좋습니다.
- "aria-busy="true""를 적용합니다.
- 중복 제출 방지를 위해 disabled 처리합니다.
- 로딩이 3초 이상 지속되면 화면이나 영역 단위 안내를 제공합니다.

4.2 Inputs

입력 필드는 KRDS large input을 기본으로 합니다.

Text Input

- Background: "#FFFFFF"
- Text: "#464C53"
- Border: "1px solid #58616A"
- Radius: 8px
- Padding: "0 16px"
- Height: 56px
- Font: 19px / 400
- Placeholder: "#464C53"
- Focus: "0 0 0 4px #256EF4"
- Disabled: background "#CDD1D5", text "#6D7882", border "#B1B8BE"
- Error: "2px solid #DE3412"
- Required: label 옆 빨간 별표와 스크린 리더용 필수 안내를 함께 제공

Size scale:

Size| Height| Radius| Padding| Font
xsmall| 32px| 4px| 0 12px| 13px / 400
small| 40px| 6px| 0 16px| 15px / 400
medium| 48px| 6px| 0 16px| 17px / 400
large| 56px| 8px| 0 16px| 19px / 400
xlarge| 80px| 10px| 0 24px| 24px / 700

Textarea

- Background: "#FFFFFF"
- Text: "#464C53"
- Border: "1px solid #58616A"
- Radius: 8px
- Padding: 16px
- Min-height: 144px
- Font: 19px / 400
- Resize: 서비스 성격에 따라 제한적으로 허용
- Use: 사유, 의견, 상세 설명, 주소 상세

Date Input

- Format: "YYYY-MM-DD" 또는 "YYYY / MM / DD"
- Calendar icon은 우측에 배치합니다.
- 날짜 직접 입력과 캘린더 선택을 모두 허용합니다.
- 오류 예시: "올바른 날짜 형식이 아닙니다. 2026-06-14 형식으로 입력해 주세요."

File Upload

- Tertiary 버튼으로 파일 선택을 제공합니다.
- 파일명, 용량, 업로드 상태, 삭제 버튼을 함께 표시합니다.
- 업로드 중에는 진행률을 제공합니다.
- 용량 초과, 확장자 오류, 업로드 실패는 필드 오류로 표시합니다.
- 파일 삭제 버튼은 명확한 accessible name을 가져야 합니다.
- 파일명은 줄임 처리하되 전체 파일명 확인 방법을 제공합니다.

4.3 Select

- Background: "#FFFFFF"
- Text: "#1E2124"
- Border: "1px solid #58616A"
- Radius: 6px
- Padding: "0 48px 0 16px"
- Height: 56px
- Font: 19px / 400
- Disabled: background "#CDD1D5", border "#B1B8BE"
- Error: "2px solid #AB2B36"
- Use: 옵션 선택, 지역 선택, 기관 선택, 분류 선택

Select의 오류 색상은 KRDS 관례에 따라 Danger가 아니라 Point deep 계열 "#AB2B36"을 사용합니다. 다만 오류 텍스트는 사용자가 쉽게 이해할 수 있도록 구체적으로 작성합니다.

4.4 Checkbox, Radio, Switch

Checkbox

- Background: unchecked "#FFFFFF", checked "#256EF4"
- Border: "1px solid #58616A"
- Radius: 4px
- Checked icon: white check
- Use: 다중 선택, 약관 개별 동의, 옵션 선택

Radio

- Background: "#FFFFFF"
- Border: unchecked "#58616A", checked "#256EF4"
- Inner dot: "#256EF4"
- Radius: 1000px
- Use: 단일 선택

Switch

- Track off: "#B1B8BE"
- Track on: "#256EF4"
- Thumb: "#FFFFFF"
- Radius: 1000px
- Disabled: "#CDD1D5"
- Use: 알림 켜기, 자동 저장, 공개 여부처럼 즉시 상태가 바뀌는 설정

Switch는 중요한 신청 행위나 법적 동의에 사용하지 않습니다. 그런 경우 Checkbox 또는 명확한 버튼을 사용합니다.

4.5 Cards and Panels

Standard Card

- Background: "#FFFFFF"
- Border: "1px solid #B1B8BE"
- Radius: 8px
- Padding: 24px
- Shadow: none
- Use: 콘텐츠 패널, 신청 정보 요약, 목록 카드

Info Panel

- Background: "#ECF2FE"
- Text: "#1E2124"
- Emphasis text: "#0B50D0"
- Radius: 8px
- Padding: "16px 24px"
- Use: 도움말, 안내, 수집 목적, 절차 설명

Critical Alert

- Background: "#DE3412"
- Text: "#FFFFFF"
- Radius: 0
- Use: 서비스 중단, 긴급 공지, 즉시 확인이 필요한 장애

Compact Card

TDS의 모바일 밀도 원칙을 참고한 보완 카드입니다.

- Background: "#FFFFFF"
- Border: "1px solid #CDD1D5"
- Radius: 8px
- Padding: 16px
- Shadow: none
- Use: 모바일 목록 안의 간단한 상태 카드, 반복 항목

Featured Card

공공 서비스에서는 과도한 프로모션 카드처럼 보이지 않아야 합니다.

- Background: "#FFFFFF" 또는 "#ECF2FE"
- Border: "1px solid #B1B8BE" 또는 none
- Radius: 8px
- Padding: 24px
- Use: 핵심 안내, 신청 시작 카드, 중요한 정책 안내

4.6 Badges and Tags

Status Badges

Badge| Background| Text| Use
Primary| "#256EF4"| "#FFFFFF"| 주요 분류
Point| "#D63D4A"| "#FFFFFF"| 신규, 중요
Danger| "#DE3412"| "#FFFFFF"| 오류, 반려
Warning| "#FFB114"| "#1E2124"| 보완 요청, 주의
Success| "#228738"| "#FFFFFF"| 완료, 승인
Information| "#0B78CB"| "#FFFFFF"| 진행 중, 안내
Gray| "#6D7882"| "#FFFFFF"| 일반 메타
Disabled| "#8A949E"| "#FFFFFF"| 비활성

Default badge style:

- Radius: 4px
- Padding: "0 8px"
- Height: 24px
- Font: 15px / 400

Outline Badges

Outline badge는 배경을 투명하게 두고 보더와 텍스트로 의미를 전달합니다.

- Primary outline: text "#0B50D0", border "#256EF4"
- Danger outline: text "#BD2C0F", border "#BD2C0F"
- Warning outline: text "#8A5C00", border "#8A5C00"
- Success outline: text "#267337", border "#267337"
- Information outline: text "#096AB3", border "#096AB3"

Filter Tag

- Background: "#FFFFFF"
- Text: "#1E2124"
- Border: "1px solid #CDD1D5"
- Radius: 1000px
- Selected background: "#ECF2FE"
- Selected text: "#0B50D0"
- Selected border: "#256EF4"
- Use: 필터 칩, 선택 조건, 삭제 가능한 태그

Size scale:

Size| Height| Padding| Font
small| 24px| 8px| 13px / 400
medium| 32px| 8px 10px| 15px / 400
large| 40px| 8px 12px| 17px / 400

4.7 Tabs

Horizontal Tab

- Background: transparent
- Inactive text: "#464C53", 17px / 400
- Active text: "#256EF4", 17px / 700
- Active indicator: "2px solid #256EF4"
- Use: 페이지 내 섹션 전환

Tabs는 keyboard left/right navigation을 지원해야 합니다. "role="tablist"", "role="tab"", "aria-selected", "aria-controls"를 사용합니다.

Segmented Control

TDS의 섹션 전환 방식을 참고하되 KRDS 스타일로 재해석합니다.

- Background: "#F4F5F6"
- Radius: 8px
- Padding: 4px
- Item inactive text: "#464C53"
- Item active background: "#FFFFFF"
- Item active text: "#1E2124"
- Item active border: "1px solid #B1B8BE"
- Shadow: none
- Use: 기간 전환, 보기 방식 전환, 정렬 방식 전환

4.8 Toasts and Snackbars

Toast

- Background: "#1E2124"
- Text: "#FFFFFF"
- Radius: 8px
- Padding: 16px
- Position: bottom center 또는 화면 하단 안전 영역 위
- Duration: 3초 기본
- Use: 저장되었습니다, 복사되었습니다, 필터가 적용되었습니다

Toast는 중요한 결과를 대신하지 않습니다. 신청 완료, 결제 완료, 제출 완료처럼 기록이 필요한 상태는 전용 결과 화면으로 처리합니다.

Snackbar

- Background: "#1E2124"
- Text: "#FFFFFF"
- Radius: 0 또는 8px
- Padding: 16px
- Optional action: 되돌리기, 자세히 보기
- Duration: 4초 기본
- Use: 되돌릴 수 있는 가벼운 상태 변경

4.9 Dialogs and Modals

Modal

- Background: "#FFFFFF"
- Text: "#1E2124"
- Radius: 12px
- Padding: 40px
- Width: small 400px, medium 560px, large 760px
- Shadow: KRDS modal shadow
- Backdrop: black 0.5
- Motion: opacity fade 400ms linear
- Use: 확인, 설정, 전체 메뉴, 중요한 차단 결정

Modal은 포커스 트랩을 적용해야 하며, 닫힌 후에는 모달을 연 컨트롤로 포커스가 돌아가야 합니다. ESC 닫기를 지원하되, 되돌릴 수 없는 행위 확인 모달에서는 닫기 방식과 취소 버튼을 명확히 제공합니다.

Confirmation Dialog

- Title: 사용자가 하려는 행위를 구체적으로 명시합니다.
- Body: 결과, 영향, 되돌릴 수 있는지 여부를 설명합니다.
- Primary: 제출하기, 삭제하기, 확인하기
- Tertiary: 취소
- Destructive action: Danger button 사용 가능

예시 문장:

"신청을 제출하시겠습니까? 제출 후에는 일부 항목을 수정할 수 없습니다."

4.10 Bottom Sheet

Bottom Sheet는 TDS에서 참고하는 대표 패턴입니다. 단, 외형은 KRDS로 재해석합니다.

- Source: TDS-informed, KRDS-styled
- Background: "#FFFFFF"
- Text: "#1E2124"
- Radius: "12px 12px 0 0"
- Padding: "24px 20px"
- Shadow: "0 -0.2rem 0.8rem 0 rgba(0,0,0,0.1)"
- Backdrop: "rgba(0,0,0,0.5)"
- Motion: 아래에서 위로 나타나되, reduced motion에서는 즉시 표시
- Use: 모바일 선택 목록, 날짜 선택, 필터, 약관 요약, 보조 입력

Bottom Sheet 사용 기준:

- 모바일 또는 좁은 화면에서만 기본 사용합니다.
- 데스크톱에서는 Modal 또는 Popover로 전환합니다.
- 하단 고정 CTA와 겹치지 않도록 safe area를 반영합니다.
- 긴 내용은 내부 스크롤을 허용하되, header와 CTA 영역은 고정할 수 있습니다.
- 중요한 법적 확인은 Bottom Sheet보다 Modal 또는 별도 확인 화면이 적합합니다.

4.11 Skeleton Loading

Skeleton은 TDS의 구조 일치 원칙을 참고합니다. 단, 시각 값은 KRDS로 재해석합니다.

- Source: TDS-informed, KRDS-styled
- Background: "#F4F5F6"
- Radius: 최종 컴포넌트와 동일, 기본 8px
- Motion: 기본은 약한 shimmer, reduced motion에서는 정적 block
- Duration: 1.2초 수준의 반복 가능
- Use: 카드, 목록, 텍스트 행, 버튼 위치를 미리 보여주는 로딩 상태

Skeleton 규칙:

- 최종 레이아웃과 같은 크기와 위치로 배치합니다.
- 숫자, 접수번호, 금액처럼 실제 값으로 오해될 수 있는 정보는 skeleton 대신 "--" 또는 "확인 중"을 사용합니다.
- 페이지 전체를 막는 로딩은 최소화합니다.
- 이전 데이터가 있는 새로고침 상황에서는 기존 데이터를 유지하고 상단에 작은 로딩 표시를 둡니다.
- 스크린 리더에는 "aria-busy="true""와 상태 안내를 제공합니다.

4.12 OTP and Verification Code Input

OTP 입력은 TDS의 인증번호 입력 패턴을 참고하되 KRDS input 스타일로 재구성합니다.

- Source: TDS-informed, KRDS-styled
- Cell size: 48px to 56px
- Radius: 8px
- Border: "1px solid #58616A"
- Active: focus halo "0 0 0 4px #256EF4"
- Error: "2px solid #DE3412"
- Text: "#1E2124"
- Font: 24px / 700
- Numeric: tabular-nums
- Use: 6자리 인증번호, 2단계 인증, 휴대전화 확인, 이메일 확인

Behavior:

- 한 칸에 한 숫자를 입력합니다.
- 붙여넣기를 지원합니다.
- 입력 완료 시 자동 제출은 신중하게 사용합니다. 제출 버튼을 따로 두는 것이 공공 서비스에 더 적합합니다.
- 오류 발생 시 전체 그룹에 "aria-invalid="true""를 적용하고 오류 메시지를 연결합니다.
- 남은 시간은 "02:59"처럼 tabular numeral로 표시합니다.
- 재전송 버튼은 일정 시간 후 활성화합니다.
- 스크린 리더에는 "인증번호 6자리 중 1번째 자리"처럼 현재 위치를 알립니다.

4.13 Secure Keypad

보안 키패드는 TDS의 금융 입력 패턴을 참고할 수 있습니다. 공공 서비스에서는 주민등록번호, 인증서 비밀번호, 간편 인증 비밀번호처럼 민감한 정보를 입력할 때만 사용합니다.

- Source: TDS-informed, KRDS-styled
- Button height: 56px 이상
- Button radius: 8px
- Button background: "#FFFFFF"
- Button border: "1px solid #CDD1D5"
- Text: "#1E2124"
- Focus: 4px halo
- Pressed: "#F4F5F6"
- Disabled: "#CDD1D5"

Security and accessibility:

- 숫자 위치 무작위 배열은 보안 요구가 있을 때만 사용합니다.
- 무작위 배열을 사용해도 키보드 접근성과 스크린 리더 안내를 보장해야 합니다.
- 삭제, 전체 삭제, 숨김 전환 버튼의 accessible name을 명확히 제공합니다.
- 보안상 실제 입력값은 마스킹합니다.
- 입력 실패 횟수 제한이 있는 경우 남은 횟수를 안내합니다.

4.14 Lists and Rows

목록은 KRDS의 목록 탐색 패턴을 기본으로 하고, TDS의 점진적 밀도 원칙을 참고합니다.

Standard List Row

- Height: 최소 56px
- Padding: "16px 24px" desktop, "16px" mobile
- Border bottom: "1px solid #E6E8EA"
- Title: 17px / 700 / "#1E2124"
- Description: 15px / 400 / "#464C53"
- Meta: 13px / 400 / "#6D7882"
- Action or status: 우측 정렬

Numeric List Row

- Left: 항목명, 기관명, 설명
- Right: 금액, 건수, 날짜, 상태
- Numeric: tabular-nums
- Negative or rejected: Danger와 텍스트 라벨 함께 사용
- Positive or completed: Success와 텍스트 라벨 함께 사용

4.15 Tables

공공 서비스에서는 표가 자주 사용되므로 KRDS 톤을 유지합니다.

- Header background: "#F4F5F6"
- Header text: "#1E2124", 15px or 17px / 700
- Body text: "#1E2124", 15px or 17px / 400
- Border: "1px solid #CDD1D5"
- Row divider: "#E6E8EA"
- Numeric columns: right aligned, tabular-nums
- Status columns: badge plus text
- Mobile: 카드형 목록으로 전환 가능

표는 가로 스크롤이 필요할 수 있습니다. 모바일에서는 핵심 열만 우선 표시하고, 상세 정보는 행 확장 또는 상세 화면으로 이동합니다.

4.16 Pagination

- Button size: 40px by 40px
- Active: background "#256EF4", text "#FFFFFF"
- Inactive: text "#1E2124"
- Hover: "#F4F5F6"
- Border: 필요한 경우 "1px solid #CDD1D5"
- Focus: 4px halo
- Use: 검색 결과, 목록 페이지

현재 페이지는 "aria-current="page""를 사용합니다.

4.17 Breadcrumb

- Font: 13px / 400
- Text: "#464C53"
- Current: "#1E2124"
- Separator: ">" 또는 접근 가능한 아이콘
- Use: 현재 위치 안내

모바일에서는 breadcrumb를 줄이거나 상위로 가기 버튼으로 대체할 수 있습니다.

4.18 Step Indicator

- Active: "#256EF4" background, white number
- Completed: "#228738" background, white check
- Inactive: "#CDD1D5" background, "#6D7882" number
- Label: 15px or 17px
- Use: 신청 단계, 본인 확인 단계, 첨부 단계, 제출 확인

단계는 현재 위치와 남은 단계를 명확하게 알려야 합니다.

4.19 Tooltip and Help Panel

Tooltip

- Background: "#1E2124"
- Text: "#FFFFFF"
- Radius: 12px
- Padding: 8px
- Motion: 400ms fade
- Use: 짧은 보조 설명

Tooltip 안에는 중요한 필수 정보를 넣지 않습니다. 터치 환경에서 접근이 어려울 수 있기 때문입니다.

Help Panel

- Background: "#FFFFFF"
- Text: "#1E2124"
- Border: "1px solid #B1B8BE"
- Radius: 8px
- Padding: 24px
- Use: 긴 도움말, 수집 목적, 제도 설명, 작성 예시

4.20 Header, Navigation, Footer

Header

- Includes: 기관 식별, GNB, 통합검색, 전체메뉴, 글자·화면 설정
- Height: desktop 56px 이상
- Background: "#FFFFFF"
- Border bottom: "1px solid #E6E8EA"
- Primary 색상을 헤더 전체 배경으로 쓰지 않습니다.

GNB

- Text inactive: "#1E2124" or "#464C53"
- Active: "#256EF4", 700, underline or indicator
- Focus: 4px halo
- Mobile: hamburger menu 또는 전체메뉴

Side Menu

- Active background: "#ECF2FE"
- Active text: "#0B50D0", 700
- Active indicator: left bar "4px solid #256EF4"
- Border: "#B1B8BE"

Footer

- 기관 정보, 정책 링크, 접근성 인증, 저작권, 문의 정보
- Text: 13px or 15px
- Background: "#F4F5F6" or "#FFFFFF"
- Links must be keyboard accessible.

5. Layout Principles

5.1 Spacing System

이 시스템은 KRDS의 8-point 기반 spacing을 따릅니다.

Token| Value| Use
spacing-1| 2px| hairline 간격
spacing-2| 4px| 아이콘 내부 간격
spacing-3| 8px| badge, compact gap
spacing-4| 10px| xsmall button padding
spacing-5| 12px| small control gap
spacing-6| 16px| 기본 내부 padding
spacing-7| 20px| large button padding, mobile horizontal
spacing-8| 24px| 표준 콘텐츠 padding, desktop gutter
spacing-9| 32px| 섹션 내부 큰 간격
spacing-10| 40px| 모달 padding
spacing-section| 64px to 80px| 섹션 간 여백

5.2 Grid and Container

Breakpoint| Width| Columns| Gutter| Margin
small| 360px 이상| 4| 16px| 16px
medium| 768px 이상| 8| 16px| 24px
large| 1024px 이상| 12| 24px| 24px
xlarge| 1280px 이상| 12| 24px| 24px

Desktop content max width는 1200px입니다. 좌우 gutter는 24px입니다. 모바일 기준은 KRDS 360px을 따르되, TDS의 375px 모바일 앱 밀도도 참고합니다. 따라서 360px에서도 모든 핵심 과업이 수행되어야 하며, 375px에서는 더 자연스럽게 보이도록 조정합니다.

5.3 Page Layout

일반 페이지는 다음 영역으로 구성합니다.

1. Header
2. Optional left menu
3. Main contents
4. Optional right help or anchor menu
5. Footer

신청 페이지는 다음 흐름을 기본으로 합니다.

1. 페이지 제목
2. 안내 패널
3. 단계 표시기
4. 입력폼
5. 첨부파일
6. 확인 요약
7. CTA 영역
8. 오류 또는 성공 상태

5.4 Mobile Layout

모바일에서는 단일 컬럼을 기본으로 합니다.

- Horizontal padding: 16px 기본, 복잡한 입력 화면은 20px 허용
- Bottom CTA: safe area를 반영합니다.
- Bottom Sheet: 선택과 보조 입력에 사용합니다.
- 긴 표는 카드형 목록으로 전환합니다.
- Side menu는 전체메뉴 또는 drawer로 전환합니다.
- Step indicator는 축약형을 허용합니다. 예: "2 / 5 단계"

5.5 Whitespace Philosophy

공공 서비스는 많은 정보를 담아야 하지만 화면을 조밀하게 만들면 신뢰와 이해도가 떨어집니다. 핵심 과업 주변에는 충분한 여백을 둡니다. TDS의 “중요한 숫자에는 숨 쉴 공간을 준다”는 원칙을 공공 서비스에 맞게 적용합니다. 금액, 접수번호, 결과 상태, 신청 완료 메시지는 주변 여백을 넉넉히 두어 사용자가 즉시 확인할 수 있게 합니다.

5.6 Border Radius

Token| Value| Use
xsmall| 2px| 미세 요소
small| 4px| 배지, 작은 버튼
medium| 6px| medium 버튼, select
large| 8px| 카드, input, large button
xlarge| 10px| xlarge input
modal| 12px| modal, bottom sheet
full| 1000px| pill, chip, round icon

16px 라운드는 기본으로 사용하지 않습니다. TDS에서 바텀시트나 카드가 16px를 쓰더라도 이 시스템에서는 12px 이하로 재해석합니다.

6. Depth & Elevation

KRDS의 평탄한 표면 철학을 따릅니다. 그림자는 정보 구조를 만들기 위한 기본 수단이 아닙니다.

Level| Treatment| Use
Flat 0| shadow none| 페이지 배경, 일반 콘텐츠
Border 1| 1px solid "#B1B8BE" or "#CDD1D5"| 카드, 패널, 입력, 표
Drop 2| KRDS dropdown shadow| 드롭다운, 툴팁, popover
Modal 3| modal shadow plus backdrop| 모달, 전체메뉴
Sheet 3| soft top shadow plus backdrop| 모바일 바텀시트
Focus| 4px "#256EF4" halo| 모든 인터랙티브 요소

TDS의 부드러운 카드 그림자 체계는 그대로 사용하지 않습니다. 카드에는 기본적으로 shadow를 주지 않습니다. 화면 위에 떠야 하는 요소, 즉 modal, dropdown, tooltip, bottom sheet에만 제한적으로 사용합니다.

7. Do's and Don'ts

Do

- KRDS "#256EF4"를 유일한 Primary action 색상으로 사용합니다.
- 본문은 17px, 400, line-height 1.5를 기본으로 합니다.
- Pretendard GOV를 기본 서체로 사용합니다.
- 모든 버튼, 링크, 입력, 선택 컨트롤에 4px focus halo를 제공합니다.
- Primary 버튼은 한 화면에 하나만 둡니다.
- 양식 오류는 오류 위치, 이유, 수정 방법을 함께 안내합니다.
- 로딩 상태는 최종 레이아웃과 같은 구조로 보여 줍니다.
- 숫자와 금액은 tabular numeral로 표시합니다.
- 모바일 선택, 인증번호 입력, 보안 키패드, 스켈레톤은 TDS의 UX 방식을 참고하되 KRDS 시각 언어로 재구성합니다.
- 빈 상태에는 다음 행동을 제공합니다.
- 성공 상태는 기록 가능한 결과 화면으로 제공합니다.
- reduced motion 사용자를 위한 즉시 전환을 제공합니다.
- 접근성, 키보드 탐색, 스크린 리더 안내를 설계 단계에서 함께 정의합니다.

Don't

- TDS의 "#3182F6" 또는 "#0064FF"를 인터페이스 색상으로 사용하지 않습니다.
- Toss Product Sans를 기본 서체로 사용하지 않습니다.
- 카드에 TDS식 16px 라운드와 부드러운 그림자를 그대로 적용하지 않습니다.
- Primary 색상을 장식 배경이나 일러스트에 사용하지 않습니다.
- 한 화면에 동일 위계의 Primary 버튼을 두 개 이상 두지 않습니다.
- 오류 메시지를 "오류가 발생했습니다"처럼 단독으로 쓰지 않습니다.
- 빈 상태를 "데이터가 없습니다"로만 표현하지 않습니다.
- 색상만으로 성공, 실패, 경고, 진행 상태를 전달하지 않습니다.
- 공공 서비스 화면에 과장된 마케팅 표현을 사용하지 않습니다.
- Spring motion을 일반 UI에 사용하지 않습니다.
- 포커스 outline을 제거하지 않습니다.
- 모바일에서 표를 그대로 축소해 읽기 어렵게 만들지 않습니다.
- 법적 동의나 중요한 제출을 switch로 처리하지 않습니다.

8. Responsive Behavior

8.1 Breakpoints

Name| Width| Behavior
small| 360px 이상| 단일 컬럼, 16px margin, 모바일 메뉴
medium| 768px 이상| 8-column grid, 일부 2열 배치 가능
large| 1024px 이상| 12-column grid, full GNB, optional side menu
xlarge| 1280px 이상| 1200px content max width 유지

8.2 Touch Targets

- Primary CTA xlarge: 64px
- Button large: 56px
- Button medium: 48px
- Input large: 56px
- Select large: 56px
- List row: 최소 56px
- OTP cell: 48px 이상
- Secure keypad button: 56px 이상
- Pagination button: 40px by 40px
- Icon-only button: 최소 40px by 40px

8.3 Component Adaptation

Desktop| Mobile
Modal| Bottom Sheet 또는 full-screen dialog
Table| Card list 또는 horizontal scroll
Side menu| Drawer 또는 전체메뉴
Multi-column form| Single-column form
Breadcrumb| Back button or compact path
Large tab list| Scrollable tab or segmented control
Right help panel| Inline help accordion or bottom sheet

8.4 Safe Area

모바일 하단 CTA, toast, snackbar, bottom sheet는 safe area inset을 반영합니다. iOS와 Android의 시스템 제스처 영역과 겹치지 않아야 합니다.

8.5 Image and Media

- 콘텐츠 이미지는 1200px 컨테이너 안에서 배치합니다.
- 비율은 16:9 또는 4:3을 기본으로 합니다.
- 아이콘은 16px, 20px, 24px 그리드를 사용합니다.
- 정보 전달 이미지는 대체 텍스트를 제공합니다.
- 동영상은 자막, 음성 설명, 대체 콘텐츠를 제공합니다.

9. Agent Prompt Guide

9.1 Quick Color Reference

- Primary action: "#256EF4"
- Primary hover: "#0B50D0"
- Primary pressed: "#083891"
- Primary subtle background: "#ECF2FE"
- Body text: "#1E2124"
- Secondary text: "#464C53"
- Muted text: "#6D7882"
- Strong border: "#58616A"
- Subtle border: "#B1B8BE"
- Muted border: "#CDD1D5"
- Background: "#FFFFFF"
- Gray surface: "#F4F5F6"
- Danger: "#DE3412"
- Warning: "#FFB114"
- Warning text: "#9E6A00"
- Success: "#228738"
- Information: "#0B78CB"
- Point: "#D63D4A"

9.2 Component Prompt Examples

Primary CTA:

"Primary 버튼 xlarge: #256EF4 배경, 흰색 텍스트, 19px 400, 8px radius, 0 24px padding, 64px 높이. Hover #0B50D0, pressed #083891, focus ring 4px #256EF4. 한 화면에 하나만 사용."

Required text input:

"필수 입력 텍스트 필드 large: 흰색 배경, #58616A 1px 보더, 8px radius, 56px 높이, 0 16px padding, 19px 400. 라벨 옆 빨간 별표, 스크린리더용 필수 안내, focus 시 4px #256EF4 halo."

Error input:

"Error 텍스트 필드: 기존 input에 #DE3412 2px 보더, helper text #DE3412 15px 400. aria-invalid true, 오류 메시지를 입력 필드와 연결. 오류 문장은 무엇이 문제인지와 수정 방법을 포함."

Bottom sheet:

"모바일 바텀시트: TDS 흐름 참고, KRDS 스타일 적용. 흰색 배경, 상단 12px radius, 24px 20px padding, black 0.5 backdrop, 절제된 상단 shadow. Primary 색상은 #256EF4만 사용."

Skeleton:

"스켈레톤 로딩: 최종 레이아웃과 같은 크기의 #F4F5F6 블록, 8px radius. reduced motion에서는 정적 표시. 금액, 접수번호, 인증번호처럼 값으로 오해될 수 있는 정보는 skeleton 대신 -- 또는 확인 중 사용."

OTP input:

"인증번호 입력: 6개 셀, 각 48px 이상, 흰색 배경, #58616A 1px 보더, 8px radius, active 시 4px #256EF4 focus halo, 숫자는 24px 700 tabular-nums. 붙여넣기 지원, 오류 시 #DE3412 2px 보더와 구체적 안내문."

Numeric card:

"접수 결과 카드: 흰색 배경, #B1B8BE 1px 보더, 8px radius, 24px padding. 상태 제목 24px 700, 접수번호 32px 700 tabular-nums, 보조 설명 17px 400. 완료 상태는 Success badge와 텍스트를 함께 표시."

9.3 Iteration Guide

1. 먼저 KRDS 컴포넌트로 해결할 수 있는지 확인합니다.
2. KRDS에 없는 모바일 패턴이면 TDS에서 행동 방식을 참고합니다.
3. TDS 색상, 폰트, 라운드, 그림자는 가져오지 않습니다.
4. 가져온 패턴은 KRDS 토큰으로 다시 정의합니다.
5. 접근성 속성, 포커스 순서, 키보드 조작을 함께 정의합니다.
6. Primary 색상은 "#256EF4" 하나만 사용합니다.
7. 화면당 Primary CTA는 하나만 둡니다.
8. 숫자는 tabular numeral로 표시합니다.
9. 오류와 빈 상태에는 다음 행동을 포함합니다.
10. reduced motion 대응을 반드시 포함합니다.

10. Voice & Tone

이 시스템의 문체는 KRDS의 공공 서비스 안내 데스크 화법을 따릅니다. 정중하고 명확하며 절제된 문장을 사용합니다. TDS의 친근한 금융 앱 문체는 참고하지 않습니다. 단, 사용자를 탓하지 않고 문제 해결을 돕는 태도는 유지합니다.

10.1 General Tone

- 정중한 문장으로 안내합니다.
- 사용자를 평가하거나 탓하지 않습니다.
- 행정 용어는 쉬운 말로 바꿉니다.
- 마케팅 표현을 사용하지 않습니다.
- 감탄사와 과장 표현을 피합니다.
- 필요한 정보와 다음 행동을 함께 제공합니다.
- 버튼은 짧은 동사형으로 씁니다.
- 결과 메시지는 완료 사실을 명확히 알립니다.

10.2 Tone by Context

Context| Tone
Page headline| 명사형 한 줄. 예: 신청 내역 확인
Primary CTA| 동사 + 기. 예: 신청하기, 제출하기, 확인하기
Secondary CTA| 자세히 보기, 이전 단계, 다운로드
Tertiary CTA| 취소, 초기화, 닫기, 임시저장
Form label| 명사형. 예: 성명, 생년월일, 연락처
Required| 필수 입력 항목입니다
Error| 무엇이 문제인지와 수정 방법을 설명
Empty| 현재 상태와 다음 행동을 안내
Success| 완료 사실과 다음 단계를 안내
Help| 수집 목적, 근거, 작성 방법을 설명
Critical alert| 사실, 영향, 다음 행동을 짧게 안내

10.3 Preferred Phrases

- 신청이 완료되었습니다.
- 입력한 내용을 확인해 주세요.
- 올바른 이메일 형식이 아닙니다. example@domain.kr 형식으로 입력해 주세요.
- 검색 결과가 없습니다. 다른 키워드로 다시 시도해 주세요.
- 신청한 내역이 없습니다. 새 신청서를 작성할 수 있습니다.
- 일시적으로 서비스를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.
- 파일 용량이 너무 큽니다. 10MB 이하의 파일을 첨부해 주세요.
- 인증 시간이 만료되었습니다. 인증번호를 다시 요청해 주세요.

10.4 Forbidden Phrases

- 혁신적인
- 차세대
- 최고의
- 감동의
- 고객님께서는 입력하여 주시기 바랍니다
- 데이터가 없습니다
- 오류가 발생했습니다
- Oops
- 문제가 발생했어요
- 잘 모르시겠다면
- 대박
- 지금 바로 경험해 보세요

10.5 TDS Tone Conversion

TDS-like Tone| KRDS-first Tone
송금이 완료되었어요| 신청이 완료되었습니다
조건에 맞는 결과가 없어요| 조건에 맞는 결과가 없습니다. 검색 조건을 변경해 주세요
계좌번호를 다시 확인해주세요| 입력한 번호를 다시 확인해 주세요
복사되었어요| 복사되었습니다
잠시만 기다려주세요| 처리 중입니다

11. Brand Narrative

이 디자인 시스템은 대한민국 공공 서비스의 일관성, 접근성, 신뢰성을 기반으로 합니다. 사용자는 정부 사이트마다 다른 화면 구조와 표현 방식을 새로 학습하지 않아야 합니다. 신청, 조회, 검색, 확인, 제출, 오류, 완료는 모든 서비스에서 예측 가능한 방식으로 작동해야 합니다.

KRDS는 그 기준을 제공합니다. 정부 블루 "#256EF4", Pretendard GOV, 17px 본문, 1.5 line-height, 4px focus halo, 1px 보더 중심의 평탄한 화면은 공공 서비스의 기본 언어입니다. 이 언어는 화려함을 목표로 하지 않습니다. 사용자가 무엇을 해야 하는지 명확히 알고, 실수했을 때 쉽게 복구할 수 있으며, 보조기기 사용자도 동일하게 과업을 수행할 수 있게 하는 것이 목적입니다.

TDS는 모바일 앱에서 복잡한 기능을 단순하게 처리하는 실용적인 패턴을 제공합니다. 인증번호 입력, 보안 키패드, 바텀시트, 숫자 표시, 로딩 상태처럼 실제 사용 흐름에서 마찰을 줄이는 방식은 공공 서비스에도 유용합니다. 그러나 TDS의 외형을 그대로 가져오면 공공 서비스의 시각적 신뢰성과 제도적 톤이 약해질 수 있습니다. 따라서 이 시스템은 TDS의 행동 방식만 참고하고, 결과 화면은 언제나 KRDS처럼 보이게 만듭니다.

이 시스템의 정체성은 다음 문장으로 요약할 수 있습니다.

KRDS의 신뢰성과 접근성을 유지하면서, TDS에서 검증된 모바일 사용성 패턴을 공공 서비스 문맥에 맞게 절제하여 확장한다.

12. Principles

12.1 Accessibility First

접근성은 선택이 아니라 기본 조건입니다. 색대비, 키보드 탐색, 스크린 리더 안내, focus visibility, reduced motion, 오류 안내는 모든 컴포넌트의 필수 요건입니다.

UI implication:

- 모든 인터랙티브 요소는 focus 상태를 가져야 합니다.
- 색상만으로 의미를 전달하지 않습니다.
- 모달과 바텀시트는 포커스 트랩을 적용합니다.
- 에러 메시지는 입력 필드와 프로그램적으로 연결합니다.
- 스켈레톤 로딩은 스크린 리더에 불필요하게 읽히지 않도록 처리합니다.

12.2 KRDS Visual Authority

시각 체계의 최종 기준은 KRDS입니다. TDS의 색상, 폰트, 라운드, 그림자는 가져오지 않습니다.

UI implication:

- Primary는 "#256EF4"입니다.
- Body는 17px입니다.
- Card는 border 중심입니다.
- Focus ring은 4px입니다.
- Radius는 대부분 8px 이하입니다.

12.3 TDS as Interaction Reference

TDS는 사용 흐름을 참고하는 보조 체계입니다.

UI implication:

- 바텀시트는 TDS 흐름을 참고하되 KRDS modal 스타일로 재구성합니다.
- OTP 입력은 TDS 구조를 참고하되 KRDS input 스타일로 만듭니다.
- 스켈레톤은 TDS의 레이아웃 일치 원칙을 참고하되 KRDS gray surface를 사용합니다.
- 수치 표현은 TDS의 tabular numeral 원칙을 참고하되 Pretendard GOV로 표시합니다.

12.4 One Decision per Screen

한 화면은 하나의 주요 결정을 안내해야 합니다. Primary 버튼이 두 개 있다면 화면 구조를 다시 나누어야 합니다.

UI implication:

- Primary CTA는 한 화면에 하나만 배치합니다.
- Secondary와 Tertiary를 명확히 구분합니다.
- 되돌릴 수 없는 행위는 확인 단계를 둡니다.
- 신청 결과는 toast가 아니라 전용 결과 화면으로 제공합니다.

12.5 Predictability

사용자는 정부 서비스를 처음 방문해도 구조를 예측할 수 있어야 합니다.

UI implication:

- Header, GNB, Footer 위치를 일관되게 유지합니다.
- 검색, 신청, 확인, 완료 패턴을 반복 가능하게 설계합니다.
- 컴포넌트 변형을 과도하게 늘리지 않습니다.
- 비표준 제스처에 핵심 기능을 숨기지 않습니다.

12.6 Clarity over Delight

공공 서비스에서 재미있는 인터랙션보다 중요한 것은 명확성입니다.

UI implication:

- Spring, bounce, overshoot를 일반 UI에 사용하지 않습니다.
- 애니메이션은 상태 변화를 이해시키는 데만 사용합니다.
- 일러스트나 장식은 정보 이해에 도움이 될 때만 사용합니다.
- 문장은 짧고 구체적으로 작성합니다.

12.7 Progressive Density

TDS의 정보 밀도 원칙을 공공 서비스에 맞게 적용합니다. 요약 화면은 넉넉하게, 상세 화면은 더 많은 정보를 담되 가독성을 해치지 않습니다.

UI implication:

- 첫 화면에는 핵심 행동과 요약만 제공합니다.
- 상세 화면에서는 표, 목록, 필터를 허용합니다.
- 모바일 상세 화면은 카드형 목록으로 구조화합니다.
- 중요한 숫자와 상태는 충분한 여백을 둡니다.

13. Personas

아래 페르소나는 이 디자인 시스템이 고려해야 할 대표 사용자 유형입니다. 특정 개인을 지칭하지 않습니다.

13.1 김순자, 68세, 대전

주민등록등본 발급, 건강보험 내역 확인, 복지 서비스 신청을 위해 공공 서비스를 이용합니다. 작은 글씨와 낮은 대비에 취약합니다. 입력 오류가 발생했을 때 무엇을 고쳐야 하는지 분명히 알려 주어야 합니다.

Design needs:

- 17px 이상 본문
- 130% 이상 확대 대응
- 높은 색대비
- 명확한 오류 문구
- 큰 터치 영역
- 단계별 신청 흐름

13.2 박지훈, 29세, 서울

스크린 리더와 키보드로 공공 서비스를 이용합니다. 버튼이 semantic button이 아니거나 focus 순서가 어긋나면 과업을 완료하기 어렵습니다.

Design needs:

- 정확한 HTML semantics
- ARIA 속성
- focus trap
- keyboard navigation
- skip link
- 오류 영역 자동 포커스
- 색상 외 상태 정보

13.3 Sarah Kim, 34세, 해외 거주

해외에서 한국 공공 서비스를 이용합니다. 날짜, 시간, 인증 방식, 언어 전환이 명확해야 합니다.

Design needs:

- 명확한 KST 표기
- 쉬운 한국어와 plain English 병행 가능성
- 인증 제한 시간 안내
- 모바일 친화 인증 입력
- 오류 복구 경로

13.4 이주임, 41세, 지방자치단체 공무원

CMS에서 공공 서비스 콘텐츠를 게시하고 수정합니다. 어떤 버튼이 Primary인지, 어떤 상태 배지를 써야 하는지 빠르게 판단해야 합니다.

Design needs:

- 명확한 컴포넌트 사용 기준
- 제한된 색상과 변형
- 복사 가능한 문구 예시
- 접근성 체크리스트
- 오류와 빈 상태 템플릿

13.5 최민호, 22세, 모바일 중심 사용자

스마트폰으로 신청, 조회, 첨부를 끝내고 싶어 합니다. 모바일에서 입력과 인증 흐름이 복잡하면 이탈합니다.

Design needs:

- Bottom CTA
- Bottom Sheet
- OTP input
- File upload feedback
- 간결한 단계 표시
- 안전 영역 대응
- 빠른 로딩 피드백

13.6 정민, 35세, 자영업자

세금, 지원금, 사업자 관련 신청을 자주 처리합니다. 금액, 기한, 처리 상태를 빠르게 확인하고 싶어 합니다.

Design needs:

- tabular numeric display
- 상태 badge
- 처리 기한 강조
- 신청 내역 목록
- 필터와 정렬
- 상세 화면의 높은 정보 밀도

14. States

상태 설계는 KRDS를 기준으로 하며, 로딩과 수치 갱신은 TDS의 실용적 패턴을 참고합니다.

14.1 Empty States

Search Empty

문구:

"검색 결과가 없습니다. 다른 키워드로 다시 시도해 주세요."

Actions:

- 검색어 초기화
- 검색 도움말 보기
- 전체 목록 보기

Application History Empty

문구:

"신청한 내역이 없습니다. 새 신청서를 작성할 수 있습니다."

Actions:

- 새 신청서 작성하기 Primary
- 신청 가능한 서비스 보기 Secondary

Filter Empty

문구:

"조건에 맞는 결과가 없습니다. 필터를 변경해 주세요."

Actions:

- 필터 초기화 Tertiary

14.2 Loading States

Page Loading

- Skeleton blocks matching final layout
- "aria-busy="true""
- 상태 안내: "내용을 불러오는 중입니다."
- reduced motion에서는 shimmer 없이 정적 block

Refresh Loading

- 기존 콘텐츠 유지
- 상단 또는 해당 영역에 작은 loading indicator
- 화면 전체 차단 금지

Form Submit Loading

- Primary 버튼 disabled
- 버튼 텍스트: "처리 중"
- "aria-busy="true""
- 중복 제출 방지

Numeric Loading

- 금액, 접수번호, 건수: skeleton 대신 "--", "확인 중", "산정 중"
- 실제 값으로 오해될 수 있는 흐릿한 숫자 placeholder 금지

14.3 Error States

Field Error

- Border: "2px solid #DE3412"
- Helper text: "#DE3412", 15px / 400
- "aria-invalid="true""
- "aria-describedby"로 오류 메시지 연결
- 오류 예시: "올바른 이메일 형식이 아닙니다. example@domain.kr 형식으로 입력해 주세요."

Select Error

- Border: "2px solid #AB2B36"
- Helper text는 구체적으로 작성합니다.
- 예시: "지역을 선택해 주세요."

File Upload Error

- 용량 초과: "파일 용량이 너무 큽니다. 10MB 이하의 파일을 첨부해 주세요."
- 형식 오류: "첨부할 수 없는 파일 형식입니다. PDF, JPG, PNG 파일을 첨부해 주세요."
- 업로드 실패: "파일을 첨부하지 못했습니다. 다시 시도해 주세요."

Server Error

문구:

"일시적으로 서비스를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요."

Actions:

- 다시 시도하기
- 고객센터 확인
- 이전 화면으로 돌아가기

Network Error

문구:

"인터넷 연결을 확인할 수 없습니다. 연결 상태를 확인한 후 다시 시도해 주세요."

Actions:

- 다시 시도하기

Authentication Error

문구:

"인증번호가 일치하지 않습니다. 입력한 번호를 다시 확인해 주세요."

Actions:

- 다시 입력
- 인증번호 재전송

Session Timeout

문구:

"로그인 시간이 만료되었습니다. 계속 이용하려면 다시 로그인해 주세요."

Actions:

- 다시 로그인하기
- 처음으로 이동

14.4 Success States

Save Success

Toast:

"저장되었습니다."

Copy Success

Toast:

"복사되었습니다."

Application Submit Success

전용 결과 화면으로 처리합니다.

Title:

"신청이 완료되었습니다."

Content:

- 접수번호
- 신청일시
- 처리 예정일
- 다음 단계
- 신청 내역 확인하기 Primary

Payment or Refund Success

공공 서비스에서 금액 처리 결과가 중요한 경우 전용 결과 화면으로 처리합니다.

Title:

"납부가 완료되었습니다." 또는 "환급 신청이 완료되었습니다."

Content:

- 금액
- 처리 기관
- 처리 일시
- 영수증 또는 내역 확인 CTA

14.5 Disabled States

- Background: "#CDD1D5"
- Text: "#6D7882"
- Border: "#B1B8BE"
- Cursor: not-allowed
- "aria-disabled="true""
- 비활성 사유를 제공해야 합니다.

예시:

"주민등록번호를 먼저 입력해 주세요."

14.6 Focus State

- 모든 인터랙티브 요소에 4px halo 적용
- 키보드 focus는 hover보다 우선
- focus 순서는 시각 순서와 일치
- 모달과 바텀시트 내부에서는 focus trap 적용
- 닫힌 후에는 원래 트리거로 focus 반환

14.7 High Contrast Mode

- 텍스트와 보더 대비를 높입니다.
- focus ring은 유지하거나 더 강하게 표시합니다.
- 상태 색상은 텍스트 라벨과 함께 유지합니다.
- 배경색만으로 영역을 구분하지 않습니다.

14.8 User Zoom

- 90%, 100%, 110%, 130%, 150% 확대를 고려합니다.
- rem 기반으로 구현합니다.
- 150%에서도 주요 과업이 가로 스크롤 없이 수행되어야 합니다.
- 콘텐츠가 겹치면 줄바꿈, 세로 배치, 축약형 UI로 전환합니다.

15. Motion & Easing

모션은 KRDS를 우선합니다. TDS의 빠른 전환 감각은 참고할 수 있지만, 공공 서비스에서는 절제된 전환을 사용합니다.

15.1 Duration Tokens

Token| Value| Use
motion-instant| 0ms| 체크박스, 토글 상태 변경, reduced motion
motion-fast| 150ms| 버튼 press, 작은 hover feedback
motion-standard| 250ms| 작은 panel, segmented control 전환
motion-base| 400ms ease-in-out| 메뉴, dropdown, panel
motion-fade| opacity 400ms linear| modal, toast, backdrop
motion-collapse| max-height 400ms ease| accordion
motion-page| 350ms| top-level route transition, 필요 시
motion-reduced| 0ms| reduced motion mode

15.2 Easing

Token| Curve| Use
ease-in-out| ease-in-out| 기본 양방향 전환
ease| ease| accordion, height change
linear| linear| opacity fade
ease-enter| cubic-bezier(0.0, 0.0, 0.2, 1)| 제한적 진입 전환
ease-exit| cubic-bezier(0.4, 0.0, 1, 1)| 제한적 종료 전환

Spring easing은 기본적으로 사용하지 않습니다. 성공 체크마크 같은 작은 장식에서도 공공 서비스에서는 신중하게 사용합니다. 법적, 금융적, 행정적 결과 화면에는 spring을 쓰지 않는 것을 권장합니다.

15.3 Signature Motions

Dropdown

- opacity plus translateY
- duration 400ms
- easing ease-in-out
- reduced motion: 즉시 표시

Accordion

- max-height transition
- duration 400ms
- easing ease
- 텍스트 fade는 사용하지 않습니다.

Modal

- backdrop opacity fade
- modal opacity fade
- duration 400ms
- transform은 기본 사용하지 않습니다.
- focus는 즉시 modal title 또는 첫 번째 조작 요소로 이동합니다.

Bottom Sheet

- 아래에서 위로 짧게 진입
- duration 250ms to 400ms
- backdrop fade 동시 적용
- reduced motion: 즉시 표시
- 스크롤 가능한 경우 drag handle은 장식이 아니라 조작 가능성 안내로 사용합니다.

Numeric Update

TDS의 금액 변경 원칙을 참고합니다.

- 중요한 숫자가 바뀔 때는 깜빡임을 피합니다.
- 기존 값과 새 값을 cross-fade하지 않습니다.
- 공공 서비스에서는 숫자 slide motion보다 즉시 갱신과 "갱신됨" 안내를 우선합니다.
- 실시간 변동 값이 아니면 애니메이션을 생략합니다.

15.4 Reduced Motion

"prefers-reduced-motion: reduce"가 활성화되면 모든 motion token은 0ms로 축소합니다.

- slide 제거
- fade 제거 또는 즉시 표시
- shimmer 제거
- spinner는 정적 상태 또는 짧은 텍스트 안내로 대체 가능
- 과업 수행 가능성은 유지합니다.

16. TDS Borrowing Rules

TDS는 다음 영역에서만 참고합니다.

16.1 Allowed Borrowing

Area| Borrow from TDS| Apply with KRDS
Bottom Sheet| 모바일 선택 흐름| KRDS radius 12px, KRDS modal shadow, KRDS 문체
OTP Input| 6자리 입력 구조, paste 지원| KRDS input border, focus halo, Pretendard GOV
Secure Keypad| 큰 터치 영역, 보안 입력 흐름| KRDS 색상, 접근성, 명확한 안내
Skeleton| 최종 레이아웃과 같은 placeholder| KRDS gray "#F4F5F6", reduced motion 대응
Numeric Display| tabular numerals, 숫자 강조| Pretendard GOV, KRDS 색상
Progressive Density| 요약은 넓게, 상세는 촘촘하게| KRDS grid와 spacing 안에서 적용
Loading Button| width 유지, 중복 제출 방지| KRDS button style
Mobile CTA| 하단 고정 CTA| safe area와 KRDS button 사용

16.2 Forbidden Borrowing

TDS Element| Reason
"#3182F6" UI Blue| KRDS Primary와 충돌
"#0064FF" Brand Blue| Toss 브랜드 전용 색상
Toss Product Sans| KRDS 서체 체계와 충돌
16px default card radius| KRDS의 절제된 공공 톤과 충돌
Heavy soft card shadows| KRDS border-first 철학과 충돌
Friendly fintech copy| 공공 서비스 문체와 충돌
Spring UI motion| 공공 서비스의 예측 가능성과 충돌
Decorative blue usage| Primary action 색상 의미를 약화

16.3 Re-skin Matrix

TDS Pattern| KRDS Re-skin
Blue CTA| "#256EF4", KRDS button size
Weak blue button| "#ECF2FE" bg, "#0B50D0" text
Rounded card| 8px radius, 1px border
Bottom sheet 16px radius| 12px top radius
Skeleton "#F2F4F6"| "#F4F5F6"
Error red "#F04452"| "#DE3412"
Success green "#03B26C"| "#228738"
Toss text tone| KRDS formal plain Korean
Tabular money| KRDS numeric tokens with tabular-nums

17. Accessibility Checklist

17.1 Keyboard

- 모든 인터랙티브 요소는 Tab으로 접근 가능합니다.
- focus 순서는 시각 순서와 일치합니다.
- Modal, Bottom Sheet는 focus trap을 적용합니다.
- ESC 닫기를 지원합니다.
- 닫힌 후 focus는 트리거 요소로 돌아갑니다.
- Tab list는 arrow key navigation을 지원합니다.
- Radio group은 arrow key navigation을 지원합니다.

17.2 Screen Reader

- 버튼은 실제 button 요소를 사용합니다.
- 링크는 실제 a 요소를 사용합니다.
- 입력 필드는 label과 연결합니다.
- 오류 메시지는 aria-describedby로 연결합니다.
- 필수 입력은 aria-required를 사용합니다.
- 상태 변화는 필요한 경우 aria-live를 사용합니다.
- loading 영역은 aria-busy를 사용합니다.
- decorative skeleton은 스크린 리더에서 숨깁니다.

17.3 Color and Contrast

- 일반 텍스트는 4.5:1 이상입니다.
- 큰 텍스트와 아이콘은 3:1 이상입니다.
- focus 표시 대비는 충분해야 합니다.
- 색상만으로 의미를 전달하지 않습니다.
- 고대비 모드에서도 정보 구조가 유지되어야 합니다.

17.4 Motion

- prefers-reduced-motion을 지원합니다.
- 자동 재생 모션은 사용하지 않습니다.
- shimmer는 reduced motion에서 비활성화합니다.
- 중요한 정보는 애니메이션 완료를 기다리지 않고 접근 가능해야 합니다.

17.5 Forms

- 오류 발생 시 첫 오류 영역으로 이동하거나 오류 요약을 제공합니다.
- 오류 요약에서 각 필드로 이동할 수 있습니다.
- 입력값은 제출 실패 후에도 보존합니다.
- 비활성 필드는 이유를 설명합니다.
- 자동입력 값은 "자동 입력된 정보입니다"처럼 안내합니다.

18. Implementation Checklist

18.1 Foundation

- KRDS color tokens 적용
- Pretendard GOV font stack 적용
- 17px body default 적용
- line-height 1.5 적용
- focus ring 4px 적용
- spacing scale 적용
- radius scale 적용
- reduced motion 적용
- high contrast mode 대응

18.2 Components

- Button variants 구현
- Input variants 구현
- Select 구현
- Checkbox, radio, switch 구현
- Card and panel 구현
- Badge and tag 구현
- Tabs 구현
- Modal 구현
- Bottom Sheet 구현
- Toast and snackbar 구현
- Skeleton 구현
- OTP input 구현
- Secure keypad 구현
- Pagination 구현
- Step indicator 구현
- Breadcrumb 구현
- Help panel 구현

18.3 Patterns

- Search pattern
- Input form pattern
- Consent pattern
- File attachment pattern
- Confirmation pattern
- Error pattern
- Empty state pattern
- Application journey
- Login and authentication journey
- Policy information journey
- Result page pattern
- Mobile notification pattern

18.4 Content

- KRDS tone 적용
- 오류 문구 구체화
- 빈 상태 다음 행동 제공
- 성공 상태 다음 단계 제공
- 어려운 행정 용어 쉬운 말로 교체
- 버튼 문구 짧게 유지
- 숫자와 날짜 형식 통일
- 약어 첫 등장 시 설명

18.5 Quality Gates

- 색대비 검사 통과
- 키보드만으로 전체 과업 완료 가능
- 스크린 리더 기본 흐름 확인
- 150% 확대에서 주요 과업 가능
- 360px viewport에서 주요 과업 가능
- reduced motion에서 기능 유지
- 오류 발생 후 입력값 보존
- 로딩 상태에서 중복 제출 방지
- 모바일 safe area 확인

19. Filled Gaps and Assumptions

이 문서는 KRDS와 TDS의 제공된 사양을 기반으로 하되, 실제 제품 설계에 필요한 일부 빈틈을 다음과 같이 보완합니다.

19.1 Bottom Sheet

KRDS에는 모바일 bottom sheet의 상세 시각 규칙이 상대적으로 부족하므로 TDS의 bottom sheet 사용 방식을 참고했습니다. 다만 TDS의 16px radius와 부드러운 앱 스타일 shadow는 사용하지 않고, KRDS modal 계열에 맞춰 12px top radius, 흰색 표면, 검정 0.5 backdrop, 절제된 shadow로 정의했습니다.

19.2 OTP Input

KRDS의 기본 input 규칙만으로는 인증번호 입력 경험이 부족할 수 있으므로 TDS의 OTP 입력 구조를 참고했습니다. 붙여넣기, 자리 이동, 남은 시간 표시, 재전송 버튼, 오류 연결 방식을 추가했습니다. 모든 시각 값은 KRDS input과 focus token을 사용합니다.

19.3 Secure Keypad

민감 정보 입력이 필요한 공공 서비스에 대비해 TDS의 secure keypad 개념을 참고했습니다. 단, 무작위 배열은 보안 요구가 있을 때만 사용하며, 접근성을 해치지 않는 것을 우선 조건으로 두었습니다.

19.4 Skeleton Loading

KRDS의 loading pattern을 보완하기 위해 TDS의 skeleton 구조 일치 원칙을 반영했습니다. 최종 레이아웃과 같은 크기로 skeleton을 두되, 금액과 접수번호처럼 실제 값으로 오해될 수 있는 영역은 "--" 또는 "확인 중"으로 처리하도록 정의했습니다.

19.5 Numeric Display

TDS의 금융 수치 표현 원칙을 공공 서비스의 접수번호, 금액, 처리 건수, 날짜, 기한 표시로 확장했습니다. 다만 Toss Product Sans는 사용하지 않고 Pretendard GOV와 tabular numeral을 사용합니다.

19.6 Progressive Density

TDS의 요약 화면과 상세 화면 밀도 차이를 공공 서비스에 맞게 적용했습니다. 첫 화면은 명확하고 넓게, 상세 화면은 표와 목록을 활용해 더 많은 정보를 제공하되 가독성과 접근성을 유지합니다.

19.7 Motion

KRDS의 400ms 전환을 기본으로 두되, 모바일 bottom sheet와 작은 press feedback에는 TDS식 빠른 반응성을 참고했습니다. Spring motion은 일반 UI에서 제외했습니다.

20. Example Screens

20.1 Application Start Page

Structure:

1. Header
2. Breadcrumb
3. H1: "민원 신청"
4. Info panel: 신청 전 준비해야 할 정보 안내
5. Required documents card
6. Primary CTA: "신청하기"
7. Secondary CTA: "자세히 보기"
8. Footer

Visual:

- H1: 40px / 700
- Body: 17px / 400
- Info panel: "#ECF2FE", 8px radius
- CTA: Primary xlarge 64px
- Layout: 1200px max width

20.2 Multi-step Form

Structure:

1. H1
2. Step indicator
3. Error summary if needed
4. Form section cards
5. Temporary save tertiary button
6. Bottom CTA on mobile
7. Previous and next actions

Rules:

- Required fields marked clearly
- Error summary appears above form
- First invalid field receives focus after submit
- Values are preserved after error
- Mobile uses single-column layout

20.3 Verification Code Screen

Structure:

1. H1: "인증번호 입력"
2. Description: "휴대전화로 받은 인증번호 6자리를 입력해 주세요."
3. OTP input
4. Timer: "남은 시간 02:59"
5. Resend button
6. Primary CTA: "확인하기"

Rules:

- OTP cells use KRDS input style
- Paste supported
- Timer uses tabular numeral
- Error message connected with aria-describedby
- Resend button disabled until allowed

20.4 Search Results

Structure:

1. Search input xlarge
2. Filter chips
3. Result count: "총 128건"
4. Sort select
5. Result list
6. Pagination

Empty:

"검색 결과가 없습니다. 다른 키워드로 다시 시도해 주세요."

Actions:

- 검색어 초기화
- 검색 도움말 보기

20.5 Application Complete

Structure:

1. Success badge
2. H1: "신청이 완료되었습니다."
3. 접수번호 numeric large
4. 신청일시
5. 처리 예정일
6. 안내 panel
7. Primary CTA: "신청 내역 확인하기"
8. Secondary CTA: "처음으로 이동"

Rules:

- Toast로 대체하지 않습니다.
- 접수번호는 tabular numeral을 사용합니다.
- 다음 단계를 반드시 안내합니다.

21. Source and Verification Notes

이 문서는 사용자가 제공한 KRDS 사양과 TDS 사양을 기준으로 작성되었습니다. KRDS가 최상위 기준이며, TDS는 보조 UX 참고 체계입니다.

Primary source basis:

- KRDS 색상, 타이포그래피, 레이아웃, 컴포넌트, 접근성, 문체, 상태 규칙
- TDS 모바일 컴포넌트, 인증 입력, 로딩, 수치 표현, 바텀시트, 모바일 상호작용 원칙

Conflict resolution:

- 색상 충돌은 KRDS 우선으로 해결했습니다.
- 폰트 충돌은 KRDS 우선으로 해결했습니다.
- 라운드 충돌은 KRDS radius scale로 해결했습니다.
- 그림자 충돌은 KRDS border-first 원칙으로 해결했습니다.
- 문체 충돌은 KRDS 공공 안내 문체로 해결했습니다.
- 모바일 패턴 부족은 TDS UX를 KRDS 시각 언어로 재해석하여 보완했습니다.

Unresolved conflicts:

- 없음.

Final rule:

KRDS로 보이는 화면 안에서, TDS처럼 마찰이 적은 모바일 사용성을 제공한다.