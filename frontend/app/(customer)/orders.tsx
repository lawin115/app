import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Order } from "@/src/api";
import { colors, makeStyles, radius, spacing, typography } from "@/src/theme";

function statusLabel(s: Order["status"]) {
  if (s === "pending") return "Awaiting company";
  if (s === "accepted") return "Accepted";
  if (s === "completed") return "Completed";
  return "Rejected";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
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
  const [rateFor, setRateFor] = useState<Order | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [rateSubmitting, setRateSubmitting] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

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

  const openRate = (o: Order) => {
    setRateFor(o);
    setStars(5);
    setComment("");
    setRateError(null);
  };

  const submitRate = async () => {
    if (!rateFor) return;
    setRateSubmitting(true);
    setRateError(null);
    try {
      await api.rateOrder(rateFor.id, { rating: stars, comment: comment.trim() || undefined });
      setRateFor(null);
      await load(false);
    } catch (e: any) {
      setRateError(e?.message || "Could not submit rating");
    } finally {
      setRateSubmitting(false);
    }
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
              onRefresh={() => {
                setRefreshing(true);
                load(false);
              }}
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
                : item.status === "completed"
                ? styles.badgeInfo
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

                {item.status === "accepted" || item.status === "completed" ? (
                  <View style={styles.driverCard} testID={`driver-${item.id}`}>
                    <Text style={styles.driverLbl}>Your driver</Text>
                    <Text style={styles.driverName}>{item.driver_name || "—"}</Text>
                    <View style={styles.driverRow}>
                      <View style={styles.plate}>
                        <Text style={styles.plateTxt}>{item.driver_plate || "—"}</Text>
                      </View>
                      {item.driver_phone ? (
                        <Text style={styles.driverPhone}>{item.driver_phone}</Text>
                      ) : null}
                    </View>
                    {item.status === "accepted" ? (
                      <Text style={styles.okBannerTxt}>
                        Your order has been accepted. The driver will meet you at the pickup point.
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {item.status === "completed" && item.rating == null ? (
                  <Pressable
                    testID={`rate-${item.id}`}
                    onPress={() => openRate(item)}
                    style={styles.rateBtn}
                  >
                    <Text style={styles.rateBtnTxt}>Rate your ride</Text>
                  </Pressable>
                ) : null}

                {item.rating != null ? (
                  <View style={styles.ratingSummary} testID={`rating-${item.id}`}>
                    <Text style={styles.ratingStars}>
                      {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                    </Text>
                    {item.rating_comment ? (
                      <Text style={styles.ratingComment}>"{item.rating_comment}"</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {/* Rating modal */}
      <Modal
        visible={!!rateFor}
        animationType="slide"
        transparent
        onRequestClose={() => setRateFor(null)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard} testID="rate-modal">
            <Text style={styles.modalTitle}>How was your ride?</Text>
            <Text style={styles.modalSub}>{rateFor?.car_name} · ${rateFor?.price.toFixed(0)}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  testID={`star-${n}`}
                  onPress={() => setStars(n)}
                  style={styles.starBtn}
                >
                  <Text style={[styles.star, n <= stars && styles.starActive]}>★</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              testID="rate-comment-input"
              value={comment}
              onChangeText={setComment}
              placeholder="Say a few words (optional)"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={styles.modalInput}
            />
            {rateError ? <Text style={styles.error}>{rateError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                testID="rate-cancel"
                onPress={() => setRateFor(null)}
                style={[styles.modalBtn, styles.modalBtnGhost]}
              >
                <Text style={styles.modalBtnGhostTxt}>Cancel</Text>
              </Pressable>
              <Pressable
                testID="rate-submit"
                onPress={submitRate}
                disabled={rateSubmitting}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
              >
                {rateSubmitting ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.modalBtnPrimaryTxt}>Submit</Text>
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
  badgeInfo: { backgroundColor: c.info },
  badgeBad: { backgroundColor: c.error },
  badgeTxt: { color: c.onSurface, fontSize: typography.sm, fontWeight: "700" },
  surgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  surgeChip: {
    backgroundColor: c.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  surgeChipTxt: { color: c.onWarning, fontSize: typography.sm, fontWeight: "700" },
  sep: { height: 1, backgroundColor: c.divider, marginVertical: spacing.sm },
  routeLbl: {
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: typography.sm,
    marginTop: spacing.sm,
  },
  route: { color: c.onSurface, fontSize: typography.lg, marginTop: 2 },
  driverCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.brandTertiary,
    borderWidth: 1,
    borderColor: c.brandPrimary,
  },
  driverLbl: {
    color: c.onBrandTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: typography.sm,
    opacity: 0.9,
  },
  driverName: { color: c.onBrandTertiary, fontSize: typography.xl, fontWeight: "700", marginTop: 2 },
  driverRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  plate: {
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.brandPrimary,
  },
  plateTxt: { color: c.brandPrimary, fontWeight: "700", letterSpacing: 1.2 },
  driverPhone: { color: c.onBrandTertiary, fontSize: typography.base },
  okBannerTxt: { color: c.onBrandTertiary, marginTop: spacing.sm, fontSize: typography.base },
  rateBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
  },
  rateBtnTxt: { color: c.onBrandPrimary, fontWeight: "700" },
  ratingSummary: { marginTop: spacing.md },
  ratingStars: { color: c.brandPrimary, fontSize: typography.xl, letterSpacing: 2 },
  ratingComment: { color: c.muted, fontStyle: "italic", marginTop: spacing.xs },
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
    gap: spacing.sm,
  },
  modalTitle: { color: c.onSurface, fontSize: typography.xxl, fontWeight: "700" },
  modalSub: { color: c.muted },
  starsRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: spacing.md },
  starBtn: { padding: spacing.xs },
  star: { fontSize: 44, color: c.surfaceTertiary },
  starActive: { color: c.brandPrimary },
  modalInput: {
    backgroundColor: c.surfaceTertiary,
    color: c.onSurface,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: c.border,
  },
  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  modalBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
  modalBtnGhost: { backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  modalBtnGhostTxt: { color: c.onSurfaceTertiary, fontWeight: "700" },
  modalBtnPrimary: { backgroundColor: c.brandPrimary },
  modalBtnPrimaryTxt: { color: c.onBrandPrimary, fontWeight: "700" },
}));
