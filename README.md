# UNIDorm 포털 연동 도우미 (Chrome Extension)

PC Chrome / Edge 브라우저에서 [UNIDorm](https://unidorm.inuappcenter.kr) 웹을 사용할 때, 인천대학교 포털·ERP 학적 및 생활원 사생 정보를 로컬 브라우저 세션으로 조회할 수 있게 연결해 주는 확장 프로그램입니다.

포털 계정 정보와 조회 데이터는 사용자 브라우저 내부에서만 처리되며 외부 서버로 전송되지 않습니다.

---

## 설치 방법 (GitHub Releases ZIP)

1. 이 저장소의 **Releases** 탭에서 최신 `unidorm-chrome-extension-v*.zip` 파일을 내려받습니다.
2. 내려받은 ZIP 파일의 압축을 원하는 폴더에 풉니다. (예: `Documents/unidorm-chrome-extension`)
   - 압축을 푼 폴더는 확장 프로그램이 계속 참조하므로 삭제하지 마십시오.
3. Chrome 주소창에 `chrome://extensions`를 입력해 확장 프로그램 관리 페이지를 엽니다.
4. 우측 상단의 **개발자 모드** 스위치를 켭니다.
5. 좌측 상단의 **압축해제된 확장 프로그램을 로드합니다** 버튼을 클릭하고, 2단계에서 압축을 푼 폴더(`manifest.json`이 있는 폴더)를 선택합니다.
6. 목록에 **UNIDorm 포털 연동 도우미**가 활성화되면 UNIDorm 웹 페이지를 새로고침합니다.

## 업데이트 방법

1. 새 버전의 `unidorm-chrome-extension-v*.zip`을 내려받아 기존에 압축을 풀었던 폴더에 덮어씁니다.
2. `chrome://extensions`에서 **UNIDorm 포털 연동 도우미**의 **새로고침(↻)** 버튼을 클릭합니다.

## 사용 방법

- **방법 1 (기존 포털 로그인 세션 재사용)**: 브라우저에서 인천대 포털에 로그인해 둔 상태라면, UNIDorm 웹에서 바로 사생정보·학적 정보를 조회할 수 있습니다.
- **방법 2 (세션 자격증명 입력)**: UNIDorm 웹의 `마이페이지 > 포털 계정 관리` 또는 사생증 온보딩에서 학번/비밀번호를 입력하면 브라우저 메모리(`chrome.storage.session`)에만 임시 보관되며 브라우저 종료 시 자동 삭제됩니다.
- 확장 아이콘을 클릭하면 현재 연동 상태 확인, 포털 로그인 페이지 열기, 저장된 세션 자격증명 삭제가 가능합니다.

---

## 개발 및 릴리즈 패키징

```bash
# 의존성 설치
npm install

# 개발용 빌드 (localhost:5173 매칭 및 sourcemap 포함)
npm run build

# 배포용 ZIP 생성 (localhost 및 sourcemap 제외 -> release/unidorm-chrome-extension-v<version>.zip)
npm run package:store

# 타입체크 및 테스트
npm run typecheck
npm run test
```
