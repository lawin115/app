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
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Role } from "@/src/api";
import { colors, makeStyles, radius, spacing, typography } from "@/src/theme";

const BG =
  "https://images.unsplash.com/photo-1485291571150-772bcfc10da5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbHV4dXJ5JTIwc2VkYW4lMjBwcm9maWxlfGVufDB8fHx8MTc5MTIxODAzMXww&ixlib=rb-4.1.0&q=85";

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
      if (user.role === "company_admin") router.replace("/(company)/dashboard");
      else router.replace("/(customer)/book");
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="auth-screen">
      <Image source={BG} style={styles.bg} contentFit="cover" />
      <LinearGradient
        colors={["rgba(9,9,11,0.2)", "rgba(9,9,11,0.75)", colors.surface]}
        locations={[0, 0.55, 1]}
        style={styles.scrim}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.brand} testID="brand-title">LuxeDrive</Text>
            <Text style={styles.tagline}>Private chauffeur, on demand.</Text>
          </View>

          <View style={styles.card} testID="auth-card">
            <View style={styles.tabs}>
              <Pressable
                testID="login-tab"
                onPress={() => setMode("login")}
                style={[styles.tabBtn, mode === "login" && styles.tabBtnActive]}
              >
                <Text style={[styles.tabTxt, mode === "login" && styles.tabTxtActive]}>Sign in</Text>
              </Pressable>
              <Pressable
                testID="register-tab"
                onPress={() => setMode("register")}
                style={[styles.tabBtn, mode === "register" && styles.tabBtnActive]}
              >
                <Text style={[styles.tabTxt, mode === "register" && styles.tabTxtActive]}>Create account</Text>
              </Pressable>
            </View>

            {mode === "register" ? (
              <>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  testID="name-input"
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </>
            ) : null}

            <Text style={styles.label}>Email</Text>
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

            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
            />

            {mode === "register" ? (
              <>
                <Text style={styles.label}>I am a</Text>
                <View style={styles.roleRow}>
                  <Pressable
                    testID="role-customer"
                    style={[styles.rolePill, role === "customer" && styles.rolePillActive]}
                    onPress={() => setRole("customer")}
                  >
                    <Text style={[styles.rolePillTxt, role === "customer" && styles.rolePillTxtActive]}>Customer</Text>
                  </Pressable>
                  <Pressable
                    testID="role-admin"
                    style={[styles.rolePill, role === "company_admin" && styles.rolePillActive]}
                    onPress={() => setRole("company_admin")}
                  >
                    <Text style={[styles.rolePillTxt, role === "company_admin" && styles.rolePillTxtActive]}>Company</Text>
                  </Pressable>
                </View>

                {role === "company_admin" ? (
                  <>
                    <Text style={styles.label}>Company signup code</Text>
                    <TextInput
                      testID="admin-code-input"
                      value={adminCode}
                      onChangeText={setAdminCode}
                      placeholder="Provided by LuxeDrive"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="characters"
                      style={styles.input}
                    />
                  </>
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
                ? "Default admin: admin@luxedrive.com / Admin1234"
                : "Admin code (demo): LUXE2026"}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  bg: { position: "absolute", top: 0, left: 0, right: 0, height: "60%" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xxxl },
  header: { marginBottom: spacing.xxl, alignItems: "flex-start" },
  brand: {
    color: c.brandPrimary,
    fontSize: 34,
    letterSpacing: 1,
    fontWeight: "700",
  },
  tagline: { color: c.onSurface, marginTop: spacing.xs, fontSize: typography.lg, opacity: 0.9 },
  card: {
    backgroundColor: "rgba(24,24,27,0.9)",
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  tabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: c.brandTertiary },
  tabTxt: { color: c.onSurfaceTertiary, fontWeight: "600" },
  tabTxtActive: { color: c.onBrandTertiary },
  label: {
    color: c.muted,
    fontSize: typography.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: c.surfaceTertiary,
    color: c.onSurface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    fontSize: typography.lg,
  },
  roleRow: { flexDirection: "row", gap: spacing.sm },
  rolePill: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceTertiary,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
  },
  rolePillActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  rolePillTxt: { color: c.onSurfaceTertiary, fontWeight: "600" },
  rolePillTxtActive: { color: c.onBrandPrimary },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: c.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
  },
  ctaPressed: { opacity: 0.85 },
  ctaTxt: { color: c.onBrandPrimary, fontWeight: "700", fontSize: typography.lg },
  error: {
    color: c.onError,
    backgroundColor: c.error,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  hint: { color: c.muted, textAlign: "center", marginTop: spacing.md, fontSize: typography.sm },
}));
