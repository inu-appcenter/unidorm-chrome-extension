import type {
  CredentialStore,
  PortalCredentials,
} from "@inu-appcenter/unidorm-portal-helper";

const SESSION_KEY_PORTAL_CREDS = "unidorm_ext_portal_creds";
const SESSION_KEY_LAST_STUDENT_ID = "unidorm_ext_last_student_id";

/**
 * Chrome Extension MV3용 자격증명 저장소.
 * 디스크 평문 저장을 피하기 위해 브라우저 메모리 전용인 chrome.storage.session만 사용합니다.
 * 브라우저가 종료되면 자격증명은 자동으로 소멸합니다.
 */
export const ChromeSessionCredentialStore: CredentialStore & {
  getLastKnownStudentId(): Promise<string>;
  setLastKnownStudentId(studentId: string): Promise<void>;
} = {
  async getCredentials(): Promise<PortalCredentials | null> {
    const result = await chrome.storage.session.get(SESSION_KEY_PORTAL_CREDS);
    const creds = result[SESSION_KEY_PORTAL_CREDS] as
      | Partial<PortalCredentials>
      | undefined;
    if (!creds?.studentId || !creds?.password) {
      return null;
    }
    return {
      studentId: creds.studentId,
      password: creds.password,
    };
  },

  async saveCredentials(creds: PortalCredentials): Promise<void> {
    const studentId = creds.studentId?.trim();
    const password = creds.password?.trim();
    if (!studentId || !password) {
      throw new Error("학번과 비밀번호를 모두 입력해 주세요.");
    }
    await chrome.storage.session.set({
      [SESSION_KEY_PORTAL_CREDS]: { studentId, password },
      [SESSION_KEY_LAST_STUDENT_ID]: studentId,
    });
  },

  async clearCredentials(): Promise<void> {
    await chrome.storage.session.remove([
      SESSION_KEY_PORTAL_CREDS,
      SESSION_KEY_LAST_STUDENT_ID,
    ]);
  },

  async getLastKnownStudentId(): Promise<string> {
    const creds = await this.getCredentials();
    if (creds?.studentId) return creds.studentId;
    const result = await chrome.storage.session.get(SESSION_KEY_LAST_STUDENT_ID);
    const sid = result[SESSION_KEY_LAST_STUDENT_ID];
    return typeof sid === "string" ? sid : "";
  },

  async setLastKnownStudentId(studentId: string): Promise<void> {
    if (!studentId.trim()) return;
    await chrome.storage.session.set({
      [SESSION_KEY_LAST_STUDENT_ID]: studentId.trim(),
    });
  },
};
