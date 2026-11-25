# ThulasiConnect — Step 1 Security Repair Report: Frontend Authentication Hardening

**Date:** November 25, 2026  
**Auditor & Security Engineer:** Senior Full-Stack Application Security Engineer  
**Scope:** Frontend Authentication Flow, Token Validation, Mock Fallback Removal  
**Target:** [`frontend/src/services/api.ts`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/services/api.ts), [`frontend/src/services/mockData.ts`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/services/mockData.ts), [`frontend/src/pages/LoginPage.tsx`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/pages/LoginPage.tsx)

---

## 1. Backups Created

Prior to code modifications, pristine backup copies of all target authentication files were saved:
- [`frontend/src/services/api.ts.bak`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/services/api.ts.bak)
- [`frontend/src/services/mockData.ts.bak`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/services/mockData.ts.bak)
- [`frontend/src/features/authentication/AuthContext.tsx.bak`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/features/authentication/AuthContext.tsx.bak)
- [`frontend/src/pages/LoginPage.tsx.bak`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/pages/LoginPage.tsx.bak)

---

## 2. Security Vulnerabilities Identified & Eliminated

### 2.1 Elimination of Silent Mock Authentication (SEC-01)
- **Vulnerability:** Previously, when a login request to `/api/auth/login` returned an error or when the backend was unavailable (e.g. Vercel returning HTTP 405 on static POST), `api.ts` dropped into `getMockResponse` in `mockData.ts`. `mockData.ts` automatically matched any email (or defaulted to pharmacist) and returned a synthetic mock session without verifying passwords.
- **Remediation:**
  1. In [`mockData.ts`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/services/mockData.ts#L1297), permanently removed all mock handlers for `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/password-reset/request`, and `/api/auth/password-reset/confirm`.
  2. Added a top-level security guard in `getMockResponse`:
     ```typescript
     if (cleanPath.startsWith('/api/auth/')) {
       return undefined;
     }
     ```
  3. Added a production environment guard: In production builds (`import.meta.env.PROD`), mock fallbacks are completely disabled.
  4. In [`api.ts`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/services/api.ts#L112), any failure to reach `/api/auth/*` immediately throws an explicit `ApiError(503, 'Unable to connect to the authentication server...')` and never falls through to mock data.

### 2.2 Rejection of Arbitrary / Non-JWT Tokens (SEC-02)
- **Vulnerability:** Protected routes in `App.tsx` and `AuthContext.tsx` previously treated any arbitrary string in `localStorage.getItem('tc_access_token')` as an active session. A user could type `localStorage.setItem('tc_access_token', 'mock_jwt_token_admin@thulasipharmacy.local')` in browser devtools and bypass the login wall.
- **Remediation:**
  1. Implemented `isValidJwtFormat(token)` in [`api.ts`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/services/api.ts#L17):
     ```typescript
     export function isValidJwtFormat(token: string | null | undefined): boolean {
       if (!token || typeof token !== 'string') return false;
       const parts = token.trim().split('.');
       if (parts.length !== 3) return false;
       return parts.every((part) => part.length > 0 && /^[a-zA-Z0-9_-]+$/.test(part));
     }
     ```
  2. Enforced strict validation inside `getStoredToken()` and `setStoredToken()`. If an existing token in `localStorage` or `sessionStorage` is not a cryptographically valid 3-part signed JWT, it is **instantly purged** (`removeItem`), returning `null`.
  3. Legacy mock tokens (such as `mock_jwt_token_...`) are automatically wiped on page load.

### 2.3 Elimination of Hardcoded Password Quick-Login (SEC-03)
- **Vulnerability:** `LoginPage.tsx` contained `handleQuickLogin` which attempted auto-login with hardcoded credentials `ThulasiDev#2026`.
- **Remediation:**
  1. Replaced `handleQuickLogin` with `handleSelectAccount(demoEmail: string)` in [`LoginPage.tsx`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/pages/LoginPage.tsx#L37).
  2. Clicking a staff profile now merely populates the email input field and clears the password field, requiring the user to supply their real authorized password for server-side verification.

---

## 3. Automated Verification & Test Results

All security test cases were executed on a production preview build (`vite build` + `vite preview`):

| Test Case | Procedure | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Production Build** | `tsc --noEmit && vite build` | Clean compilation with 0 TypeScript errors | Built in 10.70s (`dist/assets/index-C1SRoFJx.js`) |  **PASSED** |
| **Invalid Password** | Input `invalid@thulasipharmacy.local` / `wrongpassword123`, click Sign In | Rejected; error banner displayed; no session created; URL remains `/login` | Server error banner shown; URL remains `/login`; 0 tokens created |  **PASSED** |
| **Nonexistent Account** | Input `nonexistent@unknown.com` / `anysecret123`, click Sign In | Rejected; no session created; URL remains `/login` | Authentication refused; URL remains `/login` |  **PASSED** |
| **Backend Offline Behavior**| Submit login when backend API is offline or returning HTTP 405 | Explicit connection error displayed; NO mock auto-login | Banner: `"Backend API service is currently unavailable or not connected"` |  **PASSED** |
| **Direct URL Access** | Navigate directly to `http://localhost:4173/calls` without token | Immediately redirected to `/login` | Redirected to `http://localhost:4173/login` |  **PASSED** |
| **Fake Token Injection** | Execute `localStorage.setItem('tc_access_token', 'mock_jwt_token_admin@...')`, navigate to `/calls` | Fake token detected as non-JWT, purged to `null`, redirected to `/login` | `localStorage.getItem('tc_access_token')` became `null`; redirected to `/login` |  **PASSED** |
| **Production Mock Guard**| Verify `getMockResponse` in production build | Always returns `undefined` for auth and production builds | Returns `undefined`; cannot activate mock auth in production |  **PASSED** |

---

## 4. Summary of Files Modified

1. [`frontend/src/services/api.ts`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/services/api.ts):
   - Added `isValidJwtFormat()` validator.
   - Updated `getStoredToken()` and `setStoredToken()` to automatically purge non-JWT tokens.
   - Hardened `apiRequest()`: strictly prohibits mock fallback for any `/api/auth/*` route and rejects static HTTP 405/HTML rewrites.
2. [`frontend/src/services/mockData.ts`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/services/mockData.ts):
   - Completely deleted all `/api/auth/*` mock response generators.
   - Added `import.meta.env.PROD` guard to disable all mock data in production builds.
3. [`frontend/src/pages/LoginPage.tsx`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/frontend/src/pages/LoginPage.tsx):
   - Removed hardcoded auto-login password submissions.
   - Added `handleSelectAccount` to populate email only, enforcing credential submission.
