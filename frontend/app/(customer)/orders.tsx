import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Order } from "@/src/api";
import { colors, makeStyles, radius, spacing, typography } from "@/src/theme";

function statusLabel(s: Order["status"]) {
  if (s === "pending") return "Awaiting company";
  if (s === "accepted") return "Accepted";
  return "Rejected";
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function Orders() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ highlight?: string }>();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const list = await api.myOrders();
      setOrders(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), 7000);
    return () => clearInterval(t);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(false);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="orders-screen">
      <View style={styles.header}>
        <Pressable
          testID="back-button"
          onPress={() => router.replace("/(customer)/book")}
          style={styles.backBtn}
        >
          <Text style={styles.backTxt}>Back</Text>
        </Pressable>
        <Text style={styles.title}>My rides</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.md,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brandPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty} testID="orders-empty">
              <Text style={styles.emptyTitle}>No rides yet</Text>
              <Text style={styles.emptyBody}>Your booked rides will appear here.</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          }
          renderItem={({ item }) => {
            const isHighlight = params.highlight === item.id;
            const badgeStyle =
              item.status === "accepted"
                ? styles.badgeOk
                : item.status === "rejected"
                ? styles.badgeBad
                : styles.badgePending;
            return (
              <View
                testID={`order-row-${item.id}`}
                style={[styles.card, isHighlight && styles.cardHighlight]}
              >
                <View style={styles.rowBetween}>
                  <Text style={styles.car}>{item.car_name}</Text>
                  <Text style={styles.price}>${item.price.toFixed(0)}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.whenTxt}>{formatDate(item.scheduled_at)}</Text>
                  <View style={[styles.badge, badgeStyle]}>
                    <Text style={styles.badgeTxt}>{statusLabel(item.status)}</Text>
                  </View>
                </View>
                <View style={styles.sep} />
                <Text style={styles.routeLbl}>Pickup</Text>
                <Text style={styles.route}>{item.pickup_location}</Text>
                <Text style={styles.routeLbl}>Drop-off</Text>
                <Text style={styles.route}>{item.dropoff_location}</Text>
                {item.notes ? (
                  <>
                    <Text style={styles.routeLbl}>Notes</Text>
                    <Text style={styles.route}>{item.notes}</Text>
                  </>
                ) : null}
                {item.status === "accepted" ? (
                  <View style={styles.okBanner} testID={`accepted-banner-${item.id}`}>
                    <Text style={styles.okBannerTxt}>
                      Your order has been accepted. A driver will meet you at the pickup point.
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  backBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
  },
  backTxt: { color: c.onSurfaceSecondary, fontWeight: "600" },
  title: { color: c.onSurface, fontSize: typography.xl, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyTitle: { color: c.onSurface, fontSize: typography.xl, fontWeight: "700" },
  emptyBody: { color: c.muted, textAlign: "center" },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardHighlight: { borderColor: c.brandPrimary, borderWidth: 2 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  car: { color: c.onSurface, fontSize: typography.xl, fontWeight: "700" },
  price: { color: c.brandPrimary, fontSize: typography.xl, fontWeight: "700" },
  whenTxt: { color: c.muted },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgePending: { backgroundColor: c.warning },
  badgeOk: { backgroundColor: c.success },
  badgeBad: { backgroundColor: c.error },
  badgeTxt: { color: c.onSurface, fontSize: typography.sm, fontWeight: "700" },
  sep: { height: 1, backgroundColor: c.divider, marginVertical: spacing.sm },
  routeLbl: {
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: typography.sm,
    marginTop: spacing.sm,
  },
  route: { color: c.onSurface, fontSize: typography.lg, marginTop: 2 },
  okBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.success,
  },
  okBannerTxt: { color: c.onSuccess, fontWeight: "600" },
  error: {
    marginTop: spacing.md,
    color: c.onError,
    backgroundColor: c.error,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
}));
