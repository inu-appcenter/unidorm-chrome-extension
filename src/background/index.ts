import {
  classifyPortalError,
  createAgentActionExecutor,
  PORTAL_LOGIN_URL,
  type AgentBridgeResponse,
  type ClientActionInstruction,
} from "@inu-appcenter/unidorm-portal-helper";
import {
  ChromePortalDriver,
  hasActivePortalBrowserSession,
} from "./chromePortalDriver";
import { ChromeSessionCredentialStore } from "./credentialStore";

const portalDriver = new ChromePortalDriver();
const executeAgentAction = createAgentActionExecutor({
  driver: portalDriver,
  credentialStore: ChromeSessionCredentialStore,
  allowSessionOnlyPortalAuth: true,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 UNIDorm-Extension",
});

interface IncomingExtensionMessage {
  type: string;
  requestId?: string;
  payload?: any;
}

async function handleExtensionMessage(
  msg: IncomingExtensionMessage,
): Promise<AgentBridgeResponse> {
  const { type, payload, requestId } = msg;
  const wrap = (res: AgentBridgeResponse): AgentBridgeResponse => ({
    ...res,
    ...(requestId ? { requestId } : {}),
  });

  switch (type) {
    case "checkPortalAccount": {
      const creds = await ChromeSessionCredentialStore.getCredentials();
      const hasBrowserSession = await hasActivePortalBrowserSession();
      const studentId =
        creds?.studentId ||
        (await ChromeSessionCredentialStore.getLastKnownStudentId());

      return wrap({
        type: "checkPortalAccountResult",
        success: true,
        data: {
          linked: Boolean(creds?.studentId || hasBrowserSession),
          studentId,
          authMode: creds?.studentId
            ? "session_credentials"
            : hasBrowserSession
              ? "browser_cookie"
              : "none",
        },
      });
    }

    case "savePortalAccount": {
      try {
        const { studentId, password } = payload || {};
        await ChromeSessionCredentialStore.saveCredentials({
          studentId,
          password,
        });
        return wrap({
          type: "savePortalAccountResult",
          success: true,
          data: { linked: true },
        });
      } catch (err: unknown) {
        return wrap({
          type: "savePortalAccountResult",
          success: false,
          errorMessage:
            err instanceof Error ? err.message : "포털 계정 저장 실패",
        });
      }
    }

    case "deletePortalAccount": {
      try {
        await ChromeSessionCredentialStore.clearCredentials();
        return wrap({
          type: "deletePortalAccountResult",
          success: true,
          data: { linked: false },
        });
      } catch (err: unknown) {
        return wrap({
          type: "deletePortalAccountResult",
          success: false,
          errorMessage:
            err instanceof Error ? err.message : "포털 계정 삭제 실패",
        });
      }
    }

    case "fetchAcademicInfo": {
      try {
        const creds = await ChromeSessionCredentialStore.getCredentials();
        const hasSession = await hasActivePortalBrowserSession();
        if (!creds && !hasSession) {
          return wrap({
            type: "fetchAcademicInfoResult",
            success: false,
            errorCode: "NO_CREDENTIALS",
            errorMessage: "포털 계정 연동 또는 포털 로그인이 필요합니다.",
          });
        }

        const rawSsv = await portalDriver.executeErpAction({
          creds,
          actionId: "PORTAL_GET_ACADEMIC_RECORD",
        });

        return wrap({
          type: "fetchAcademicInfoResult",
          success: true,
          data: { rawSsv },
        });
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "학적 정보 조회 중 오류가 발생했습니다.";
        return wrap({
          type: "fetchAcademicInfoResult",
          success: false,
          errorCode: classifyPortalError(errorMessage),
          errorMessage,
        });
      }
    }

    case "executeAgentAction": {
      try {
        const instruction = payload?.instruction as
          | ClientActionInstruction
          | undefined;
        if (!instruction) {
          throw new Error("instruction 파라미터가 누락되었습니다.");
        }
        const actionResult = await executeAgentAction(instruction);
        return wrap({
          type: "executeAgentActionResult",
          success: actionResult.success,
          data:
            actionResult.data !== undefined ? actionResult.data : actionResult,
          errorCode: actionResult.errorCode,
          errorMessage: actionResult.errorMessage,
        });
      } catch (err: unknown) {
        return wrap({
          type: "executeAgentActionResult",
          success: false,
          errorCode: "EXECUTION_ERROR",
          errorMessage:
            err instanceof Error ? err.message : "액션 실행 중 오류 발생",
        });
      }
    }

    case "getExtensionStatus": {
      const creds = await ChromeSessionCredentialStore.getCredentials();
      const hasBrowserSession = await hasActivePortalBrowserSession();
      const studentId =
        creds?.studentId ||
        (await ChromeSessionCredentialStore.getLastKnownStudentId());
      return wrap({
        type: "getExtensionStatusResult",
        success: true,
        data: {
          linked: Boolean(creds?.studentId || hasBrowserSession),
          hasCredentials: Boolean(creds?.studentId),
          hasBrowserSession,
          studentId,
        },
      });
    }

    case "openPortalLoginTab": {
      await chrome.tabs.create({ url: PORTAL_LOGIN_URL, active: true });
      return wrap({
        type: "openPortalLoginTabResult",
        success: true,
      });
    }

    default:
      return wrap({
        type: `${type}Result`,
        success: false,
        errorCode: "UNSUPPORTED_ACTION",
        errorMessage: `지원하지 않는 에이전트 액션입니다: ${type}`,
      });
  }
}

chrome.runtime.onMessage.addListener(
  (message: IncomingExtensionMessage, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") {
      return false;
    }

    handleExtensionMessage(message)
      .then((response) => sendResponse(response))
      .catch((err) => {
        sendResponse({
          type: `${message.type}Result`,
          requestId: message.requestId,
          success: false,
          errorCode: "UNHANDLED_ERROR",
          errorMessage:
            err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
        });
      });

    // 비동기 sendResponse를 위해 true 반환
    return true;
  },
);
