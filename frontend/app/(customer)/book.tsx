import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MapPin,
  Flag,
  NotePencil,
  CheckCircle,
  Lightning,
  CarProfile,
  ArrowsDownUp,
} from "phosphor-react-native";

import { useAuth } from "@/src/auth";
import { api, CarType, PricingQuote } from "@/src/api";
import { MapPicker, Pin } from "@/src/components/map-picker";
import { DateTimeField } from "@/src/components/datetime-field";
import {
  colors,
  fontFamily,
  makeStyles,
  radius,
  shadow,
  spacing,
  typography,
} from "@/src/theme";

function defaultWhen() {
  return new Date(Date.now() + 60 * 60 * 1000);
}

export default function Book() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();

  const [cars, setCars] = useState<CarType[]>([]);
  const [selectedCar, setSelectedCar] = useState<string>("vip");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupPin, setPickupPin] = useState<Pin>(null);
  const [dropoffPin, setDropoffPin] = useState<Pin>(null);
  const [when, setWhen] = useState<Date>(() => defaultWhen());
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<PricingQuote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingCars, setLoadingCars] = useState(true);

  useEffect(() => {
    api.listCars()
      .then((list) => {
        setCars(list);
        if (list.length && !list.some((c) => c.id === selectedCar)) {
          setSelectedCar(list[0].id);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingCars(false));
  }, []);

  const activeCar = cars.find((c) => c.id === selectedCar);

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    if (!selectedCar) {
      setQuote(null);
      return;
    }
    quoteTimer.current = setTimeout(() => {
      api.pricingQuote({
        car_id: selectedCar,
        pickup_location: pickup,
        dropoff_location: dropoff,
        scheduled_at: when.toISOString(),
      })
        .then(setQuote)
        .catch(() => setQuote(null));
    }, 350);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [selectedCar, pickup, dropoff, when]);

  const swap = () => {
    setPickup(dropoff);
    setDropoff(pickup);
    const pp = pickupPin;
    setPickupPin(dropoffPin);
    setDropoffPin(pp);
  };

  const submit = async () => {
    setError(null);
    if (!pickup.trim() || !dropoff.trim()) {
      setError("Please enter pickup and drop-off locations.");
      return;
    }
    setSubmitting(true);
    try {
      const order = await api.createOrder({
        car_id: selectedCar,
        pickup_location: pickup.trim(),
        dropoff_location: dropoff.trim(),
        pickup_lat: pickupPin?.lat ?? null,
        pickup_lng: pickupPin?.lng ?? null,
        dropoff_lat: dropoffPin?.lat ?? null,
        dropoff_lng: dropoffPin?.lng ?? null,
        scheduled_at: when.toISOString(),
        notes: notes.trim() || undefined,
      });
      setPickup("");
      setDropoff("");
      setPickupPin(null);
      setDropoffPin(null);
      setNotes("");
      router.push({ pathname: "/(customer)/orders", params: { highlight: order.id } });
    } catch (e: any) {
      setError(e?.message || "Could not place the request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="book-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</Text>
          <Text style={styles.title}>Where to?</Text>
        </View>
        <View style={styles.logoDot}>
          <CarProfile size={22} color={colors.onBrandPrimary} weight="fill" />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 180 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLbl}>Vehicle class</Text>
          {loadingCars ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.lg }} />
          ) : (
            <FlatList
              horizontal
              data={cars}
              keyExtractor={(c) => c.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carRow}
              renderItem={({ item }) => {
                const active = selectedCar === item.id;
                return (
                  <Pressable
                    testID={`car-${item.id}`}
                    onPress={() => setSelectedCar(item.id)}
                    style={[styles.carCard, active && styles.carCardActive]}
                  >
                    <Image source={item.image} style={styles.carImg} contentFit="cover" />
                    <LinearGradient
                      colors={["transparent", "rgba(24,23,21,0.9)"]}
                      style={styles.carScrim}
                    />
                    <View style={styles.carBody}>
                      <Text style={styles.carName}>{item.name}</Text>
                      <Text style={styles.carPrice}>from ${item.price.toFixed(0)}</Text>
                    </View>
                    {active ? (
                      <View style={styles.carBadge}>
                        <CheckCircle size={16} color={colors.onBrandPrimary} weight="fill" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />
          )}
          {activeCar ? (
            <Text style={styles.carDesc} testID="car-description">{activeCar.description}</Text>
          ) : null}

          <Text style={styles.sectionLbl}>Pin on map</Text>
          <View style={styles.mapWrap}>
            <MapPicker
              pickup={pickupPin}
              dropoff={dropoffPin}
              onChange={({ pickup: p, dropoff: d }) => {
                setPickupPin(p);
                setDropoffPin(d);
              }}
              onAddressResolved={(which, address) => {
                if (which === "pickup") setPickup(address);
                else setDropoff(address);
              }}
            />
          </View>

          <Text style={styles.sectionLbl}>Route</Text>
          <View style={styles.routeCard}>
            <View style={styles.routeRow}>
              <View style={styles.iconPad}>
                <MapPin size={20} color={colors.brandPrimary} weight="fill" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLbl}>Pickup{pickupPin ? " · pinned" : ""}</Text>
                <TextInput
                  testID="pickup-input"
                  value={pickup}
                  onChangeText={setPickup}
                  placeholder="Pickup address"
                  placeholderTextColor={colors.muted}
                  style={styles.routeInput}
                />
              </View>
            </View>
            <View style={styles.swapWrap}>
              <View style={styles.routeLine} />
              <Pressable testID="swap-button" onPress={swap} style={styles.swapBtn}>
                <ArrowsDownUp size={16} color={colors.brandPrimary} weight="bold" />
              </Pressable>
              <View style={styles.routeLine} />
            </View>
            <View style={styles.routeRow}>
              <View style={styles.iconPad}>
                <Flag size={20} color={colors.success} weight="fill" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLbl}>Drop-off{dropoffPin ? " · pinned" : ""}</Text>
                <TextInput
                  testID="dropoff-input"
                  value={dropoff}
                  onChangeText={setDropoff}
                  placeholder="Destination address"
                  placeholderTextColor={colors.muted}
                  style={styles.routeInput}
                />
              </View>
            </View>
          </View>

          <Text style={styles.sectionLbl}>When</Text>
          <View style={styles.whenRow}>
            <DateTimeField
              testID="date-input"
              mode="date"
              value={when}
              onChange={(d) => {
                const next = new Date(when);
                next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                setWhen(next);
              }}
            />
            <DateTimeField
              testID="time-input"
              mode="time"
              value={when}
              onChange={(d) => {
                const next = new Date(when);
                next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                setWhen(next);
              }}
            />
          </View>

          <Text style={styles.sectionLbl}>Notes</Text>
          <View style={styles.notesCard}>
            <NotePencil size={20} color={colors.brandPrimary} weight="fill" />
            <TextInput
              testID="notes-input"
              value={notes}
              onChangeText={setNotes}
              placeholder="Flight no., luggage, special requests…"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={styles.notesInput}
            />
          </View>

          {error ? (
            <Text style={styles.error} testID="book-error">{error}</Text>
          ) : null}
        </ScrollView>

        {/* Sticky bottom CTA with price */}
        <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]} testID="price-summary">
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaBarLbl}>{activeCar?.name ?? "—"}</Text>
            {quote && quote.multiplier > 1 ? (
              <View style={styles.surgeRow}>
                {quote.reasons.map((r) => (
                  <View key={r} style={styles.surgeChip} testID={`surge-${r}`}>
                    <Lightning size={12} color={colors.onWarning} weight="fill" />
                    <Text style={styles.surgeChipTxt}>{r}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.ctaBarSub}>Estimated fare</Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {quote && quote.multiplier > 1 ? (
              <Text style={styles.ctaBarBase}>${quote.base.toFixed(0)}</Text>
            ) : null}
            <Text style={styles.ctaBarPrice}>
              {quote ? `$${quote.total.toFixed(0)}` : activeCar ? `$${activeCar.price.toFixed(0)}` : "—"}
            </Text>
          </View>
          <Pressable
            testID="request-ride-button"
            disabled={submitting}
            onPress={submit}
            style={({ pressed }) => [styles.cta, (pressed || submitting) && styles.ctaPressed]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.ctaTxt}>Book</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    paddingBottom: spacing.lg,
    gap: spacing.sm,
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
    letterSpacing: 0.5,
  },
  logoDot: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  sectionLbl: {
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: typography.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    fontFamily: fontFamily.text,
    fontWeight: "700",
  },
  carRow: { gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: 2 },
  carCard: {
    width: 180,
    height: 220,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: c.surfaceSecondary,
    ...shadow.md,
    flexShrink: 0,
  },
  carCardActive: { borderWidth: 2, borderColor: c.brandPrimary },
  carImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  carScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
  carBody: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md },
  carName: {
    color: c.onSurfaceInverse,
    fontSize: typography.xl,
    fontWeight: "700",
    fontFamily: fontFamily.display,
    letterSpacing: 0.3,
  },
  carPrice: {
    color: c.brandSecondary,
    fontSize: typography.lg,
    fontWeight: "700",
    marginTop: 2,
    fontFamily: fontFamily.text,
  },
  carBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  carDesc: {
    color: c.onSurfaceTertiary,
    marginTop: spacing.md,
    fontSize: typography.base,
    fontFamily: fontFamily.text,
    lineHeight: 20,
  },
  mapWrap: { ...shadow.sm, borderRadius: radius.lg },
  routeCard: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconPad: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  routeLbl: {
    color: c.muted,
    fontSize: typography.sm,
    fontFamily: fontFamily.text,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "600",
  },
  routeInput: {
    color: c.onSurface,
    fontSize: typography.lg,
    paddingVertical: 4,
    fontFamily: fontFamily.text,
  },
  swapWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingStart: 48,
  },
  routeLine: { flex: 1, height: 1, backgroundColor: c.divider },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: c.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.brandSecondary,
  },
  whenRow: { flexDirection: "row", gap: spacing.md },
  whenCard: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  whenHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  whenLbl: {
    color: c.muted,
    fontSize: typography.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: fontFamily.text,
    fontWeight: "600",
  },
  whenInput: { color: c.onSurface, fontSize: typography.lg, fontFamily: fontFamily.text },
  notesCard: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
    ...shadow.sm,
  },
  notesInput: {
    flex: 1,
    color: c.onSurface,
    fontSize: typography.lg,
    fontFamily: fontFamily.text,
    minHeight: 80,
    textAlignVertical: "top",
  },
  error: {
    color: c.onError,
    backgroundColor: c.error,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    fontFamily: fontFamily.text,
  },
  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: c.surfaceSecondary,
    borderTopWidth: 1,
    borderColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadow.lg,
  },
  ctaBarLbl: {
    color: c.onSurface,
    fontSize: typography.base,
    fontWeight: "700",
    fontFamily: fontFamily.text,
  },
  ctaBarSub: {
    color: c.muted,
    fontSize: typography.sm,
    marginTop: 2,
    fontFamily: fontFamily.text,
  },
  ctaBarBase: {
    color: c.muted,
    fontSize: typography.sm,
    textDecorationLine: "line-through",
    fontFamily: fontFamily.text,
  },
  ctaBarPrice: {
    color: c.brandPrimary,
    fontSize: typography.xxl,
    fontWeight: "700",
    fontFamily: fontFamily.display,
  },
  surgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  surgeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  surgeChipTxt: {
    color: c.onWarning,
    fontSize: typography.sm - 1,
    fontWeight: "700",
    fontFamily: fontFamily.text,
  },
  cta: {
    backgroundColor: c.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 92,
    ...shadow.sm,
  },
  ctaPressed: { opacity: 0.9 },
  ctaTxt: {
    color: c.onBrandPrimary,
    fontWeight: "700",
    fontSize: typography.lg,
    fontFamily: fontFamily.text,
    letterSpacing: 0.3,
  },
}));
