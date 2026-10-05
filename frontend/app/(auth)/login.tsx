import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CarProfile, Lock, EnvelopeSimple, UserCircle, Buildings } from "phosphor-react-native";

import { useAuth } from "@/src/auth";
import { Role } from "@/src/api";
import { colors, fontFamily, makeStyles, radius, shadow, spacing, typography } from "@/src/theme";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<Role>("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setSubmitting(true);
    try {
      const user =
        mode === "login"
          ? await login(email.trim().toLowerCase(), password)
          : await register({
              email: email.trim().toLowerCase(),
              password,
              name: name.trim(),
              role,
              admin_code: role === "company_admin" ? adminCode.trim() : undefined,
            });
      if (user.role === "company_admin") router.replace("/(company)/orders");
      else router.replace("/(customer)/book");
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="auth-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <View style={styles.logoBadge}>
              <CarProfile size={28} color={colors.onBrandPrimary} weight="fill" />
            </View>
          </View>

          <Text style={styles.eyebrow}>Private chauffeur, on demand</Text>
          <Text style={styles.title} testID="brand-title">LuxeDrive</Text>
          <Text style={styles.sub}>Book a VIP, Luxury or Normal ride in a tap.</Text>

          <View style={styles.card} testID="auth-card">
            <View style={styles.segmentWrap}>
              <Pressable
                testID="login-tab"
                onPress={() => setMode("login")}
                style={[styles.segmentBtn, mode === "login" && styles.segmentBtnActive]}
              >
                <Text style={[styles.segmentTxt, mode === "login" && styles.segmentTxtActive]}>
                  Sign in
                </Text>
              </Pressable>
              <Pressable
                testID="register-tab"
                onPress={() => setMode("register")}
                style={[styles.segmentBtn, mode === "register" && styles.segmentBtnActive]}
              >
                <Text style={[styles.segmentTxt, mode === "register" && styles.segmentTxtActive]}>
                  Create account
                </Text>
              </Pressable>
            </View>

            {mode === "register" ? (
              <View style={styles.field}>
                <Text style={styles.label}>Full name</Text>
                <View style={styles.inputRow}>
                  <UserCircle size={20} color={colors.muted} />
                  <TextInput
                    testID="name-input"
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />
                </View>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <EnvelopeSimple size={20} color={colors.muted} />
                <TextInput
                  testID="email-input"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <Lock size={20} color={colors.muted} />
                <TextInput
                  testID="password-input"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  style={styles.input}
                />
              </View>
            </View>

            {mode === "register" ? (
              <>
                <Text style={styles.label}>I am a</Text>
                <View style={styles.roleRow}>
                  <Pressable
                    testID="role-customer"
                    style={[styles.roleCard, role === "customer" && styles.roleCardActive]}
                    onPress={() => setRole("customer")}
                  >
                    <UserCircle
                      size={22}
                      color={role === "customer" ? colors.onBrandPrimary : colors.brandPrimary}
                      weight={role === "customer" ? "fill" : "regular"}
                    />
                    <Text
                      style={[styles.roleTxt, role === "customer" && styles.roleTxtActive]}
                    >
                      Customer
                    </Text>
                  </Pressable>
                  <Pressable
                    testID="role-admin"
                    style={[styles.roleCard, role === "company_admin" && styles.roleCardActive]}
                    onPress={() => setRole("company_admin")}
                  >
                    <Buildings
                      size={22}
                      color={role === "company_admin" ? colors.onBrandPrimary : colors.brandPrimary}
                      weight={role === "company_admin" ? "fill" : "regular"}
                    />
                    <Text
                      style={[styles.roleTxt, role === "company_admin" && styles.roleTxtActive]}
                    >
                      Company
                    </Text>
                  </Pressable>
                </View>

                {role === "company_admin" ? (
                  <View style={styles.field}>
                    <Text style={styles.label}>Company signup code</Text>
                    <View style={styles.inputRow}>
                      <Lock size={20} color={colors.muted} />
                      <TextInput
                        testID="admin-code-input"
                        value={adminCode}
                        onChangeText={setAdminCode}
                        placeholder="Provided by LuxeDrive"
                        placeholderTextColor={colors.muted}
                        autoCapitalize="characters"
                        style={styles.input}
                      />
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}

            {error ? (
              <Text style={styles.error} testID="auth-error">{error}</Text>
            ) : null}

            <Pressable
              testID="auth-submit-button"
              disabled={submitting}
              onPress={submit}
              style={({ pressed }) => [styles.cta, (pressed || submitting) && styles.ctaPressed]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.onBrandPrimary} />
              ) : (
                <Text style={styles.ctaTxt}>{mode === "login" ? "Sign in" : "Create account"}</Text>
              )}
            </Pressable>

            <Text style={styles.hint}>
              {mode === "login"
                ? "Try admin · admin@luxedrive.com / Admin1234"
                : "Company signup code: LUXE2026"}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  logoWrap: { alignItems: "flex-start", marginBottom: spacing.xl },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  eyebrow: {
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: typography.sm,
    fontFamily: fontFamily.text,
  },
  title: {
    color: c.onSurface,
    fontSize: typography.display,
    marginTop: spacing.xs,
    fontFamily: fontFamily.display,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  sub: {
    color: c.onSurfaceTertiary,
    fontSize: typography.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    fontFamily: fontFamily.text,
  },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.md,
  },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.lg,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  segmentBtnActive: { backgroundColor: c.surfaceSecondary, ...shadow.sm },
  segmentTxt: { color: c.muted, fontWeight: "600", fontFamily: fontFamily.text },
  segmentTxtActive: { color: c.onSurface },
  field: { marginTop: spacing.md },
  label: {
    color: c.muted,
    fontSize: typography.sm,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: fontFamily.text,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    color: c.onSurface,
    fontSize: typography.lg,
    fontFamily: fontFamily.text,
  },
  roleRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  roleCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.surfaceTertiary,
    borderWidth: 1,
    borderColor: c.border,
  },
  roleCardActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  roleTxt: { color: c.onSurface, fontWeight: "700", fontFamily: fontFamily.text },
  roleTxtActive: { color: c.onBrandPrimary },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: c.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 4,
    alignItems: "center",
    ...shadow.md,
  },
  ctaPressed: { opacity: 0.9 },
  ctaTxt: {
    color: c.onBrandPrimary,
    fontWeight: "700",
    fontSize: typography.lg,
    fontFamily: fontFamily.text,
    letterSpacing: 0.3,
  },
  error: {
    color: c.onError,
    backgroundColor: c.error,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    fontFamily: fontFamily.text,
  },
  hint: {
    color: c.muted,
    textAlign: "center",
    marginTop: spacing.lg,
    fontSize: typography.sm,
    fontFamily: fontFamily.text,
  },
}));
