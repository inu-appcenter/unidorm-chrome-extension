import { EXTENSION_BRIDGE_CHANNEL } from "@inu-appcenter/unidorm-portal-helper";

interface WebToExtMessage {
  channel: typeof EXTENSION_BRIDGE_CHANNEL;
  direction: "web-to-ext";
  type: string;
  requestId?: string;
  payload?: unknown;
}

function markExtensionReady(): void {
  const root = document.documentElement;
  if (root) {
    root.dataset.unidormExtension = "1";
    root.dataset.unidormExtensionVersion = chrome.runtime.getManifest().version;
  }
  window.dispatchEvent(
    new CustomEvent("unidormExtensionReady", {
      detail: {
        version: chrome.runtime.getManifest().version,
      },
    }),
  );
}

// document_start 시점에 즉시 마킹하고 DOMContentLoaded 시 한 번 더 알림
markExtensionReady();
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", markExtensionReady, { once: true });
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;

  const data = event.data as Partial<WebToExtMessage> | null;
  if (
    !data ||
    typeof data !== "object" ||
    data.channel !== EXTENSION_BRIDGE_CHANNEL ||
    data.direction !== "web-to-ext" ||
    typeof data.type !== "string"
  ) {
    return;
  }

  // Ping 요청은 Service Worker를 깨우지 않고 즉시 응답
  if (data.type === "ping") {
    window.postMessage(
      {
        channel: EXTENSION_BRIDGE_CHANNEL,
        direction: "ext-to-web",
        type: "pingResult",
        requestId: data.requestId,
        success: true,
        data: {
          installed: true,
          version: chrome.runtime.getManifest().version,
        },
      },
      window.location.origin,
    );
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: data.type,
      requestId: data.requestId,
      payload: data.payload,
    },
    (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        window.postMessage(
          {
            channel: EXTENSION_BRIDGE_CHANNEL,
            direction: "ext-to-web",
            type: `${data.type}Result`,
            requestId: data.requestId,
            success: false,
            errorCode: "EXTENSION_RUNTIME_ERROR",
            errorMessage:
              runtimeError.message || "확장 프로그램 통신 중 오류가 발생했습니다.",
          },
          window.location.origin,
        );
        return;
      }

      window.postMessage(
        {
          channel: EXTENSION_BRIDGE_CHANNEL,
          direction: "ext-to-web",
          ...(response || {
            type: `${data.type}Result`,
            success: false,
            errorCode: "EMPTY_RESPONSE",
            errorMessage: "확장 프로그램으로부터 응답을 받지 못했습니다.",
          }),
          ...(data.requestId ? { requestId: data.requestId } : {}),
        },
        window.location.origin,
      );
    },
  );
});
