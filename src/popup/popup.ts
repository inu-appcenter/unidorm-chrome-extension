async function refreshStatus(): Promise<void> {
  const linkedEl = document.getElementById("status-linked");
  const sidEl = document.getElementById("status-student-id");
  const cookieEl = document.getElementById("status-cookie");

  try {
    const res = await chrome.runtime.sendMessage({ type: "getExtensionStatus" });
    const data = res?.data || {};
    if (linkedEl) {
      linkedEl.textContent = data.linked ? "연동됨" : "미연동";
    }
    if (sidEl) {
      sidEl.textContent = data.studentId || "-";
    }
    if (cookieEl) {
      cookieEl.textContent = data.hasBrowserSession ? "활성" : "없음";
    }
  } catch {
    if (linkedEl) linkedEl.textContent = "상태 조회 실패";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void refreshStatus();

  const openPortalBtn = document.getElementById("btn-open-portal");
  const clearBtn = document.getElementById("btn-clear-session");
  const feedbackEl = document.getElementById("feedback");

  openPortalBtn?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "openPortalLoginTab" });
  });

  clearBtn?.addEventListener("click", async () => {
    const res = await chrome.runtime.sendMessage({ type: "deletePortalAccount" });
    if (feedbackEl) {
      feedbackEl.textContent = res?.success
        ? "저장된 세션 자격증명을 삭제했습니다."
        : "삭제 중 오류가 발생했습니다.";
    }
    await refreshStatus();
  });
});
