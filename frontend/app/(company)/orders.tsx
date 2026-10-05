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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Hourglass,
  CheckCircle,
  XCircle,
  Star,
  Lightning,
  MapPin,
  Flag,
  IdentificationBadge,
  Phone,
  IdentificationCard,
  CarProfile,
  NotePencil,
  Buildings,
} from "phosphor-react-native";

import { api, Order, OrderStatus } from "@/src/api";
import {
  colors,
  fontFamily,
  makeStyles,
  radius,
  shadow,
  spacing,
  typography,
} from "@/src/theme";

type Filter = "all" | Exclude<OrderStatus, "completed">;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function statusMeta(s: Order["status"]) {
  if (s === "pending") return { label: "Pending", color: colors.warning, Icon: Hourglass };
  if (s === "accepted") return { label: "Accepted", color: colors.success, Icon: CheckCircle };
  if (s === "completed") return { label: "Completed", color: colors.info, Icon: CheckCircle };
  return { label: "Rejected", color: colors.error, Icon: XCircle };
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function CompanyOrders() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [filter, setFilter] = useState<Filter>("pending");
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<{ avg_rating: number | null; rated_count: number }>({ avg_rating: null, rated_count: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [acceptFor, setAcceptFor] = useState<Order | null>(null);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverPlate, setDriverPlate] = useState("");
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
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
  }, [filter]);

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
    try { await api.rejectOrder(id); await load(false); }
    catch (e: any) { setError(e?.message || "Could not reject"); }
    finally { setActioning(null); }
  };

  const complete = async (id: string) => {
    setActioning(id);
    try { await api.completeOrder(id); await load(false); }
    catch (e: any) { setError(e?.message || "Could not complete"); }
    finally { setActioning(null); }
  };

  const pendingCount = useMemo(() => orders.filter((o) => o.status === "pending").length, [orders]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="dashboard-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Fleet dashboard</Text>
          <Text style={styles.title}>Orders</Text>
        </View>
        <View style={styles.companyBadge}>
          <Buildings size={20} color={colors.onBrandPrimary} weight="fill" />
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.statCard}>
          <Hourglass size={20} color={colors.warning} weight="fill" />
          <Text style={styles.statVal}>{pendingCount}</Text>
          <Text style={styles.statLbl}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <CheckCircle size={20} color={colors.success} weight="fill" />
          <Text style={styles.statVal}>{orders.length}</Text>
          <Text style={styles.statLbl}>In view</Text>
        </View>
        <View style={styles.statCard} testID="rating-stats">
          <Star size={20} color={colors.brandPrimary} weight="fill" />
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
            <View style={styles.empty} testID="dashboard-empty">
              <View style={styles.emptyIcon}>
                <Hourglass size={44} color={colors.brandPrimary} weight="duotone" />
              </View>
              <Text style={styles.emptyTitle}>Nothing here</Text>
              <Text style={styles.emptyBody}>Pending orders show up here instantly.</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          }
          renderItem={({ item }) => {
            const meta = statusMeta(item.status);
            return (
              <View style={styles.card} testID={`order-${item.id}`}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customer}>{item.customer_name}</Text>
                    <Text style={styles.customerSub}>{item.customer_email}</Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: meta.color }]}>
                    <meta.Icon size={14} color={colors.onBrandPrimary} weight="fill" />
                    <Text style={styles.statusChipTxt}>{meta.label}</Text>
                  </View>
                </View>

                <View style={styles.priceRow}>
                  <View style={styles.carPill}>
                    <CarProfile size={16} color={colors.brandPrimary} weight="fill" />
                    <Text style={styles.carPillTxt}>{item.car_name}</Text>
                  </View>
                  <Text style={styles.price}>${item.price.toFixed(0)}</Text>
                </View>

                {item.surge_reasons && item.surge_reasons.length > 0 ? (
                  <View style={styles.surgeRow}>
                    {item.surge_reasons.map((r) => (
                      <View key={r} style={styles.surgeChip}>
                        <Lightning size={12} color={colors.onWarning} weight="fill" />
                        <Text style={styles.surgeChipTxt}>{r}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.routeBlock}>
                  <View style={styles.routeLine}>
                    <MapPin size={16} color={colors.brandPrimary} weight="fill" />
                    <Text style={styles.routeTxt} numberOfLines={2}>{item.pickup_location}</Text>
                  </View>
                  <View style={styles.routeDots} />
                  <View style={styles.routeLine}>
                    <Flag size={16} color={colors.success} weight="fill" />
                    <Text style={styles.routeTxt} numberOfLines={2}>{item.dropoff_location}</Text>
                  </View>
                </View>

                <Text style={styles.when}>{formatDate(item.scheduled_at)}</Text>

                {item.notes ? (
                  <View style={styles.noteBlock}>
                    <NotePencil size={14} color={colors.muted} />
                    <Text style={styles.noteTxt}>{item.notes}</Text>
                  </View>
                ) : null}

                {item.driver_name ? (
                  <View style={styles.driverCard}>
                    <IdentificationBadge size={20} color={colors.onBrandTertiary} weight="fill" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.driverName}>{item.driver_name}</Text>
                      <View style={styles.driverMetaRow}>
                        <IdentificationCard size={14} color={colors.onBrandTertiary} weight="fill" />
                        <Text style={styles.driverMeta}>{item.driver_plate}</Text>
                        {item.driver_phone ? (
                          <>
                            <Phone size={14} color={colors.onBrandTertiary} />
                            <Text style={styles.driverMeta}>{item.driver_phone}</Text>
                          </>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ) : null}

                {item.rating != null ? (
                  <View style={styles.ratingBlock}>
                    <View style={{ flexDirection: "row", gap: 2 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          size={16}
                          color={colors.brandPrimary}
                          weight={n <= (item.rating ?? 0) ? "fill" : "regular"}
                        />
                      ))}
                    </View>
                    {item.rating_comment ? (
                      <Text style={styles.ratingComment}>&ldquo;{item.rating_comment}&rdquo;</Text>
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
                      <XCircle size={18} color={colors.onSurfaceTertiary} weight="bold" />
                      <Text style={styles.rejectTxt}>Reject</Text>
                    </Pressable>
                    <Pressable
                      testID={`accept-${item.id}`}
                      disabled={actioning === item.id}
                      onPress={() => openAccept(item)}
                      style={[styles.actionBtn, styles.acceptBtn]}
                    >
                      <CheckCircle size={18} color={colors.onBrandPrimary} weight="bold" />
                      <Text style={styles.acceptTxt}>Accept</Text>
                    </Pressable>
                  </View>
                ) : null}

                {item.status === "accepted" ? (
                  <Pressable
                    testID={`complete-${item.id}`}
                    disabled={actioning === item.id}
                    onPress={() => complete(item.id)}
                    style={[styles.completeBtn]}
                  >
                    {actioning === item.id ? (
                      <ActivityIndicator color={colors.onBrandPrimary} />
                    ) : (
                      <>
                        <CheckCircle size={18} color={colors.onBrandPrimary} weight="bold" />
                        <Text style={styles.acceptTxt}>Mark completed</Text>
                      </>
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
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%" }}
          >
            <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]} testID="accept-modal">
              <View style={styles.modalGrabber} />
              <Text style={styles.modalTitle}>Assign a driver</Text>
              <Text style={styles.modalSub}>
                {acceptFor?.customer_name} · {acceptFor?.car_name} · ${acceptFor?.price.toFixed(0)}
              </Text>

              <Text style={styles.modalLbl}>Driver name</Text>
              <View style={styles.modalInputRow}>
                <IdentificationBadge size={18} color={colors.muted} />
                <TextInput
                  testID="driver-name-input"
                  value={driverName}
                  onChangeText={setDriverName}
                  placeholder="e.g. Khaled A."
                  placeholderTextColor={colors.muted}
                  style={styles.modalInput}
                />
              </View>

              <Text style={styles.modalLbl}>Driver phone (optional)</Text>
              <View style={styles.modalInputRow}>
                <Phone size={18} color={colors.muted} />
                <TextInput
                  testID="driver-phone-input"
                  value={driverPhone}
                  onChangeText={setDriverPhone}
                  placeholder="+971 50 123 4567"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  style={styles.modalInput}
                />
              </View>

              <Text style={styles.modalLbl}>Car plate</Text>
              <View style={styles.modalInputRow}>
                <IdentificationCard size={18} color={colors.muted} />
                <TextInput
                  testID="driver-plate-input"
                  value={driverPlate}
                  onChangeText={setDriverPlate}
                  placeholder="DXB-12345"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  style={styles.modalInput}
                />
              </View>

              {acceptError ? <Text style={styles.error}>{acceptError}</Text> : null}

              <View style={styles.modalActions}>
                <Pressable
                  testID="accept-cancel"
                  onPress={() => setAcceptFor(null)}
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                >
                  <Text style={styles.modalBtnGhostTxt}>Cancel</Text>
                </Pressable>
                <Pressable
                  testID="accept-confirm"
                  onPress={submitAccept}
                  disabled={!!actioning}
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                >
                  {actioning ? (
                    <ActivityIndicator color={colors.onBrandPrimary} />
                  ) : (
                    <Text style={styles.modalBtnPrimaryTxt}>Confirm accept</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
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
  companyBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceSecondary,
    ...shadow.sm,
    gap: 4,
  },
  statVal: {
    color: c.onSurface,
    fontSize: typography.xxl,
    fontWeight: "700",
    fontFamily: fontFamily.display,
    marginTop: 2,
  },
  statLbl: {
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: typography.sm - 1,
    fontFamily: fontFamily.text,
    fontWeight: "600",
  },
  filterRow: {
    paddingHorizontal: spacing.xl,
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
  chipTxt: {
    color: c.onSurfaceSecondary,
    fontWeight: "600",
    fontFamily: fontFamily.text,
  },
  chipTxtActive: { color: c.onBrandPrimary },
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
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  customer: {
    color: c.onSurface,
    fontSize: typography.lg,
    fontWeight: "700",
    fontFamily: fontFamily.text,
  },
  customerSub: { color: c.muted, fontSize: typography.sm, marginTop: 2, fontFamily: fontFamily.text },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  statusChipTxt: {
    color: c.onBrandPrimary,
    fontSize: typography.sm,
    fontWeight: "700",
    fontFamily: fontFamily.text,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
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
    fontSize: typography.xxxl,
    fontWeight: "700",
    fontFamily: fontFamily.display,
  },
  surgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: spacing.sm },
  surgeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  surgeChipTxt: { color: c.onWarning, fontSize: typography.sm - 1, fontWeight: "700", fontFamily: fontFamily.text },
  routeBlock: { marginTop: spacing.md },
  routeLine: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  routeTxt: { flex: 1, color: c.onSurface, fontSize: typography.base, fontFamily: fontFamily.text },
  routeDots: {
    marginStart: 8,
    width: 1,
    height: 16,
    borderStartWidth: 1,
    borderColor: c.borderStrong,
    borderStyle: "dashed",
    marginVertical: 4,
  },
  when: { color: c.muted, fontSize: typography.sm, marginTop: spacing.sm, fontFamily: fontFamily.text },
  noteBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.divider,
    flexDirection: "row",
    gap: spacing.sm,
  },
  noteTxt: { flex: 1, color: c.onSurfaceTertiary, fontSize: typography.sm, fontFamily: fontFamily.text },
  driverCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.brandTertiary,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  driverName: {
    color: c.onSurface,
    fontSize: typography.base,
    fontWeight: "700",
    fontFamily: fontFamily.text,
  },
  driverMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" },
  driverMeta: { color: c.onBrandTertiary, fontSize: typography.sm, fontFamily: fontFamily.text, fontWeight: "600" },
  ratingBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.divider,
    gap: spacing.xs,
  },
  ratingComment: { color: c.muted, fontStyle: "italic", fontFamily: fontFamily.text },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  rejectBtn: { backgroundColor: c.surfaceTertiary },
  rejectTxt: { color: c.onSurfaceTertiary, fontWeight: "700", fontFamily: fontFamily.text },
  acceptBtn: { backgroundColor: c.brandPrimary, ...shadow.sm },
  acceptTxt: { color: c.onBrandPrimary, fontWeight: "700", fontFamily: fontFamily.text },
  completeBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: c.success,
    ...shadow.sm,
  },
  error: {
    marginTop: spacing.md,
    color: c.onError,
    backgroundColor: c.error,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.text,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: c.surfaceSecondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.lg,
  },
  modalGrabber: {
    alignSelf: "center",
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: c.onSurface,
    fontSize: typography.xxl,
    fontWeight: "600",
    fontFamily: fontFamily.display,
  },
  modalSub: { color: c.muted, marginTop: 2, fontFamily: fontFamily.text },
  modalLbl: {
    color: c.muted,
    fontSize: typography.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontFamily: fontFamily.text,
    fontWeight: "600",
  },
  modalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  modalInput: {
    flex: 1,
    paddingVertical: spacing.md,
    color: c.onSurface,
    fontSize: typography.lg,
    fontFamily: fontFamily.text,
  },
  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  modalBtnGhost: { backgroundColor: c.surfaceTertiary },
  modalBtnGhostTxt: { color: c.onSurfaceTertiary, fontWeight: "700", fontFamily: fontFamily.text },
  modalBtnPrimary: { backgroundColor: c.brandPrimary, ...shadow.sm },
  modalBtnPrimaryTxt: { color: c.onBrandPrimary, fontWeight: "700", fontFamily: fontFamily.text },
}));
