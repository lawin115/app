import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  SignOut,
  User,
  EnvelopeSimple,
  Shield,
  Info,
  CarProfile,
} from "phosphor-react-native";

import { useAuth } from "@/src/auth";
import {
  colors,
  fontFamily,
  makeStyles,
  radius,
  shadow,
  spacing,
  typography,
} from "@/src/theme";

export default function CustomerProfile() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const router = useRouter();
  const { user, logout } = useAuth();

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="profile-screen">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Account</Text>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <User size={34} color={colors.onBrandPrimary} weight="fill" />
          </View>
          <Text style={styles.name}>{user?.name || "Guest"}</Text>
          <View style={styles.chip}>
            <Shield size={13} color={colors.onBrandTertiary} weight="fill" />
            <Text style={styles.chipTxt}>Customer</Text>
          </View>
        </View>

        <View style={styles.listCard}>
          <View style={styles.row}>
            <View style={styles.iconPad}>
              <EnvelopeSimple size={20} color={colors.brandPrimary} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLbl}>Email</Text>
              <Text style={styles.rowVal}>{user?.email}</Text>
            </View>
          </View>
          <View style={styles.sep} />
          <View style={styles.row}>
            <View style={styles.iconPad}>
              <CarProfile size={20} color={colors.brandPrimary} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLbl}>Preferred class</Text>
              <Text style={styles.rowVal}>VIP · Luxury · Normal</Text>
            </View>
          </View>
          <View style={styles.sep} />
          <View style={styles.row}>
            <View style={styles.iconPad}>
              <Info size={20} color={colors.brandPrimary} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLbl}>About LuxeDrive</Text>
              <Text style={styles.rowVal}>Private chauffeur, on demand.</Text>
            </View>
          </View>
        </View>

        <Pressable
          testID="logout-button"
          onPress={onLogout}
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.9 }]}
        >
          <SignOut size={20} color={colors.error} weight="bold" />
          <Text style={styles.logoutTxt}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  eyebrow: {
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: typography.sm,
    fontFamily: fontFamily.text,
    fontWeight: "600",
  },
  title: {
    color: c.onSurface,
    fontSize: typography.xxxl,
    marginTop: 2,
    fontFamily: fontFamily.display,
    fontWeight: "600",
  },
  heroCard: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    ...shadow.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  name: {
    color: c.onSurface,
    fontSize: typography.xxl,
    marginTop: spacing.md,
    fontFamily: fontFamily.display,
    fontWeight: "600",
  },
  chip: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    backgroundColor: c.brandTertiary,
    borderRadius: radius.pill,
  },
  chipTxt: {
    color: c.onBrandTertiary,
    fontSize: typography.sm,
    fontWeight: "700",
    fontFamily: fontFamily.text,
  },
  listCard: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    ...shadow.sm,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  iconPad: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: c.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLbl: {
    color: c.muted,
    fontSize: typography.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: fontFamily.text,
    fontWeight: "600",
  },
  rowVal: {
    color: c.onSurface,
    fontSize: typography.lg,
    marginTop: 2,
    fontFamily: fontFamily.text,
  },
  sep: { height: 1, backgroundColor: c.divider, marginHorizontal: spacing.md },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.error,
  },
  logoutTxt: { color: c.error, fontWeight: "700", fontFamily: fontFamily.text, fontSize: typography.lg },
}));
