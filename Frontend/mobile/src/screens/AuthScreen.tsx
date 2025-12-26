import React, { useMemo, useState } from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { apiPost } from "../lib/api";
import { TokenPair } from "../lib/storage";

type LoginMode = "default" | "platonus";
type Step = "login" | "verify";
type MessageState = { type: "success" | "error"; text: string } | null;

type Props = {
  onAuthSuccess: (tokens: TokenPair) => void;
};

export default function AuthScreen({ onAuthSuccess }: Props) {
  const [mode, setMode] = useState<LoginMode>("default");
  const [step, setStep] = useState<Step>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [platonusLogin, setPlatonusLogin] = useState("");
  const [platonusPassword, setPlatonusPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  const subtitle = useMemo(() => {
    if (mode === "platonus") return "Sign in with your Platonus account.";
    return "Use your campus email to continue.";
  }, [mode]);

  const handleAuth = async () => {
    setMessage(null);
    setIsSubmitting(true);
    try {
      if (mode === "platonus") {
        if (!platonusLogin || !platonusPassword) {
          throw new Error("Enter Platonus login and password.");
        }
        const resp = await apiPost<any>("/api/auth/platonus", {
          login: platonusLogin,
          password: platonusPassword
        });
        onAuthSuccess(resp || {});
        const role = resp?.role ? ` (${resp.role})` : "";
        setMessage({ type: "success", text: `Platonus login successful${role}.` });
        return;
      }

      if (!email) {
        throw new Error("Enter your campus email.");
      }
      if (step === "login") {
        if (!password) {
          throw new Error("Enter your password.");
        }
        const resp = await apiPost<any>("/api/auth/login", { email, password });
        onAuthSuccess(resp || {});
        setMessage({ type: "success", text: "Signed in successfully." });
      } else {
        if (!verificationCode) {
          throw new Error("Enter the verification code.");
        }
        const resp = await apiPost<any>("/api/auth/verify", { email, code: verificationCode });
        onAuthSuccess(resp || {});
        setMessage({ type: "success", text: "Code verified successfully." });
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "Request failed.";
      setMessage({ type: "error", text });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={["#ffffff", "#ffffff", "#ffffff"]} style={styles.gradient} />
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.languagePill}>
                <Text style={styles.languageText}>EN</Text>
              </View>
            </View>

            <Text style={styles.title}>{mode === "platonus" ? "Platonus Login" : "Welcome Back"}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <View style={styles.segment}>
              <TouchableOpacity
                onPress={() => {
                  setMode("default");
                  setStep("login");
                  setMessage(null);
                }}
                style={[styles.segmentButton, mode === "default" && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, mode === "default" && styles.segmentTextActive]}>
                  Campus
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setMode("platonus");
                  setStep("login");
                  setMessage(null);
                }}
                style={[styles.segmentButton, mode === "platonus" && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, mode === "platonus" && styles.segmentTextActive]}>
                  Platonus
                </Text>
              </TouchableOpacity>
            </View>

            {mode === "default" ? (
              <>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="username@campus.edu"
                  placeholderTextColor="#a1a1aa"
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                />

                {step === "login" ? (
                  <>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        autoCapitalize="none"
                        autoComplete="password"
                        placeholder="Your password"
                        placeholderTextColor="#a1a1aa"
                        secureTextEntry={!showPassword}
                        style={[styles.input, styles.inputFlex]}
                        value={password}
                        onChangeText={setPassword}
                      />
                      <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)} style={styles.eyeButton}>
                        <Text style={styles.eyeText}>{showPassword ? "Hide" : "Show"}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inlineRow}>
                      <View style={styles.switchRow}>
                        <Switch
                          value={remember}
                          onValueChange={setRemember}
                          thumbColor={Platform.OS === "android" ? "#f2f2f5" : undefined}
                          trackColor={{ false: "#d4d4d8", true: "#7b0f2b" }}
                        />
                        <Text style={styles.switchLabel}>Remember me</Text>
                      </View>
                      <TouchableOpacity onPress={() => setStep("verify")}>
                        <Text style={styles.link}>Use code</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Verification code</Text>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="Enter the code"
                      placeholderTextColor="#a1a1aa"
                      style={styles.input}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                    />
                    <Text style={styles.helper}>Check your email for the 6-digit code.</Text>
                  </>
                )}

                {message && (
                  <Text style={[styles.message, message.type === "error" ? styles.messageError : styles.messageSuccess]}>
                    {message.text}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                  onPress={handleAuth}
                  disabled={isSubmitting}
                >
                  <Text style={styles.primaryText}>{step === "login" ? "Sign in" : "Verify"}</Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setMode("platonus");
                    setStep("login");
                    setMessage(null);
                  }}
                >
                  <Text style={styles.secondaryText}>Continue with Platonus</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>Platonus login</Text>
                <TextInput
                  autoCapitalize="none"
                  placeholder="Student ID"
                  placeholderTextColor="#a1a1aa"
                  style={styles.input}
                  value={platonusLogin}
                  onChangeText={setPlatonusLogin}
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                  autoCapitalize="none"
                  placeholder="Your password"
                  placeholderTextColor="#a1a1aa"
                  secureTextEntry
                  style={styles.input}
                  value={platonusPassword}
                  onChangeText={setPlatonusPassword}
                />

                {message && (
                  <Text style={[styles.message, message.type === "error" ? styles.messageError : styles.messageSuccess]}>
                    {message.text}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                  onPress={handleAuth}
                  disabled={isSubmitting}
                >
                  <Text style={styles.primaryText}>Sign in</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ghostButton}
                  onPress={() => {
                    setMode("default");
                    setStep("login");
                    setMessage(null);
                  }}
                >
                  <Text style={styles.ghostText}>Back to campus login</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>New here?</Text>
              <TouchableOpacity>
                <Text style={styles.link}>Create an account</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.guestRow}>
              <Text style={styles.guestText}>Continue as guest</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  gradient: {
    ...StyleSheet.absoluteFillObject
  },
  glowTop: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(0, 0, 0, 0.03)"
  },
  glowBottom: {
    position: "absolute",
    bottom: -160,
    right: -120,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(0, 0, 0, 0.03)"
  },
  safe: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 32
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: "#1f1f1f",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6
  },
  headerRow: {
    alignItems: "flex-end",
    marginBottom: 12
  },
  languagePill: {
    backgroundColor: "#f4e7ec",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  languageText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#7b0f2b"
  },
  title: {
    fontFamily: "Manrope_700Bold",
    fontSize: 22,
    color: "#7b0f2b",
    marginBottom: 6
  },
  subtitle: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 18
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 14,
    padding: 4,
    marginBottom: 20
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center"
  },
  segmentActive: {
    backgroundColor: "#7b0f2b"
  },
  segmentText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: "#6b7280"
  },
  segmentTextActive: {
    color: "#ffffff"
  },
  label: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: "#374151",
    marginBottom: 6
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Manrope_400Regular",
    color: "#111827",
    backgroundColor: "#ffffff",
    marginBottom: 14
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8
  },
  inputFlex: {
    flex: 1,
    marginBottom: 0
  },
  eyeButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f4e7ec"
  },
  eyeText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#7b0f2b"
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  switchLabel: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: "#6b7280"
  },
  link: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: "#7b0f2b"
  },
  helper: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#6b7280",
    marginTop: -8,
    marginBottom: 16
  },
  message: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    marginBottom: 10
  },
  messageError: {
    color: "#b91c1c"
  },
  messageSuccess: {
    color: "#166534"
  },
  primaryButton: {
    backgroundColor: "#7b0f2b",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16
  },
  primaryText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: "#ffffff"
  },
  buttonDisabled: {
    opacity: 0.6
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb"
  },
  dividerText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#9ca3af",
    marginHorizontal: 10
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#7b0f2b",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 18
  },
  secondaryText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: "#7b0f2b"
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 18
  },
  ghostText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: "#6b7280"
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  footerText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: "#6b7280"
  },
  guestRow: {
    alignItems: "center"
  },
  guestText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: "#9ca3af"
  }
});
