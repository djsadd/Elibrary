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
type Language = "ru" | "kz" | "en";
type MessageState = { type: "success" | "error"; text: string } | null;
type TwoFAChallenge = {
  requires_2fa?: boolean;
  challenge_id?: string;
  expires_in?: number;
};

const translations = {
  ru: {
    languages: { ru: "RU", kz: "KZ", en: "EN" },
    titleDefault: "С возвращением",
    titlePlatonus: "Вход в аккаунт кампуса",
    subtitleDefault: "Войдите через корпоративную почту.",
    subtitlePlatonus: "Войдите через учетную запись кампуса.",
    campus: "Почта",
    campusId: "Campus ID",
    email: "Email",
    emailPlaceholder: "username@campus.edu",
    password: "Пароль",
    passwordPlaceholder: "Ваш пароль",
    show: "Показать",
    hide: "Скрыть",
    remember: "Запомнить меня",
    login: "Логин",
    loginPlaceholder: "Student ID",
    verificationTitle: "Код подтверждения",
    verificationPlaceholder: "Введите код из письма",
    verificationHelper: "Мы отправили 6-значный код на вашу почту.",
    verificationHint: "После ввода логина и пароля подтвердите вход кодом из email.",
    signIn: "Войти",
    verify: "Подтвердить",
    or: "или",
    continueWithCampus: "Продолжить через аккаунт кампуса",
    backToEmail: "Вернуться ко входу по email",
    back: "Назад",
    resendCode: "Отправить код еще раз",
    newHere: "Впервые здесь?",
    createAccount: "Создать аккаунт",
    continueAsGuest: "Продолжить как гость",
    errorEnterLoginPassword: "Введите логин и пароль.",
    errorEnterEmail: "Введите корпоративную почту.",
    errorEnterPassword: "Введите пароль.",
    errorEnterCode: "Введите код подтверждения.",
    loginSuccess: "Вход выполнен успешно.",
    codeVerified: "Код подтвержден, вход выполнен.",
    codeSent: "Код подтверждения отправлен на вашу почту.",
    codeResent: "Новый код отправлен на вашу почту."
  },
  kz: {
    languages: { ru: "RU", kz: "KZ", en: "EN" },
    titleDefault: "Қош келдініз",
    titlePlatonus: "Campus аккаунтына кіру",
    subtitleDefault: "Корпоративтік пошта арқылы кіріңіз.",
    subtitlePlatonus: "Campus тіркелгісі арқылы кіріңіз.",
    campus: "Пошта",
    campusId: "Campus ID",
    email: "Email",
    emailPlaceholder: "username@campus.edu",
    password: "Құпиясөз",
    passwordPlaceholder: "Құпиясөзіңіз",
    show: "Көрсету",
    hide: "Жасыру",
    remember: "Мені есте сақтау",
    login: "Логин",
    loginPlaceholder: "Student ID",
    verificationTitle: "Растау коды",
    verificationPlaceholder: "Email-дегі кодты енгізіңіз",
    verificationHelper: "Біз email-ге 6 таңбалы код жібердік.",
    verificationHint: "Логин мен құпиясөзді енгізгеннен кейін email кодымен кіруді растаңыз.",
    signIn: "Кіру",
    verify: "Растау",
    or: "немесе",
    continueWithCampus: "Campus аккаунты арқылы жалғастыру",
    backToEmail: "Email арқылы кіруге оралу",
    back: "Артқа",
    resendCode: "Кодты қайта жіберу",
    newHere: "Алғаш рет пе?",
    createAccount: "Аккаунт ашу",
    continueAsGuest: "Қонақ ретінде жалғастыру",
    errorEnterLoginPassword: "Логин мен құпиясөзді енгізіңіз.",
    errorEnterEmail: "Корпоративтік email енгізіңіз.",
    errorEnterPassword: "Құпиясөзді енгізіңіз.",
    errorEnterCode: "Растау кодын енгізіңіз.",
    loginSuccess: "Кіру сәтті аяқталды.",
    codeVerified: "Код расталды, кіру сәтті аяқталды.",
    codeSent: "Растау коды email-ге жіберілді.",
    codeResent: "Жаңа код email-ге қайта жіберілді."
  },
  en: {
    languages: { ru: "RU", kz: "KZ", en: "EN" },
    titleDefault: "Welcome Back",
    titlePlatonus: "Campus Account Login",
    subtitleDefault: "Use your campus email to continue.",
    subtitlePlatonus: "Sign in with your campus account.",
    campus: "Campus",
    campusId: "Campus ID",
    email: "Email",
    emailPlaceholder: "username@campus.edu",
    password: "Password",
    passwordPlaceholder: "Your password",
    show: "Show",
    hide: "Hide",
    remember: "Remember me",
    login: "Login",
    loginPlaceholder: "Student ID",
    verificationTitle: "Verification code",
    verificationPlaceholder: "Enter the code from email",
    verificationHelper: "We sent a 6-digit code to your email.",
    verificationHint: "After entering your login and password, confirm sign-in with the email code.",
    signIn: "Sign in",
    verify: "Verify",
    or: "or",
    continueWithCampus: "Continue with campus account",
    backToEmail: "Back to email login",
    back: "Back",
    resendCode: "Resend code",
    newHere: "New here?",
    createAccount: "Create an account",
    continueAsGuest: "Continue as guest",
    errorEnterLoginPassword: "Enter your login and password.",
    errorEnterEmail: "Enter your campus email.",
    errorEnterPassword: "Enter your password.",
    errorEnterCode: "Enter the verification code.",
    loginSuccess: "Signed in successfully.",
    codeVerified: "Code verified successfully.",
    codeSent: "Verification code sent to your email.",
    codeResent: "A new code was sent to your email."
  }
} as const;

type Props = {
  onAuthSuccess: (tokens: TokenPair) => void;
};

export default function AuthScreen({ onAuthSuccess }: Props) {
  const [language, setLanguage] = useState<Language>("ru");
  const [mode, setMode] = useState<LoginMode>("default");
  const [step, setStep] = useState<Step>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [platonusLogin, setPlatonusLogin] = useState("");
  const [platonusPassword, setPlatonusPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  const copy = useMemo(() => translations[language], [language]);
  const subtitle = useMemo(() => {
    if (mode === "platonus") return copy.subtitlePlatonus;
    return copy.subtitleDefault;
  }, [copy, mode]);

  const resetToLoginStep = () => {
    setStep("login");
    setChallengeId(null);
    setVerificationCode("");
  };

  const startTwoFactorFlow = (resp: TwoFAChallenge) => {
    if (!resp?.challenge_id) {
      throw new Error("Challenge ID was not returned.");
    }
    setChallengeId(resp.challenge_id);
    setStep("verify");
    setVerificationCode("");
    setMessage({ type: "success", text: copy.codeSent });
  };

  const handleResendCode = async () => {
    if (!challengeId) {
      setMessage({ type: "error", text: copy.errorEnterCode });
      return;
    }

    setMessage(null);
    setIsSubmitting(true);
    try {
      await apiPost("/api/auth/2fa/resend", { challenge_id: challengeId });
      setMessage({ type: "success", text: copy.codeResent });
    } catch (err) {
      const text = err instanceof Error ? err.message : "Request failed.";
      setMessage({ type: "error", text });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuth = async () => {
    setMessage(null);
    setIsSubmitting(true);
    try {
      if (mode === "platonus") {
        if (step === "login") {
          if (!platonusLogin || !platonusPassword) {
            throw new Error(copy.errorEnterLoginPassword);
          }
          const resp = await apiPost<any>("/api/auth/platonus", {
            login: platonusLogin,
            password: platonusPassword
          });
          if (resp?.requires_2fa) {
            startTwoFactorFlow(resp);
            return;
          }
          onAuthSuccess(resp || {});
          setMessage({ type: "success", text: copy.loginSuccess });
          return;
        }

        if (!verificationCode) {
          throw new Error(copy.errorEnterCode);
        }
        if (!challengeId) {
          throw new Error("Challenge ID is missing.");
        }
        const resp = await apiPost<any>("/api/auth/2fa/verify", {
          challenge_id: challengeId,
          code: verificationCode
        });
        onAuthSuccess(resp || {});
        setMessage({ type: "success", text: copy.codeVerified });
        return;
      }

      if (!email) {
        throw new Error(copy.errorEnterEmail);
      }
      if (step === "login") {
        if (!password) {
          throw new Error(copy.errorEnterPassword);
        }
        const resp = await apiPost<any>("/api/auth/login", { email, password });
        if (resp?.requires_2fa) {
          startTwoFactorFlow(resp);
          return;
        }
        onAuthSuccess(resp || {});
        setMessage({ type: "success", text: copy.loginSuccess });
      } else {
        if (!verificationCode) {
          throw new Error(copy.errorEnterCode);
        }
        if (!challengeId) {
          throw new Error("Challenge ID is missing.");
        }
        const resp = await apiPost<any>("/api/auth/2fa/verify", {
          challenge_id: challengeId,
          code: verificationCode
        });
        onAuthSuccess(resp || {});
        setMessage({ type: "success", text: copy.codeVerified });
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
              <View style={styles.languageGroup}>
                {(Object.keys(copy.languages) as Language[]).map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    onPress={() => setLanguage(lang)}
                    style={[styles.languagePill, language === lang && styles.languagePillActive]}
                  >
                    <Text style={[styles.languageText, language === lang && styles.languageTextActive]}>
                      {copy.languages[lang]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.title}>{mode === "platonus" ? copy.titlePlatonus : copy.titleDefault}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <View style={styles.segment}>
              <TouchableOpacity
                onPress={() => {
                  setMode("default");
                  resetToLoginStep();
                  setMessage(null);
                }}
                style={[styles.segmentButton, mode === "default" && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, mode === "default" && styles.segmentTextActive]}>
                  {copy.campus}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setMode("platonus");
                  resetToLoginStep();
                  setMessage(null);
                }}
                style={[styles.segmentButton, mode === "platonus" && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, mode === "platonus" && styles.segmentTextActive]}>
                  {copy.campusId}
                </Text>
              </TouchableOpacity>
            </View>

            {mode === "default" ? (
              <>
                <Text style={styles.label}>{copy.email}</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder={copy.emailPlaceholder}
                  placeholderTextColor="#a1a1aa"
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                />

                {step === "login" ? (
                  <>
                    <Text style={styles.label}>{copy.password}</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        autoCapitalize="none"
                        autoComplete="password"
                        placeholder={copy.passwordPlaceholder}
                        placeholderTextColor="#a1a1aa"
                        secureTextEntry={!showPassword}
                        style={[styles.input, styles.inputFlex]}
                        value={password}
                        onChangeText={setPassword}
                      />
                      <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)} style={styles.eyeButton}>
                        <Text style={styles.eyeText}>{showPassword ? copy.hide : copy.show}</Text>
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
                        <Text style={styles.switchLabel}>{copy.remember}</Text>
                      </View>
                    </View>
                    <Text style={styles.helperLogin}>{copy.verificationHint}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>{copy.verificationTitle}</Text>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder={copy.verificationPlaceholder}
                      placeholderTextColor="#a1a1aa"
                      style={styles.input}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                    />
                    <Text style={styles.helper}>{copy.verificationHelper}</Text>
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
                  <Text style={styles.primaryText}>{step === "login" ? copy.signIn : copy.verify}</Text>
                </TouchableOpacity>

                {step === "login" ? (
                  <>
                    <View style={styles.dividerRow}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>{copy.or}</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => {
                        setMode("platonus");
                        resetToLoginStep();
                        setMessage(null);
                      }}
                    >
                      <Text style={styles.secondaryText}>{copy.continueWithCampus}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.ghostButtonHalf}
                      onPress={() => {
                        resetToLoginStep();
                        setMessage(null);
                      }}
                    >
                      <Text style={styles.ghostText}>{copy.back}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryButtonHalf}
                      onPress={handleResendCode}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.secondaryText}>{copy.resendCode}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.label}>{step === "login" ? copy.login : copy.verificationTitle}</Text>
                {step === "login" ? (
                  <TextInput
                    autoCapitalize="none"
                    placeholder={copy.loginPlaceholder}
                    placeholderTextColor="#a1a1aa"
                    style={styles.input}
                    value={platonusLogin}
                    onChangeText={setPlatonusLogin}
                  />
                ) : (
                  <TextInput
                    keyboardType="number-pad"
                    placeholder={copy.verificationPlaceholder}
                    placeholderTextColor="#a1a1aa"
                    style={styles.input}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                  />
                )}

                {step === "login" ? (
                  <>
                    <Text style={styles.label}>{copy.password}</Text>
                    <TextInput
                      autoCapitalize="none"
                      placeholder={copy.passwordPlaceholder}
                      placeholderTextColor="#a1a1aa"
                      secureTextEntry
                      style={styles.input}
                      value={platonusPassword}
                      onChangeText={setPlatonusPassword}
                    />
                    <Text style={styles.helperLogin}>{copy.verificationHint}</Text>
                  </>
                ) : (
                  <Text style={styles.helper}>{copy.verificationHelper}</Text>
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
                  <Text style={styles.primaryText}>{step === "login" ? copy.signIn : copy.verify}</Text>
                </TouchableOpacity>

                {step === "login" ? (
                  <TouchableOpacity
                    style={styles.ghostButton}
                    onPress={() => {
                      setMode("default");
                      resetToLoginStep();
                      setMessage(null);
                    }}
                  >
                    <Text style={styles.ghostText}>{copy.backToEmail}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.ghostButtonHalf}
                      onPress={() => {
                        resetToLoginStep();
                        setMessage(null);
                      }}
                    >
                      <Text style={styles.ghostText}>{copy.back}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryButtonHalf}
                      onPress={handleResendCode}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.secondaryText}>{copy.resendCode}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>{copy.newHere}</Text>
              <TouchableOpacity>
                <Text style={styles.link}>{copy.createAccount}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.guestRow}>
              <Text style={styles.guestText}>{copy.continueAsGuest}</Text>
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
  languageGroup: {
    flexDirection: "row",
    gap: 8
  },
  languagePill: {
    backgroundColor: "#f4e7ec",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  languagePillActive: {
    backgroundColor: "#7b0f2b"
  },
  languageText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#7b0f2b"
  },
  languageTextActive: {
    color: "#ffffff"
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
  helperLogin: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#6b7280",
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
  secondaryButtonHalf: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#7b0f2b",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center"
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18
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
  ghostButtonHalf: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center"
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
