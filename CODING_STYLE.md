Next.js TypeScript Go-like Coding Style Guide

1. 목적

이 문서는 Next.js App Router 프로젝트에서 TypeScript 코드를 Go의 코드 작성 철학에 가깝게 작성하기 위한 팀 스타일 가이드이다.

우리의 목표는 복잡한 추상화보다 읽기 쉬운 코드를 우선하는 것이다. 코드는 영리하게 보이는 것보다 처음 읽는 사람이 빠르게 이해할 수 있어야 한다.

이 문서는 특히 다음 영역을 다룬다.

- Server Components
- Client Components
- Server Actions
- Route Handlers
- 서비스 함수
- 데이터 접근 함수
- 에러 처리
- 폴더 구조
- API 응답 구조

2. 기본 원칙

2.1 Go처럼 단순하게 작성한다

코드는 숨겨진 흐름보다 명시적인 흐름을 우선한다.

좋은 예시는 다음과 같다.

// 사용자를 조회한다.
const [user, findUserError] = await findUserById(userId);

// 에러가 있으면 즉시 반환한다.
if (findUserError !== null) {
  return fail(findUserError);
}

// 정상 값을 사용한다.
return ok(user);

피해야 할 예시는 다음과 같다.

// 여러 동작을 체이닝으로 감싸면 흐름을 추적하기 어렵다.
return pipe(
  userId,
  findUserById,
  andThen(validateUser),
  andThen(updateUser),
  map(renderUser)
);

이 프로젝트에서는 함수형 체이닝보다 Go처럼 직접적인 제어 흐름을 우선한다.

2.2 예상 가능한 실패는 반환값으로 처리한다

입력 검증 실패, 권한 없음, 데이터 없음, 외부 API 실패처럼 일반적으로 발생할 수 있는 실패는 예외를 던지지 않는다.

대신 Go의 "(value, error)" 스타일을 TypeScript에서 사용한다.

2.3 프레임워크 제어 흐름은 예외로 허용한다

Next.js의 "redirect()"와 "notFound()"는 프레임워크가 제공하는 제어 흐름이다.

따라서 일반 비즈니스 에러와 다르게 취급한다.

다음 상황에서는 사용할 수 있다.

- 페이지 렌더링 중 리소스가 없어서 404 UI를 보여 주어야 하는 경우
- 인증 상태에 따라 로그인 페이지로 이동해야 하는 경우
- 작업 성공 후 다른 페이지로 이동해야 하는 경우

단, "redirect()"와 "notFound()"는 "try/catch" 안에서 호출하지 않는다.

3. 공통 Result 타입

프로젝트 전역에서 사용할 Go식 결과 타입은 다음과 같이 정의한다.

// src/shared/result.ts

// Go의 (value, error) 반환 방식을 TypeScript에서 표현하기 위한 타입이다.
// 성공하면 value에는 값이 들어가고 error는 null이다.
// 실패하면 value는 null이고 error에는 에러 정보가 들어간다.
export type GoResult<T, E> =
  | readonly [value: T, error: null]
  | readonly [value: null, error: E];

// 성공 결과를 만든다.
// 함수 반환부에서 [value, null]을 직접 쓰지 않고 ok(value)를 사용해 의도를 명확히 한다.
export function ok<T, E = never>(value: T): GoResult<T, E> {
  return [value, null];
}

// 실패 결과를 만든다.
// 함수 반환부에서 [null, error]를 직접 쓰지 않고 fail(error)를 사용해 의도를 명확히 한다.
export function fail<T = never, E = never>(error: E): GoResult<T, E> {
  return [null, error];
}

4. 에러 타입 작성 규칙

4.1 에러는 단순한 객체로 작성한다

에러는 "Error" 클래스를 상속하지 않는다. 예상 가능한 실패는 단순한 값으로 표현한다.

// src/features/users/user-errors.ts

// 사용자 관련 작업에서 발생할 수 있는 에러이다.
// code는 분기 처리를 위해 사용한다.
// message는 로그 또는 응답 메시지에 사용한다.
export type UserError = {
  readonly code:
    | 'empty_name'
    | 'invalid_email'
    | 'user_not_found'
    | 'database_failed';
  readonly message: string;
};

4.2 에러 메시지는 짧게 작성한다

에러 메시지는 현재 함수의 실패 원인만 표현한다. 상위 문맥은 호출하는 쪽에서 붙인다.

좋은 예시는 다음과 같다.

// 현재 함수의 실패 원인만 짧게 표현한다.
return fail({
  code: 'invalid_email',
  message: 'email is invalid'
});

호출하는 쪽에서 문맥을 붙인다.

// 어떤 작업에서 실패했는지는 호출하는 쪽에서 붙인다.
console.error(`create user: ${error.message}`);

피해야 할 예시는 다음과 같다.

// 에러 메시지 안에 너무 많은 문맥을 넣지 않는다.
return fail({
  code: 'invalid_email',
  message: 'Failed to create user because the email address is invalid.'
});

5. 폴더 구조

기능 단위로 코드를 모은다.

src/
  app/
    users/
      page.tsx
      actions.ts
    api/
      users/
        route.ts
  features/
    users/
      user-model.ts
      user-errors.ts
      user-service.ts
      user-repository.ts
  shared/
    result.ts
    http.ts

각 폴더의 역할은 다음과 같다.

app/
  Next.js 라우팅 파일을 둔다.
  page.tsx, layout.tsx, route.ts, actions.ts 같은 프레임워크 경계 파일이 위치한다.

features/
  도메인 로직과 서비스 함수를 둔다.
  Next.js에 직접 의존하지 않는 코드를 우선 배치한다.

shared/
  여러 기능에서 공통으로 사용하는 작은 유틸리티를 둔다.
  단, 거대한 utils.ts 파일은 만들지 않는다.

6. 도메인 모델 작성 규칙

6.1 데이터는 class보다 type으로 표현한다

단순 데이터는 "class"로 만들지 않는다. Go의 struct처럼 단순한 타입으로 표현한다.

// src/features/users/user-model.ts

// 사용자 ID이다.
// 단순 string이지만 의미를 명확히 하기 위해 별도 타입 이름을 사용한다.
export type UserId = string;

// 사용자 데이터이다.
// 기본적으로 불변 값처럼 다루기 위해 readonly를 사용한다.
export type User = {
  readonly id: UserId;
  readonly name: string;
  readonly email: string;
};

// 사용자 생성 입력이다.
// 외부에서 들어온 입력과 내부 User 타입을 구분한다.
export type CreateUserInput = {
  readonly name: string;
  readonly email: string;
};

7. 서비스 함수 작성 규칙

서비스 함수는 Next.js에 직접 의존하지 않는다. 즉, 서비스 함수 안에서 "redirect()", "notFound()", "NextResponse"를 사용하지 않는다.

서비스 함수는 GoResult를 반환한다.

// src/features/users/user-service.ts

import { fail, GoResult, ok } from '@/shared/result';
import { CreateUserInput, User } from './user-model';
import { UserError } from './user-errors';

// 문자열이 비어 있는지 확인한다.
function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

// 이메일 형식을 간단히 확인한다.
// 실제 서비스에서는 별도 검증 함수를 더 엄격하게 작성할 수 있다.
function isValidEmail(value: string): boolean {
  return value.includes('@');
}

// 새로운 사용자 ID를 생성한다.
function newUserId(): string {
  return crypto.randomUUID();
}

// 사용자를 생성한다.
// 입력 검증 실패는 예외가 아니라 GoResult로 반환한다.
export function createUser(input: CreateUserInput): GoResult<User, UserError> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (isBlank(name)) {
    return fail({
      code: 'empty_name',
      message: 'name is empty'
    });
  }

  if (!isValidEmail(email)) {
    return fail({
      code: 'invalid_email',
      message: 'email is invalid'
    });
  }

  return ok({
    id: newUserId(),
    name,
    email
  });
}

8. Server Actions 작성 규칙

8.1 Server Actions는 UI 상태를 반환한다

Server Actions는 폼과 직접 연결되는 경우가 많다. 따라서 내부 서비스 함수는 GoResult를 사용하되, Server Action의 최종 반환값은 UI에서 쓰기 쉬운 상태 객체로 변환한다.

// src/app/users/actions.ts

'use server';

import { createUser } from '@/features/users/user-service';

// 사용자 생성 폼의 상태이다.
// Client Component에서 메시지를 표시하기 쉽게 만든다.
export type CreateUserActionState = {
  readonly ok: boolean;
  readonly message: string;
};

// 사용자 생성 폼의 초기 상태이다.
export const initialCreateUserActionState: CreateUserActionState = {
  ok: false,
  message: ''
};

// 사용자 생성 Server Action이다.
// 예상 가능한 실패는 throw하지 않고 상태 객체로 반환한다.
export async function createUserAction(
  _prevState: CreateUserActionState,
  formData: FormData
): Promise<CreateUserActionState> {
  const name = formData.get('name');
  const email = formData.get('email');

  if (typeof name !== 'string') {
    return {
      ok: false,
      message: 'name is required'
    };
  }

  if (typeof email !== 'string') {
    return {
      ok: false,
      message: 'email is required'
    };
  }

  const [_user, createUserError] = createUser({
    name,
    email
  });

  if (createUserError !== null) {
    return {
      ok: false,
      message: createUserError.message
    };
  }

  return {
    ok: true,
    message: 'user created'
  };
}

8.2 Server Action에서 redirect는 try/catch 밖에서 호출한다

작업 성공 후 이동해야 한다면 성공 여부를 먼저 확인하고, 마지막에 "redirect()"를 호출한다.

// src/app/users/actions.ts

'use server';

import { redirect } from 'next/navigation';
import { createUser } from '@/features/users/user-service';

type CreateUserActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: { name?: string; email?: string };
};

// 예상 가능한 검증 실패는 throw하지 않고 상태로 반환한다.
export async function createUserAndRedirectAction(
  formData: FormData
): Promise<CreateUserActionState> {
  const name = formData.get('name');
  const email = formData.get('email');

  if (typeof name !== 'string') {
    return { ok: false, message: 'validation failed', fieldErrors: { name: 'name field must be string' } };
  }

  if (typeof email !== 'string') {
    return { ok: false, message: 'validation failed', fieldErrors: { email: 'email field must be string' } };
  }

  const [_user, createUserError] = createUser({
    name,
    email
  });

  if (createUserError !== null) {
    return { ok: false, message: createUserError.message };
  }

  redirect('/users');
}

단, 위 예시는 성공 후 이동이 필요한 경우에만 사용한다. 폼에서 오류 메시지를 보여 주어야 한다면 "redirect()" 대신 상태 객체를 반환한다.

9. Client Components 작성 규칙

Client Component는 UI 상호작용만 담당한다. 비즈니스 로직은 서비스 함수나 Server Action으로 분리한다.

// src/app/users/create-user-form.tsx

'use client';

import { useActionState } from 'react';
import {
  createUserAction,
  initialCreateUserActionState
} from './actions';

// 사용자 생성 폼 컴포넌트이다.
// Client Component는 입력과 표시만 담당한다.
export function CreateUserForm(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(
    createUserAction,
    initialCreateUserActionState
  );

  return (
    <form action={formAction}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" type="text" />

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" />

      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create user'}
      </button>

      {state.message.length > 0 ? (
        <p role="status">{state.message}</p>
      ) : null}
    </form>
  );
}

Client Component에서 피해야 할 패턴은 다음과 같다.

// Client Component 안에 비즈니스 검증과 저장 로직을 섞지 않는다.
'use client';

export function BadCreateUserForm(): React.JSX.Element {
  async function handleClick(): Promise<void> {
    // 이곳에서 직접 DB 저장, 권한 검증, 도메인 검증을 처리하지 않는다.
  }

  return <button onClick={handleClick}>Create user</button>;
}

10. Server Components 작성 규칙

Server Component는 데이터를 읽고 화면을 구성한다. 예상 가능한 데이터 없음은 서비스 함수에서 GoResult로 받은 뒤, 페이지 경계에서 "notFound()"로 변환할 수 있다.

// src/app/users/[id]/page.tsx

import { notFound } from 'next/navigation';
import { findUserById } from '@/features/users/user-repository';

// 페이지 컴포넌트의 props이다.
type UserPageProps = {
  readonly params: Promise<{
    readonly id: string;
  }>;
};

// 사용자 상세 페이지이다.
// 데이터가 없으면 Next.js의 notFound 제어 흐름으로 변환한다.
export default async function UserPage(
  props: UserPageProps
): Promise<React.JSX.Element> {
  const params = await props.params;

  const [user, findUserError] = await findUserById(params.id);

  if (findUserError !== null) {
    if (findUserError.code === 'user_not_found') {
      notFound();
    }

    throw new Error(`Failed to load user details: ${findUserError.message}`);
  }

  return (
    <main>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </main>
  );
}

여기서 "notFound()"는 비즈니스 에러가 아니라 Next.js 페이지 경계에서 사용하는 프레임워크 제어 흐름이다.

11. Route Handlers 작성 규칙

Route Handler는 HTTP 경계이다. 서비스 함수의 GoResult를 HTTP 응답으로 변환한다.

11.1 공통 HTTP 응답 헬퍼

// src/shared/http.ts

import { NextResponse } from 'next/server';

// API 성공 응답 형식이다.
export type ApiSuccess<T> = {
  readonly ok: true;
  readonly data: T;
};

// API 실패 응답 형식이다.
export type ApiFailure<E> = {
  readonly ok: false;
  readonly error: E;
};

// API 응답 형식이다.
export type ApiResponse<T, E> = ApiSuccess<T> | ApiFailure<E>;

// 성공 JSON 응답을 만든다.
export function jsonOk<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    {
      ok: true,
      data
    },
    {
      status
    }
  );
}

// 실패 JSON 응답을 만든다.
export function jsonFail<E>(error: E, status = 400): NextResponse<ApiFailure<E>> {
  return NextResponse.json(
    {
      ok: false,
      error
    },
    {
      status
    }
  );
}

11.2 Route Handler 예시

// src/app/api/users/route.ts

import { createUser } from '@/features/users/user-service';
import { jsonFail, jsonOk } from '@/shared/http';

// 사용자 생성 API이다.
// Route Handler는 요청 파싱과 HTTP 응답 변환만 담당한다.
export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json();

  if (!isCreateUserRequestBody(body)) {
    return jsonFail(
      {
        code: 'invalid_request',
        message: 'request body is invalid'
      },
      400
    );
  }

  const [user, createUserError] = createUser({
    name: body.name,
    email: body.email
  });

  if (createUserError !== null) {
    return jsonFail(createUserError, 400);
  }

  return jsonOk(user, 201);
}

// 사용자 생성 요청 본문인지 확인한다.
// 외부 입력은 반드시 unknown으로 받은 뒤 검증한다.
function isCreateUserRequestBody(value: unknown): value is {
  readonly name: string;
  readonly email: string;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.name === 'string' && typeof record.email === 'string';
}

12. 데이터 접근 함수 작성 규칙

데이터 접근 함수도 GoResult를 반환한다. 데이터베이스 오류를 그대로 노출하지 말고 도메인 에러로 변환한다.

// src/features/users/user-repository.ts

import { fail, GoResult, ok } from '@/shared/result';
import { User, UserId } from './user-model';
import { UserError } from './user-errors';

// 예시용 메모리 저장소이다.
// 실제 프로젝트에서는 DB 클라이언트나 ORM을 사용한다.
const users = new Map<UserId, User>();

// ID로 사용자를 조회한다.
// 사용자가 없거나 저장소 조회에 실패할 수 있으므로 GoResult를 반환한다.
export async function findUserById(
  id: UserId
): Promise<GoResult<User, UserError>> {
  const user = users.get(id);

  if (user === undefined) {
    return fail({
      code: 'user_not_found',
      message: 'user not found'
    });
  }

  return ok(user);
}

// 사용자를 저장한다.
// 저장 실패 가능성을 표현하기 위해 GoResult를 반환한다.
export async function saveUser(user: User): Promise<GoResult<User, UserError>> {
  users.set(user.id, user);

  return ok(user);
}

13. try/catch 사용 규칙

13.1 예상 가능한 실패에는 try/catch를 사용하지 않는다

다음 상황은 try/catch로 처리하지 않는다.

- 입력값이 잘못됨
- 사용자가 없음
- 권한이 없음
- 로그인 실패
- 중복 데이터
- 외부 API의 정상적인 실패 응답

이런 실패는 GoResult로 반환한다.

13.2 외부 라이브러리 경계에서는 try/catch를 사용할 수 있다

DB 클라이언트, 외부 API SDK, 파일 시스템 등 예외를 던지는 라이브러리 경계에서는 try/catch를 사용한다.

단, catch한 예외는 즉시 프로젝트의 에러 타입으로 변환한다.

// src/features/users/user-db-repository.ts

import { fail, GoResult, ok } from '@/shared/result';
import { User, UserId } from './user-model';
import { UserError } from './user-errors';

// DB 클라이언트를 표현하는 최소 타입이다.
// 실제 프로젝트에서는 Prisma, Drizzle, Kysely 등 사용하는 도구에 맞게 바꾼다.
type DbClient = {
  readonly user: {
    readonly findUnique: (args: {
      readonly where: {
        readonly id: string;
      };
    }) => Promise<User | null>;
  };
};

// DB에서 사용자를 조회한다.
// DB 클라이언트가 예외를 던질 수 있으므로 경계에서만 try/catch를 사용한다.
export async function findUserByIdFromDb(
  db: DbClient,
  id: UserId
): Promise<GoResult<User, UserError>> {
  try {
    const user = await db.user.findUnique({
      where: {
        id
      }
    });

    if (user === null) {
      return fail({
        code: 'user_not_found',
        message: 'user not found'
      });
    }

    return ok(user);
  } catch {
    return fail({
      code: 'database_failed',
      message: 'database failed'
    });
  }
}

14. 인터페이스 작성 규칙

인터페이스는 구현체가 아니라 사용하는 쪽에서 작게 정의한다.

// src/features/users/get-user-profile.ts

import { fail, GoResult, ok } from '@/shared/result';
import { User, UserId } from './user-model';
import { UserError } from './user-errors';

// 이 함수가 실제로 필요한 저장소 기능만 정의한다.
type UserFinder = {
  readonly findById: (id: UserId) => Promise<GoResult<User, UserError>>;
};

// 사용자 프로필을 조회한다.
// 필요한 의존성은 작은 인터페이스로 받는다.
export async function getUserProfile(
  userFinder: UserFinder,
  userId: UserId
): Promise<GoResult<User, UserError>> {
  const [user, findUserError] = await userFinder.findById(userId);

  if (findUserError !== null) {
    return fail(findUserError);
  }

  return ok(user);
}

큰 범용 인터페이스는 피한다.

// 필요 이상으로 큰 범용 저장소 인터페이스는 피한다.
type Repository<T, ID, E> = {
  readonly findById: (id: ID) => Promise<GoResult<T, E>>;
  readonly findMany: () => Promise<GoResult<readonly T[], E>>;
  readonly save: (value: T) => Promise<GoResult<T, E>>;
  readonly delete: (id: ID) => Promise<GoResult<void, E>>;
};

15. 컴포넌트 작성 규칙

15.1 Server Component를 기본으로 한다

상태, 이벤트 핸들러, 브라우저 API가 필요하지 않으면 Client Component로 만들지 않는다.

// src/app/users/user-card.tsx

import { User } from '@/features/users/user-model';

// 사용자 정보를 표시하는 단순 컴포넌트이다.
// 상호작용이 없으므로 Server Component로 둔다.
export function UserCard(props: { readonly user: User }): React.JSX.Element {
  return (
    <article>
      <h2>{props.user.name}</h2>
      <p>{props.user.email}</p>
    </article>
  );
}

15.2 Client Component는 작게 유지한다

Client Component는 브라우저 상호작용이 필요한 부분에만 사용한다.

// src/app/users/user-search-input.tsx

'use client';

import { useState } from 'react';

// 사용자 검색 입력 컴포넌트이다.
// 입력 상태가 필요하므로 Client Component로 작성한다.
export function UserSearchInput(): React.JSX.Element {
  const [keyword, setKeyword] = useState('');

  return (
    <input
      type="search"
      value={keyword}
      onChange={(event) => {
        setKeyword(event.target.value);
      }}
      placeholder="Search users"
    />
  );
}

16. 피해야 할 패턴

16.1 비즈니스 실패에 throw 사용 금지

// 예상 가능한 입력 오류에 throw를 사용하지 않는다.
export function createUserBad(input: {
  readonly name: string;
  readonly email: string;
}): {
  readonly id: string;
  readonly name: string;
  readonly email: string;
} {
  if (input.name.trim().length === 0) {
    throw new Error('name is empty');
  }

  return {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email
  };
}

대신 다음처럼 작성한다.

// 예상 가능한 입력 오류는 GoResult로 반환한다.
export function createUserGood(input: {
  readonly name: string;
  readonly email: string;
}): GoResult<
  {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  },
  {
    readonly code: 'empty_name';
    readonly message: string;
  }
> {
  if (input.name.trim().length === 0) {
    return fail({
      code: 'empty_name',
      message: 'name is empty'
    });
  }

  return ok({
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email
  });
}

16.2 Client Component에 도메인 로직 작성 금지

// Client Component 안에 도메인 로직을 직접 작성하지 않는다.
'use client';

export function BadForm(): React.JSX.Element {
  async function handleSubmit(): Promise<void> {
    // 검증, 저장, 권한 확인 같은 로직을 여기에 넣지 않는다.
  }

  return <button onClick={handleSubmit}>Submit</button>;
}

16.3 Route Handler에 비즈니스 로직 집중 금지

// Route Handler에 모든 로직을 몰아넣지 않는다.
export async function POST(request: Request): Promise<Response> {
  const body = await request.json();

  // 검증, 도메인 처리, 저장, 응답 생성을 모두 한 파일에 몰아넣지 않는다.

  return Response.json({
    ok: true
  });
}

Route Handler는 HTTP 경계만 담당하고, 실제 로직은 features 아래 서비스 함수로 분리한다.

17. 리뷰 체크리스트

코드 리뷰에서는 다음을 확인한다.

- 예상 가능한 실패에 "throw"를 사용하지 않았는가?
- GoResult 반환값을 호출 직후 확인했는가?
- 실패 조건을 먼저 반환해 중첩을 줄였는가?
- Server Action은 UI에서 쓰기 쉬운 상태를 반환하는가?
- Route Handler는 서비스 결과를 HTTP 응답으로만 변환하는가?
- Client Component에 도메인 로직이 들어가지 않았는가?
- Server Component를 기본으로 사용했는가?
- 인터페이스가 필요한 곳에서 작게 정의되었는가?
- "redirect()"와 "notFound()"를 일반 에러 처리와 섞지 않았는가?
- 외부 라이브러리 예외를 프로젝트 에러 타입으로 변환했는가?

18. 요약

이 프로젝트의 Next.js TypeScript 코드는 Go의 단순함을 따른다.

- 서비스 함수는 "GoResult<T, E>"를 반환한다.
- 예상 가능한 실패는 예외가 아니라 값으로 처리한다.
- 에러는 호출 직후 확인한다.
- 실패 조건은 먼저 반환한다.
- Server Action은 UI 상태를 반환한다.
- Route Handler는 GoResult를 HTTP 응답으로 변환한다.
- Server Component는 데이터 조회와 화면 구성을 담당한다.
- Client Component는 상호작용만 담당한다.
- "redirect()"와 "notFound()"는 Next.js 제어 흐름으로만 사용한다.
- 과한 체이닝, 과한 제네릭, 과한 추상화를 피한다.

좋은 코드는 똑똑해 보이는 코드가 아니라, 다음 사람이 빠르게 이해하고 안전하게 수정할 수 있는 코드이다.
