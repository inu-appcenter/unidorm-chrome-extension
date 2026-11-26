import {
  captureErpSessionMetadataInPage,
  ERP_HTTPS_ORIGIN,
  executeErpQueryInPage,
  isAllowedScraperUrl,
  isHttpsErpDocument,
  isPortalLoginAlertMessage,
  isPortalLoginUrl,
  isPortalReadyUrl,
  PORTAL_LOGIN_URL,
  readPortalStudentIdInPage,
  SCRAPE_TIMEOUT_MS,
  submitPortalLoginInPage,
  type ErpActionOptions,
  type ErpQueryExecutionResult,
  type PortalDriver,
} from "@inu-appcenter/unidorm-portal-helper";
import { ChromeSessionCredentialStore } from "./credentialStore";

const ERP_HTTPS_SSO_URL = `${ERP_HTTPS_ORIGIN}/com/SsoCtr/initPageWork.do?loginGbn=sso`;

type ScrapeStep = "LOGIN" | "ERP_REDIRECT" | "ERP_QUERY";

/**
 * 인천대 포털 또는 ERP 브라우저 쿠키 세션이 활성 상태인지 확인합니다.
 */
export async function hasActivePortalBrowserSession(): Promise<boolean> {
  try {
    const [portalCookies, erpCookies] = await Promise.all([
      chrome.cookies.getAll({ domain: "portal.inu.ac.kr" }),
      chrome.cookies.getAll({ domain: "erp.inu.ac.kr" }),
    ]);
    const hasPortal = portalCookies.some(
      (c) =>
        c.name.toUpperCase().includes("JSESSIONID") ||
        c.name.toUpperCase().includes("ENVIEW") ||
        c.name.toUpperCase().includes("SSO"),
    );
    const hasErp = erpCookies.some(
      (c) =>
        c.name.toUpperCase().includes("JSESSIONID") ||
        c.name.toUpperCase().includes("WMONID"),
    );
    return hasPortal || hasErp;
  } catch {
    return false;
  }
}

/**
 * Service Worker 백그라운드 fetch로 ERP SSO 리다이렉트 체인
 * (erp.inu.ac.kr:8443 -> http://portal.inu.ac.kr:7780/enpass/login -> erp.inu.ac.kr:8443)을
 * 탭 네비게이션 없이 완료합니다.
 *
 * Chrome의 HTTPS-First Mode("이 사이트는 보안 연결을 지원하지 않습니다") 경고는
 * 탭이 평문 HTTP(7780/8881)로 이동할 때만 뜨므로, SSO 교환을 Service Worker fetch로 처리하면
 * 탭은 오직 HTTPS 문서(portal:444, erp:8443)만 방문하게 됩니다.
 */
async function establishErpSessionViaFetch(): Promise<{
  authenticated: boolean;
  finalUrl: string;
}> {
  try {
    const res = await fetch(ERP_HTTPS_SSO_URL, {
      method: "GET",
      credentials: "include",
      redirect: "follow",
    });
    const finalUrl = res.url || ERP_HTTPS_SSO_URL;
    const isUnauthenticated =
      finalUrl.includes("epTicket=LOG") ||
      isPortalLoginUrl(finalUrl) ||
      finalUrl.includes("/enpass/login");

    if (!isUnauthenticated && isHttpsErpDocument(finalUrl)) {
      return { authenticated: true, finalUrl };
    }
    return { authenticated: false, finalUrl };
  } catch {
    return { authenticated: false, finalUrl: ERP_HTTPS_SSO_URL };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readLastPortalAlert(tabId: number): Promise<string> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        const win = window as unknown as Record<string, unknown>;
        return typeof win.__unidormPortalLastAlert === "string"
          ? win.__unidormPortalLastAlert
          : "";
      },
    });
    return String(results[0]?.result || "");
  } catch {
    return "";
  }
}

/**
 * Chrome Extension MV3용 포털/ERP 스크레이퍼 드라이버.
 *
 * 1. Service Worker fetch로 HTTPS ERP SSO 세션을 먼저 시도합니다(평문 HTTP 탭 이동 차단).
 * 2. 미로그인 상태이면 HTTPS 포털 로그인 페이지(portal.inu.ac.kr:444)에서 로그인한 뒤,
 *    다시 Service Worker fetch로 7780 SSO 티켓 교환을 완료하고 HTTPS ERP 문서로 이동합니다.
 * 3. erp.inu.ac.kr:8443 도달 시 @unidorm/portal-agent-core의 executeErpQueryInPage를 MAIN world에서 실행합니다.
 */
export class ChromePortalDriver implements PortalDriver {
  private inflightPromise: Promise<string> | null = null;
  private inflightKey: string | null = null;

  async executeErpAction(options: ErpActionOptions): Promise<string> {
    const dedupeKey = `${options.creds?.studentId || "session"}:${options.actionId || "DEFAULT"}`;
    if (this.inflightPromise && this.inflightKey === dedupeKey) {
      return this.inflightPromise;
    }

    const promise = this.runScrape(options).finally(() => {
      if (this.inflightPromise === promise) {
        this.inflightPromise = null;
        this.inflightKey = null;
      }
    });

    this.inflightPromise = promise;
    this.inflightKey = dedupeKey;
    return promise;
  }

  private async runScrape(options: ErpActionOptions): Promise<string> {
    const preflight = await establishErpSessionViaFetch();
    const initialUrl = preflight.authenticated
      ? preflight.finalUrl
      : PORTAL_LOGIN_URL;
    let step: ScrapeStep = preflight.authenticated ? "ERP_REDIRECT" : "LOGIN";
    let loginInjected = false;
    let resolvedStudentId =
      options.creds?.studentId ||
      (await ChromeSessionCredentialStore.getLastKnownStudentId());

    const tab = await chrome.tabs.create({
      url: initialUrl,
      active: false,
    });

    const tabId = tab.id;
    if (tabId === undefined) {
      throw new Error("백그라운드 포털 조회 탭을 생성하지 못했습니다.");
    }

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      let alertPollTimer: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (alertPollTimer) {
          clearInterval(alertPollTimer);
          alertPollTimer = null;
        }
        chrome.webNavigation.onCommitted.removeListener(onCommitted);
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
        chrome.tabs.onRemoved.removeListener(onTabRemoved);
        chrome.tabs.remove(tabId).catch(() => {});
      };

      const finishResolve = (data: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(data);
      };

      const finishReject = (err: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };

      const timeoutTimer = setTimeout(() => {
        finishReject(new Error("포털 ERP 정보 조회 시간 초과 (35초)"));
      }, SCRAPE_TIMEOUT_MS);

      const onTabRemoved = (removedTabId: number) => {
        if (removedTabId === tabId && !settled) {
          finishReject(new Error("포털 조회 탭이 예기치 않게 닫혔습니다."));
        }
      };

      const onCommitted = (
        details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
      ) => {
        if (details.tabId !== tabId || details.frameId !== 0 || settled) return;
        if (!isAllowedScraperUrl(details.url)) {
          finishReject(new Error("허가되지 않은 외부 도메인으로 리다이렉트되었습니다."));
          return;
        }

        if (isHttpsErpDocument(details.url)) {
          chrome.scripting
            .executeScript({
              target: { tabId },
              world: "MAIN",
              func: captureErpSessionMetadataInPage,
            })
            .catch(() => {});
        }
      };

      const onCompleted = async (
        details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
      ) => {
        if (details.tabId !== tabId || details.frameId !== 0 || settled) return;
        const url = details.url;

        if (!isAllowedScraperUrl(url)) {
          finishReject(new Error("허가되지 않은 외부 도메인으로 이동했습니다."));
          return;
        }

        // 포털 로그인 페이지 도달
        if (isPortalLoginUrl(url)) {
          step = "LOGIN";
          if (!options.creds) {
            finishReject(
              new Error(
                "포털 로그인이 필요합니다. 인천대 포털에 로그인하거나 포털 계정을 연동해 주세요.",
              ),
            );
            return;
          }
          if (loginInjected) return;
          loginInjected = true;

          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              world: "MAIN",
              func: submitPortalLoginInPage,
              args: [options.creds.studentId, options.creds.password],
            });

            alertPollTimer = setInterval(async () => {
              if (settled || step !== "LOGIN") return;
              const alertText = await readLastPortalAlert(tabId);
              if (alertText && isPortalLoginAlertMessage(alertText)) {
                finishReject(
                  new Error(alertText || "포털 로그인에 실패했습니다."),
                );
              }
            }, 500);
          } catch (err) {
            finishReject(
              err instanceof Error
                ? err
                : new Error("포털 로그인 스크립트 주입 실패"),
            );
          }
          return;
        }

        // 포털 로그인 완료 -> Service Worker fetch로 7780 SSO 교환 후 HTTPS ERP로 이동
        if (step === "LOGIN" && isPortalReadyUrl(url)) {
          if (alertPollTimer) {
            clearInterval(alertPollTimer);
            alertPollTimer = null;
          }
          try {
            const sidResults = await chrome.scripting.executeScript({
              target: { tabId },
              world: "MAIN",
              func: readPortalStudentIdInPage,
            });
            const detectedSid = String(sidResults[0]?.result || "").trim();
            if (detectedSid) {
              resolvedStudentId = detectedSid;
              await ChromeSessionCredentialStore.setLastKnownStudentId(
                detectedSid,
              );
            }
          } catch {
            // 학번 추출 실패 시 기존 학번 유지
          }

          step = "ERP_REDIRECT";
          const ssoResult = await establishErpSessionViaFetch();
          if (settled) return;

          await chrome.tabs.update(tabId, {
            url: ssoResult.authenticated ? ssoResult.finalUrl : ERP_HTTPS_SSO_URL,
          });
          return;
        }

        // HTTPS ERP 문서 도달 -> SSV 조회 실행
        if (step === "ERP_REDIRECT" && isHttpsErpDocument(url)) {
          step = "ERP_QUERY";
          await delay(1500);
          if (settled) return;

          try {
            const execResults = await chrome.scripting.executeScript({
              target: { tabId },
              world: "MAIN",
              func: executeErpQueryInPage,
              args: [
                {
                  actionId: options.actionId || "PORTAL_GET_ACADEMIC_RECORD",
                  studentId: resolvedStudentId,
                  target: options.target || {},
                },
              ],
            });

            const queryResult = execResults[0]?.result as
              | ErpQueryExecutionResult
              | undefined;
            if (queryResult?.ok) {
              finishResolve(queryResult.data);
            } else {
              finishReject(
                new Error(queryResult?.message || "ERP 조회 중 오류가 발생했습니다."),
              );
            }
          } catch (err) {
            finishReject(
              err instanceof Error ? err : new Error("ERP 조회 스크립트 실행 실패"),
            );
          }
        }
      };

      chrome.webNavigation.onCommitted.addListener(onCommitted);
      chrome.webNavigation.onCompleted.addListener(onCompleted);
      chrome.tabs.onRemoved.addListener(onTabRemoved);
    });
  }
}
