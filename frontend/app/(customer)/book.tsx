import { useEffect, useMemo, useState } from "react";
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

import { useAuth } from "@/src/auth";
import { api, CarType } from "@/src/api";
import { colors, makeStyles, radius, spacing, typography } from "@/src/theme";

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function defaultWhen() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export default function Book() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [cars, setCars] = useState<CarType[]>([]);
  const [selectedCar, setSelectedCar] = useState<string>("vip");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const initialWhen = useMemo(defaultWhen, []);
  const [date, setDate] = useState(initialWhen.date);
  const [time, setTime] = useState(initialWhen.time);
  const [notes, setNotes] = useState("");
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

  const submit = async () => {
    setError(null);
    if (!pickup.trim() || !dropoff.trim()) {
      setError("Please enter pickup and drop-off locations.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      setError("Date must be YYYY-MM-DD and time HH:MM.");
      return;
    }
    const scheduled = new Date(`${date}T${time}:00`);
    if (isNaN(scheduled.getTime())) {
      setError("Invalid date / time.");
      return;
    }
    setSubmitting(true);
    try {
      const order = await api.createOrder({
        car_id: selectedCar,
        pickup_location: pickup.trim(),
        dropoff_location: dropoff.trim(),
        scheduled_at: scheduled.toISOString(),
        notes: notes.trim() || undefined,
      });
      setPickup("");
      setDropoff("");
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
          <Text style={styles.hello}>Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</Text>
          <Text style={styles.title}>Book your ride</Text>
        </View>
        <Pressable
          testID="my-rides-button"
          onPress={() => router.push("/(customer)/orders")}
          style={styles.iconBtn}
        >
          <Text style={styles.iconBtnTxt}>My rides</Text>
        </Pressable>
        <Pressable testID="logout-button" onPress={logout} style={styles.iconBtn}>
          <Text style={styles.iconBtnTxt}>Logout</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Car selector */}
          <Text style={styles.section}>Choose a car</Text>
          {loadingCars ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.lg }} />
          ) : (
            <FlatList
              horizontal
              data={cars}
              keyExtractor={(c) => c.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carRow}
              renderItem={({ item }) => (
                <Pressable
                  testID={`car-${item.id}`}
                  onPress={() => setSelectedCar(item.id)}
                  style={[styles.carCard, selectedCar === item.id && styles.carCardActive]}
                >
                  <Image source={item.image} style={styles.carImg} contentFit="cover" />
                  <LinearGradient
                    colors={["transparent", "rgba(9,9,11,0.95)"]}
                    style={styles.carScrim}
                  />
                  <View style={styles.carBody}>
                    <Text style={styles.carName}>{item.name}</Text>
                    <Text style={styles.carPrice}>${item.price.toFixed(0)}</Text>
                  </View>
                  {selectedCar === item.id ? (
                    <View style={styles.carBadge}>
                      <Text style={styles.carBadgeTxt}>Selected</Text>
                    </View>
                  ) : null}
                </Pressable>
              )}
            />
          )}

          {activeCar ? (
            <Text style={styles.carDesc} testID="car-description">
              {activeCar.description}
            </Text>
          ) : null}

          {/* Locations */}
          <Text style={styles.section}>Route</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pickup</Text>
            <TextInput
              testID="pickup-input"
              value={pickup}
              onChangeText={setPickup}
              placeholder="Pickup address"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Drop-off</Text>
            <TextInput
              testID="dropoff-input"
              value={dropoff}
              onChangeText={setDropoff}
              placeholder="Destination address"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>

          {/* Date & time */}
          <Text style={styles.section}>When</Text>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Date</Text>
              <TextInput
                testID="date-input"
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={styles.input}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Time</Text>
              <TextInput
                testID="time-input"
                value={time}
                onChangeText={setTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={styles.input}
              />
            </View>
          </View>

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              testID="notes-input"
              value={notes}
              onChangeText={setNotes}
              placeholder="Flight no., luggage, special requests…"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.inputMulti]}
            />
          </View>

          {/* Price summary */}
          <View style={styles.summary} testID="price-summary">
            <View>
              <Text style={styles.summaryLabel}>Estimated fare</Text>
              <Text style={styles.summaryCar}>{activeCar?.name ?? "—"}</Text>
            </View>
            <Text style={styles.summaryPrice}>
              {activeCar ? `$${activeCar.price.toFixed(2)}` : "—"}
            </Text>
          </View>

          {error ? (
            <Text style={styles.error} testID="book-error">{error}</Text>
          ) : null}

          <Pressable
            testID="request-ride-button"
            disabled={submitting}
            onPress={submit}
            style={({ pressed }) => [styles.cta, (pressed || submitting) && styles.ctaPressed]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.ctaTxt}>Request ride</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: spacing.md,
    gap: spacing.sm,
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
  iconBtnTxt: { color: c.onSurfaceSecondary, fontSize: typography.sm, fontWeight: "600" },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  section: {
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: typography.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  carRow: { gap: spacing.md, paddingVertical: spacing.xs, paddingHorizontal: 2 },
  carCard: {
    width: 180,
    height: 220,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    flexShrink: 0,
  },
  carCardActive: { borderColor: c.brandPrimary, borderWidth: 2 },
  carImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  carScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
  carBody: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md },
  carName: { color: c.onSurface, fontSize: typography.xl, fontWeight: "700" },
  carPrice: { color: c.brandPrimary, fontSize: typography.lg, fontWeight: "700", marginTop: 2 },
  carBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: c.brandPrimary,
  },
  carBadgeTxt: { color: c.onBrandPrimary, fontSize: typography.sm, fontWeight: "700" },
  carDesc: { color: c.muted, marginTop: spacing.md, fontSize: typography.base },
  inputGroup: { marginBottom: spacing.md },
  label: {
    color: c.muted,
    fontSize: typography.sm,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: c.surfaceSecondary,
    color: c.onSurface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    fontSize: typography.lg,
  },
  inputMulti: { minHeight: 90, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: spacing.md },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
  },
  summaryLabel: { color: c.muted, fontSize: typography.sm, textTransform: "uppercase", letterSpacing: 0.8 },
  summaryCar: { color: c.onSurface, fontSize: typography.lg, fontWeight: "700", marginTop: 2 },
  summaryPrice: { color: c.brandPrimary, fontSize: typography.xxl, fontWeight: "700" },
  cta: {
    marginTop: spacing.lg,
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
}));
