import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { api, Order, OrderStatus } from "@/src/api";
import { colors, makeStyles, radius, spacing, typography } from "@/src/theme";

type Filter = "all" | OrderStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "completed", label: "Completed" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function Dashboard() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [filter, setFilter] = useState<Filter>("pending");
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<{ avg_rating: number | null; rated_count: number }>({ avg_rating: null, rated_count: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // accept modal
  const [acceptFor, setAcceptFor] = useState<Order | null>(null);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverPlate, setDriverPlate] = useState("");
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const [list, s] = await Promise.all([
          api.allOrders(filter === "all" ? undefined : filter),
          api.statsOrders().catch(() => ({ avg_rating: null, rated_count: 0 })),
        ]);
        setOrders(list);
        setStats(s);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), 7000);
    return () => clearInterval(t);
  }, [load]);

  const openAccept = (o: Order) => {
    setAcceptFor(o);
    setDriverName("");
    setDriverPhone("");
    setDriverPlate("");
    setAcceptError(null);
  };

  const submitAccept = async () => {
    if (!acceptFor) return;
    if (!driverName.trim() || !driverPlate.trim()) {
      setAcceptError("Driver name and plate are required.");
      return;
    }
    setActioning(acceptFor.id);
    try {
      await api.acceptOrder(acceptFor.id, {
        driver_name: driverName.trim(),
        driver_phone: driverPhone.trim() || undefined,
        driver_plate: driverPlate.trim(),
      });
      setAcceptFor(null);
      await load(false);
    } catch (e: any) {
      setAcceptError(e?.message || "Could not accept order");
    } finally {
      setActioning(null);
    }
  };

  const reject = async (id: string) => {
    setActioning(id);
    try {
      await api.rejectOrder(id);
      await load(false);
    } catch (e: any) {
      setError(e?.message || "Could not reject");
    } finally {
      setActioning(null);
    }
  };

  const complete = async (id: string) => {
    setActioning(id);
    try {
      await api.completeOrder(id);
      await load(false);
    } catch (e: any) {
      setError(e?.message || "Could not complete");
    } finally {
      setActioning(null);
    }
  };

  const counts = useMemo(() => ({
    pending: orders.filter((o) => o.status === "pending").length,
    total: orders.length,
  }), [orders]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="dashboard-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>{user?.name || "Admin"}</Text>
          <Text style={styles.title}>Orders</Text>
        </View>
        <Pressable testID="logout-button" onPress={logout} style={styles.iconBtn}>
          <Text style={styles.iconBtnTxt}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.stats}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{counts.pending}</Text>
          <Text style={styles.statLbl}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{counts.total}</Text>
          <Text style={styles.statLbl}>In view</Text>
        </View>
        <View style={styles.statCard} testID="rating-stats">
          <Text style={styles.statVal}>
            {stats.avg_rating != null ? stats.avg_rating.toFixed(1) : "—"}
          </Text>
          <Text style={styles.statLbl}>Avg · {stats.rated_count}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            testID={`filter-${f.key}`}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
          >
            <Text style={[styles.chipTxt, filter === f.key && styles.chipTxtActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

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
              onRefresh={() => {
                setRefreshing(true);
                load(false);
              }}
              tintColor={colors.brandPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty} testID="dashboard-empty">
              <Text style={styles.emptyTitle}>No orders here</Text>
              <Text style={styles.emptyBody}>Pending orders will show up as customers place them.</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          }
          renderItem={({ item }) => {
            const badgeStyle =
              item.status === "accepted"
                ? styles.badgeOk
                : item.status === "completed"
                ? styles.badgeInfo
                : item.status === "rejected"
                ? styles.badgeBad
                : styles.badgePending;
            return (
              <View style={styles.card} testID={`order-${item.id}`}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customer}>{item.customer_name}</Text>
                    <Text style={styles.customerSub}>{item.customer_email}</Text>
                  </View>
                  <View style={[styles.badge, badgeStyle]}>
                    <Text style={styles.badgeTxt}>{item.status.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.rowBetween}>
                  <Text style={styles.car}>{item.car_name}</Text>
                  <Text style={styles.price}>${item.price.toFixed(0)}</Text>
                </View>

                {item.surge_reasons && item.surge_reasons.length > 0 ? (
                  <View style={styles.surgeRow}>
                    {item.surge_reasons.map((r) => (
                      <View key={r} style={styles.surgeChip}>
                        <Text style={styles.surgeChipTxt}>{r}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.sep} />
                <Text style={styles.lbl}>When</Text>
                <Text style={styles.val}>{formatDate(item.scheduled_at)}</Text>
                <Text style={styles.lbl}>Pickup</Text>
                <Text style={styles.val}>{item.pickup_location}</Text>
                <Text style={styles.lbl}>Drop-off</Text>
                <Text style={styles.val}>{item.dropoff_location}</Text>
                {item.notes ? (
                  <>
                    <Text style={styles.lbl}>Notes</Text>
                    <Text style={styles.val}>{item.notes}</Text>
                  </>
                ) : null}

                {item.driver_name ? (
                  <>
                    <Text style={styles.lbl}>Driver</Text>
                    <Text style={styles.val}>
                      {item.driver_name} · {item.driver_plate}
                      {item.driver_phone ? ` · ${item.driver_phone}` : ""}
                    </Text>
                  </>
                ) : null}

                {item.rating != null ? (
                  <View style={styles.ratingBlock} testID={`admin-rating-${item.id}`}>
                    <Text style={styles.ratingStars}>
                      {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                    </Text>
                    {item.rating_comment ? (
                      <Text style={styles.ratingComment}>"{item.rating_comment}"</Text>
                    ) : null}
                  </View>
                ) : null}

                {item.status === "pending" ? (
                  <View style={styles.actions}>
                    <Pressable
                      testID={`reject-${item.id}`}
                      disabled={actioning === item.id}
                      onPress={() => reject(item.id)}
                      style={[styles.actionBtn, styles.rejectBtn]}
                    >
                      <Text style={styles.rejectTxt}>Reject</Text>
                    </Pressable>
                    <Pressable
                      testID={`accept-${item.id}`}
                      disabled={actioning === item.id}
                      onPress={() => openAccept(item)}
                      style={[styles.actionBtn, styles.acceptBtn]}
                    >
                      <Text style={styles.acceptTxt}>Accept & assign</Text>
                    </Pressable>
                  </View>
                ) : null}

                {item.status === "accepted" ? (
                  <Pressable
                    testID={`complete-${item.id}`}
                    disabled={actioning === item.id}
                    onPress={() => complete(item.id)}
                    style={[styles.actionBtn, styles.acceptBtn, { marginTop: spacing.md }]}
                  >
                    {actioning === item.id ? (
                      <ActivityIndicator color={colors.onBrandPrimary} />
                    ) : (
                      <Text style={styles.acceptTxt}>Mark completed</Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {/* Accept-with-driver modal */}
      <Modal
        visible={!!acceptFor}
        animationType="slide"
        transparent
        onRequestClose={() => setAcceptFor(null)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard} testID="accept-modal">
            <Text style={styles.modalTitle}>Assign a driver</Text>
            <Text style={styles.modalSub}>
              {acceptFor?.customer_name} · {acceptFor?.car_name} · ${acceptFor?.price.toFixed(0)}
            </Text>
            <Text style={styles.lbl}>Driver name</Text>
            <TextInput
              testID="driver-name-input"
              value={driverName}
              onChangeText={setDriverName}
              placeholder="e.g. Khaled A."
              placeholderTextColor={colors.muted}
              style={styles.modalInput}
            />
            <Text style={styles.lbl}>Driver phone (optional)</Text>
            <TextInput
              testID="driver-phone-input"
              value={driverPhone}
              onChangeText={setDriverPhone}
              placeholder="+971 50 123 4567"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              style={styles.modalInput}
            />
            <Text style={styles.lbl}>Car plate</Text>
            <TextInput
              testID="driver-plate-input"
              value={driverPlate}
              onChangeText={setDriverPlate}
              placeholder="DXB-12345"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              style={styles.modalInput}
            />
            {acceptError ? <Text style={styles.error}>{acceptError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                testID="accept-cancel"
                onPress={() => setAcceptFor(null)}
                style={[styles.modalBtn, styles.rejectBtn]}
              >
                <Text style={styles.rejectTxt}>Cancel</Text>
              </Pressable>
              <Pressable
                testID="accept-confirm"
                onPress={submitAccept}
                disabled={!!actioning}
                style={[styles.modalBtn, styles.acceptBtn]}
              >
                {actioning ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.acceptTxt}>Confirm accept</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  hello: { color: c.muted, fontSize: typography.sm },
  title: { color: c.onSurface, fontSize: typography.xxl, fontWeight: "700" },
  iconBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
  },
  iconBtnTxt: { color: c.onSurfaceSecondary, fontWeight: "600" },
  stats: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
  },
  statVal: { color: c.brandPrimary, fontSize: typography.xxl, fontWeight: "700" },
  statLbl: { color: c.muted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: typography.sm, marginTop: 2 },
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  chipTxt: { color: c.onSurfaceSecondary, fontWeight: "600" },
  chipTxtActive: { color: c.onBrandPrimary },
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
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  customer: { color: c.onSurface, fontSize: typography.lg, fontWeight: "700" },
  customerSub: { color: c.muted, fontSize: typography.sm, marginTop: 2 },
  car: { color: c.brandPrimary, fontSize: typography.lg, fontWeight: "700" },
  price: { color: c.onSurface, fontSize: typography.xl, fontWeight: "700" },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgePending: { backgroundColor: c.warning },
  badgeOk: { backgroundColor: c.success },
  badgeInfo: { backgroundColor: c.info },
  badgeBad: { backgroundColor: c.error },
  badgeTxt: { color: c.onSurface, fontSize: typography.sm, fontWeight: "700" },
  surgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: 2, marginBottom: spacing.sm },
  surgeChip: {
    backgroundColor: c.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  surgeChipTxt: { color: c.onWarning, fontSize: typography.sm, fontWeight: "700" },
  sep: { height: 1, backgroundColor: c.divider, marginVertical: spacing.sm },
  lbl: {
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: typography.sm,
    marginTop: spacing.sm,
  },
  val: { color: c.onSurface, fontSize: typography.lg, marginTop: 2 },
  ratingBlock: { marginTop: spacing.sm },
  ratingStars: { color: c.brandPrimary, fontSize: typography.xl, letterSpacing: 2 },
  ratingComment: { color: c.muted, fontStyle: "italic", marginTop: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  rejectBtn: { backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  rejectTxt: { color: c.onSurfaceTertiary, fontWeight: "700" },
  acceptBtn: { backgroundColor: c.brandPrimary },
  acceptTxt: { color: c.onBrandPrimary, fontWeight: "700" },
  error: {
    marginTop: spacing.md,
    color: c.onError,
    backgroundColor: c.error,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: c.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderColor: c.border,
  },
  modalTitle: { color: c.onSurface, fontSize: typography.xxl, fontWeight: "700" },
  modalSub: { color: c.muted, marginTop: spacing.xs },
  modalInput: {
    backgroundColor: c.surfaceTertiary,
    color: c.onSurface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    marginTop: spacing.xs,
    fontSize: typography.lg,
  },
  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  modalBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
}));
