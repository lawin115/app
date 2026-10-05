import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CheckCircle,
  Star,
  MapPin,
  Flag,
  CarProfile,
} from "phosphor-react-native";

import { api, Order } from "@/src/api";
import {
  colors,
  fontFamily,
  makeStyles,
  radius,
  shadow,
  spacing,
  typography,
} from "@/src/theme";

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function Completed() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const list = await api.allOrders("completed");
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
    const t = setInterval(() => load(false), 10000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="completed-screen">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Fulfilled</Text>
        <Text style={styles.title}>Completed</Text>
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
            padding: spacing.xl,
            paddingBottom: insets.bottom + spacing.xxl,
            gap: spacing.md,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(false); }}
              tintColor={colors.brandPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty} testID="completed-empty">
              <View style={styles.emptyIcon}>
                <CheckCircle size={44} color={colors.brandPrimary} weight="duotone" />
              </View>
              <Text style={styles.emptyTitle}>No completed rides yet</Text>
              <Text style={styles.emptyBody}>Completed trips move here automatically.</Text>
              {error ? <Text style={styles.err}>{error}</Text> : null}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card} testID={`completed-${item.id}`}>
              <View style={styles.rowBetween}>
                <View style={styles.carPill}>
                  <CarProfile size={16} color={colors.brandPrimary} weight="fill" />
                  <Text style={styles.carPillTxt}>{item.car_name}</Text>
                </View>
                <Text style={styles.price}>${item.price.toFixed(0)}</Text>
              </View>
              <Text style={styles.customer}>{item.customer_name}</Text>
              <Text style={styles.when}>{formatDate(item.scheduled_at)}</Text>

              <View style={styles.routeBlock}>
                <View style={styles.routeLine}>
                  <MapPin size={16} color={colors.brandPrimary} weight="fill" />
                  <Text style={styles.routeTxt} numberOfLines={1}>{item.pickup_location}</Text>
                </View>
                <View style={styles.routeDots} />
                <View style={styles.routeLine}>
                  <Flag size={16} color={colors.success} weight="fill" />
                  <Text style={styles.routeTxt} numberOfLines={1}>{item.dropoff_location}</Text>
                </View>
              </View>

              {item.driver_name ? (
                <Text style={styles.driver}>Driver · {item.driver_name} ({item.driver_plate})</Text>
              ) : null}

              {item.rating != null ? (
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={16}
                      color={colors.brandPrimary}
                      weight={n <= (item.rating ?? 0) ? "fill" : "regular"}
                    />
                  ))}
                  {item.rating_comment ? (
                    <Text style={styles.ratingComment}> &ldquo;{item.rating_comment}&rdquo;</Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.unrated}>Not rated yet</Text>
              )}
            </View>
          )}
        />
      )}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: c.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: c.onSurface,
    fontSize: typography.xl,
    fontWeight: "600",
    fontFamily: fontFamily.display,
  },
  emptyBody: { color: c.muted, textAlign: "center", fontFamily: fontFamily.text },
  err: {
    marginTop: spacing.md,
    color: c.onError,
    backgroundColor: c.error,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.text,
  },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  carPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.brandTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  carPillTxt: {
    color: c.onBrandTertiary,
    fontWeight: "700",
    fontSize: typography.sm,
    fontFamily: fontFamily.text,
  },
  price: {
    color: c.onSurface,
    fontSize: typography.xxl,
    fontWeight: "700",
    fontFamily: fontFamily.display,
  },
  customer: {
    color: c.onSurface,
    fontSize: typography.lg,
    fontWeight: "700",
    fontFamily: fontFamily.text,
    marginTop: spacing.xs,
  },
  when: { color: c.muted, fontSize: typography.sm, marginTop: 2, fontFamily: fontFamily.text },
  routeBlock: { marginTop: spacing.md },
  routeLine: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  routeTxt: { flex: 1, color: c.onSurface, fontSize: typography.base, fontFamily: fontFamily.text },
  routeDots: {
    marginStart: 8,
    width: 1,
    height: 12,
    borderStartWidth: 1,
    borderColor: c.borderStrong,
    borderStyle: "dashed",
    marginVertical: 4,
  },
  driver: { color: c.onSurfaceTertiary, marginTop: spacing.sm, fontSize: typography.sm, fontFamily: fontFamily.text },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: 2,
    flexWrap: "wrap",
  },
  ratingComment: { color: c.muted, fontStyle: "italic", fontFamily: fontFamily.text },
  unrated: { color: c.muted, marginTop: spacing.sm, fontStyle: "italic", fontFamily: fontFamily.text },
}));
