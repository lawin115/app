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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Clock,
  CheckCircle,
  XCircle,
  Hourglass,
  MapPin,
  Flag,
  Lightning,
  Star,
  IdentificationBadge,
  Phone,
  CarProfile,
  NotePencil,
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

function statusMeta(s: Order["status"]) {
  if (s === "pending") return { label: "Awaiting", color: colors.warning, Icon: Hourglass };
  if (s === "accepted") return { label: "Accepted", color: colors.success, Icon: CheckCircle };
  if (s === "completed") return { label: "Completed", color: colors.info, Icon: CheckCircle };
  return { label: "Rejected", color: colors.error, Icon: XCircle };
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
        <Text style={styles.eyebrow}>Your journeys</Text>
        <Text style={styles.title}>My rides</Text>
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
              onRefresh={() => {
                setRefreshing(true);
                load(false);
              }}
              tintColor={colors.brandPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty} testID="orders-empty">
              <View style={styles.emptyIcon}>
                <Clock size={44} color={colors.brandPrimary} weight="duotone" />
              </View>
              <Text style={styles.emptyTitle}>No rides yet</Text>
              <Text style={styles.emptyBody}>Your booked rides will appear here.</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          }
          renderItem={({ item }) => {
            const isHighlight = params.highlight === item.id;
            const meta = statusMeta(item.status);
            return (
              <View
                testID={`order-row-${item.id}`}
                style={[styles.card, isHighlight && styles.cardHighlight]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.carPill}>
                    <CarProfile size={16} color={colors.brandPrimary} weight="fill" />
                    <Text style={styles.carPillTxt}>{item.car_name}</Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: meta.color }]}>
                    <meta.Icon size={14} color={colors.onBrandPrimary} weight="fill" />
                    <Text style={styles.statusChipTxt}>{meta.label}</Text>
                  </View>
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.price}>${item.price.toFixed(0)}</Text>
                  <Text style={styles.when}>{formatDate(item.scheduled_at)}</Text>
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

                {item.notes ? (
                  <View style={styles.noteBlock}>
                    <NotePencil size={14} color={colors.muted} />
                    <Text style={styles.noteTxt}>{item.notes}</Text>
                  </View>
                ) : null}

                {(item.status === "accepted" || item.status === "completed") && item.driver_name ? (
                  <View style={styles.driverCard} testID={`driver-${item.id}`}>
                    <View style={styles.driverAvatar}>
                      <IdentificationBadge size={24} color={colors.onBrandPrimary} weight="fill" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.driverLbl}>Your driver</Text>
                      <Text style={styles.driverName}>{item.driver_name}</Text>
                      <View style={styles.driverMetaRow}>
                        <View style={styles.plate}>
                          <Text style={styles.plateTxt}>{item.driver_plate}</Text>
                        </View>
                        {item.driver_phone ? (
                          <View style={styles.driverPhoneRow}>
                            <Phone size={14} color={colors.onSurfaceTertiary} />
                            <Text style={styles.driverPhone}>{item.driver_phone}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ) : null}

                {item.status === "completed" && item.rating == null ? (
                  <Pressable
                    testID={`rate-${item.id}`}
                    onPress={() => openRate(item)}
                    style={({ pressed }) => [styles.rateBtn, pressed && { opacity: 0.9 }]}
                  >
                    <Star size={18} color={colors.onBrandPrimary} weight="fill" />
                    <Text style={styles.rateBtnTxt}>Rate your ride</Text>
                  </Pressable>
                ) : null}

                {item.rating != null ? (
                  <View style={styles.ratingBlock} testID={`rating-${item.id}`}>
                    <View style={{ flexDirection: "row", gap: 2 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          size={18}
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
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={!!rateFor}
        animationType="slide"
        transparent
        onRequestClose={() => setRateFor(null)}
      >
        <View style={styles.modalScrim}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%" }}
          >
            <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]} testID="rate-modal">
              <View style={styles.modalGrabber} />
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
                    <Star
                      size={44}
                      color={colors.brandPrimary}
                      weight={n <= stars ? "fill" : "regular"}
                    />
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
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
    letterSpacing: 0.5,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
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
  cardHighlight: { borderWidth: 2, borderColor: c.brandPrimary },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
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
  priceRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  price: {
    color: c.onSurface,
    fontSize: typography.xxxl,
    fontWeight: "700",
    fontFamily: fontFamily.display,
  },
  when: { color: c.muted, fontSize: typography.sm, fontFamily: fontFamily.text },
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
    gap: spacing.md,
    alignItems: "center",
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  driverLbl: {
    color: c.onBrandTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: typography.sm - 1,
    fontFamily: fontFamily.text,
    fontWeight: "700",
  },
  driverName: {
    color: c.onSurface,
    fontSize: typography.lg,
    fontWeight: "700",
    marginTop: 2,
    fontFamily: fontFamily.text,
  },
  driverMetaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4, flexWrap: "wrap" },
  plate: {
    backgroundColor: c.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.brandSecondary,
  },
  plateTxt: {
    color: c.onBrandTertiary,
    fontWeight: "800",
    letterSpacing: 1.2,
    fontFamily: fontFamily.text,
    fontSize: typography.sm,
  },
  driverPhoneRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  driverPhone: { color: c.onSurfaceTertiary, fontSize: typography.sm, fontFamily: fontFamily.text },
  rateBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    ...shadow.sm,
  },
  rateBtnTxt: {
    color: c.onBrandPrimary,
    fontWeight: "700",
    fontFamily: fontFamily.text,
    fontSize: typography.lg,
  },
  ratingBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.divider,
    gap: spacing.xs,
  },
  ratingComment: { color: c.muted, fontStyle: "italic", fontFamily: fontFamily.text },
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
    gap: spacing.sm,
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
  modalSub: { color: c.muted, fontFamily: fontFamily.text },
  starsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  starBtn: { padding: spacing.xs },
  modalInput: {
    backgroundColor: c.surfaceTertiary,
    color: c.onSurface,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: "top",
    fontFamily: fontFamily.text,
  },
  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
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
