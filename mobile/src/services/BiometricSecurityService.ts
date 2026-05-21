/**
 * Hardware-backed HITL signing.
 *
 * Crypto strategy (chosen to preserve Expo Go compatibility — no native
 * modules beyond what expo install provides):
 *   1. On first launch, generate 32 random bytes via expo-crypto and pin them
 *      in expo-secure-store under a biometric-gated key.
 *   2. To sign an approval, biometric-prompt → fetch secret → compute
 *      SHA-256(secret || pipelineId || rationale) → hex digest.
 *   3. Return "<operatorHandle>::<HEX>" to be POSTed as `approved_by`.
 *
 * This is an HMAC-style construction over a high-entropy device-only secret;
 * it is NOT ECDSA. Trade-off documented in the V2 spec.
 */

import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const SECRET_KEY = "pipeline.hitl_device_secret";

/**
 * SecureStore options. We do NOT pass requireAuthentication here — that flag
 * mandates enrolled biometrics on Android, which excludes test devices that
 * only have a PIN/passcode set. Authentication is enforced separately via
 * LocalAuthentication.authenticateAsync, which accepts device credentials as
 * a fallback (disableDeviceFallback: false).
 */
const STORE_OPTS: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export class BiometricUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BiometricUnavailableError";
    }
}

export class BiometricDeniedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BiometricDeniedError";
    }
}

export interface BiometricCapability {
    supported: boolean;
    enrolled: boolean;
    types: LocalAuthentication.AuthenticationType[];
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
    const [supported, enrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    return { supported, enrolled, types };
}

function hex(bytes: Uint8Array): string {
    let s = "";
    for (let i = 0; i < bytes.length; i += 1) {
        const b = bytes[i] ?? 0;
        s += b.toString(16).padStart(2, "0");
    }
    return s;
}

/** Ensure the per-install device secret exists in secure storage. */
export async function ensureDeviceSecretBootstrapped(): Promise<void> {
    const existing = await SecureStore.getItemAsync(SECRET_KEY, STORE_OPTS);
    if (existing && existing.length === 64) return;
    const raw = await Crypto.getRandomBytesAsync(32);
    const secret = hex(raw);
    await SecureStore.setItemAsync(SECRET_KEY, secret, STORE_OPTS);
}

/**
 * Require user authentication before releasing the device secret.
 * Accepts biometrics if enrolled, otherwise falls back to the device
 * credential (PIN / pattern / passcode). Rejects if no screen lock is set
 * at all OR the user cancels.
 */
async function readSecretGated(promptMessage: string): Promise<string> {
    const cap = await getBiometricCapability();
    if (!cap.supported && !cap.enrolled) {
        // No hardware AND no enrolled credential. authenticateAsync would
        // throw immediately. Surface a clear message instead.
        throw new BiometricUnavailableError(
            "No screen lock or biometrics on this device. Set a PIN, pattern, or biometric in system settings.",
        );
    }
    const auth = await LocalAuthentication.authenticateAsync({
        promptMessage,
        disableDeviceFallback: false,
        cancelLabel: "Cancel",
        fallbackLabel: "Use device PIN",
    });
    if (!auth.success) {
        const reason =
            "error" in auth && typeof auth.error === "string" ? auth.error : "Authentication cancelled.";
        if (reason === "passcode_not_set" || reason === "not_available") {
            throw new BiometricUnavailableError(
                "No biometrics or device credential available. Set a PIN, pattern, or biometric in system settings.",
            );
        }
        throw new BiometricDeniedError(reason);
    }
    const secret = await SecureStore.getItemAsync(SECRET_KEY, STORE_OPTS);
    if (!secret) throw new BiometricUnavailableError("Device secret missing — please reinstall.");
    return secret;
}

/**
 * Sign a HITL approval. Returns the full string to post as `approved_by`:
 *   "<operatorHandle>::<64-char-lowercase-hex>"
 */
export async function signApproval(
    operatorHandle: string,
    pipelineId: string,
    rationale: string,
): Promise<string> {
    const secret = await readSecretGated(`Approve pipeline ${pipelineId}`);
    const payload = `${secret}${pipelineId}${rationale}`;
    const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        payload,
        { encoding: Crypto.CryptoEncoding.HEX },
    );
    return `${operatorHandle}::${digest}`;
}

/** Debug-only — clears the device secret so a fresh one is bootstrapped next launch. */
export async function clearDeviceSecret(): Promise<void> {
    await SecureStore.deleteItemAsync(SECRET_KEY, STORE_OPTS);
}
