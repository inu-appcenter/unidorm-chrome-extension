# Chrome Web Store 제출 가이드 (UNIDorm 포털 연동 도우미)

이 문서는 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)에 확장 프로그램을 업로드할 때 입력하는 항목을 그대로 복사해 사용할 수 있도록 정리한 가이드입니다.

---

## 1. 업로드 파일 생성

```bash
npm run package:store
```

생성된 파일: `release/unidorm-chrome-extension-v1.0.0.zip`
- `localhost` 개발 도메인 및 `.map` 소스맵 파일이 자동 제외되어 있습니다.

---

## 2. 스토어 등록정보 (Store Listing)

- **확장 프로그램 이름**: `UNIDorm 포털 연동 도우미`
- **요약 (Summary, 132자 이내)**:
  > PC 브라우저의 UNIDorm 웹에서 인천대학교 포털·ERP 학적 및 기숙사 정보를 로컬 브라우저 세션으로 조회할 수 있게 연결합니다.
- **상세 설명 (Description)**:
  ```text
  UNIDorm 포털 연동 도우미는 인천대학교 생활원 커뮤니티 서비스 UNIDorm(유니돔)을 PC 브라우저에서 이용할 때, 인천대학교 포털 및 ERP 시스템의 학적·기숙사 사생 정보를 사용자 브라우저 내부에서 직접 조회해 UNIDorm 화면에 표시해 주는 공식 연동 확장 프로그램입니다.

  [주요 기능]
  - 인천대학교 포털 및 생활원 ERP 사생정보(호실, 상벌점, 입퇴사, 납부내역 등) 로컬 조회
  - 기본 학적 정보 및 시간표 로컬 조회
  - 기존 브라우저 포털 로그인 세션 재사용 및 메모리 전용 세션(chrome.storage.session) 관리

  [개인정보 및 보안]
  - 포털 학번, 비밀번호 및 조회된 학적·사생 원본 데이터는 사용자의 브라우저 내부에서만 처리되며, UNIDorm 서버나 외부 제3자 서버로 전송·저장되지 않습니다.
  - 세션에 임시 보관된 자격증명은 브라우저 종료 시 자동으로 삭제되며, 확장 팝업에서 언제든 직접 삭제할 수 있습니다.
  ```
- **카테고리**: `도구 (Tools)` 또는 `생산성 (Productivity)`
- **언어**: `한국어`
- **아이콘**: `public/icons/icon128.png` (128×128)
- **스크린샷 (권장 1280×800 PNG 1~2장)**:
  1. `unidorm.inuappcenter.kr`에서 사생정보조회 또는 포털 계정 관리 화면이 연동된 모습
  2. 브라우저 우측 상단 확장 팝업(`연동 상태 / 학번 / 포털 브라우저 세션`) 화면

---

## 3. 개인정보 보호 및 권한 사유 (Privacy Practices)

### 단일 목적 (Single Purpose)
```text
Enables authenticated UNIDorm web users to fetch their own Incheon National University (INU) portal and dormitory ERP records directly within their local browser session without sending portal credentials to any external server.
```

### 권한별 사용 사유 (Permission Justifications)

| 권한 | 심사 제출용 사유 (복사해서 붙여넣기) |
| :--- | :--- |
| **`tabs`** | Opens a temporary inactive background tab to perform Incheon National University portal login/ERP session handoff and closes it immediately once data retrieval completes. |
| **`webNavigation`** | Detects navigation completion between INU portal login (`portal.inu.ac.kr`) and HTTPS ERP document (`erp.inu.ac.kr:8443`) within the temporary background tab only. |
| **`scripting`** | Executes bundled, static in-page scripts on `portal.inu.ac.kr` and `erp.inu.ac.kr:8443` to submit the user's login form (when requested) and invoke official INU ERP Nexacro SSV endpoints in the authenticated page context. |
| **`cookies`** | Checks whether the user already has an active INU portal/ERP browser session so existing sessions can be reused without re-entering credentials. |
| **`storage`** | Uses memory-only `chrome.storage.session` to temporarily hold portal session credentials during the current browser session; credentials are never written to sync storage or sent to external servers and are automatically cleared when the browser closes. |
| **`host_permissions`** (`*.inu.ac.kr`) | Required to perform SSO ticket exchange and direct Nexacro SSV queries against official Incheon National University servers (`portal.inu.ac.kr`, `erp.inu.ac.kr`, `lms.inu.ac.kr`) from the local browser. |

### 원격 코드 사용 여부 (Remote Code)
- **아니요, 원격으로 호스팅되는 코드를 사용하지 않습니다 (No, I am not using remote code).**
- 모든 로그인·조회 스크립트는 빌드 시 `background.js`와 `content.js` 번들 내부에 정적으로 포함됩니다.

### 데이터 사용 공개 (Data Usage)
- 데이터 수집 여부: **외부 서버로 사용자 데이터를 수집하거나 전송하지 않음** (모든 포털 인증 및 ERP 응답 파싱은 사용자 브라우저 로컬에서 완결).
- 개인정보 처리방침 URL: UNIDorm 공식 개인정보 처리방침 URL 입력.
