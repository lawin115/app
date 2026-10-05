import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Linking } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";
import * as Location from "expo-location";

import { colors, fontFamily, radius, spacing, typography } from "@/src/theme";

export type Pin = { lat: number; lng: number } | null;
export type PinMode = "pickup" | "dropoff";

type Props = {
  pickup: Pin;
  dropoff: Pin;
  onChange: (next: { pickup: Pin; dropoff: Pin }) => void;
  onAddressResolved?: (which: PinMode, address: string) => void;
  height?: number;
};

const DEFAULT_REGION: Region = {
  latitude: 24.4539,
  longitude: 54.3773,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

function formatAddress(item: Location.LocationGeocodedAddress): string {
  // Try to build a human-readable one-liner from the first result.
  const parts = [
    item.name,
    item.street,
    item.district,
    item.city,
    item.region,
    item.country,
  ].filter(Boolean) as string[];
  // dedupe consecutive duplicates (e.g. name === street)
  const dedup: string[] = [];
  for (const p of parts) {
    if (!dedup.includes(p)) dedup.push(p);
  }
  return dedup.join(", ");
}

export function MapPicker({ pickup, dropoff, onChange, onAddressResolved, height = 260 }: Props) {
  const [mode, setMode] = useState<PinMode>("pickup");
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [locating, setLocating] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permBlocked, setPermBlocked] = useState(false);
  const [resolving, setResolving] = useState<PinMode | null>(null);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    const target = pickup || dropoff;
    if (target) {
      setRegion({
        latitude: target.lat,
        longitude: target.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  }, []);

  const resolve = async (which: PinMode, lat: number, lng: number) => {
    if (!onAddressResolved) return;
    try {
      setResolving(which);
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results && results.length > 0) {
        const line = formatAddress(results[0]);
        if (line) onAddressResolved(which, line);
      }
    } catch {
      // ignore — keep whatever text the user had
    } finally {
      setResolving(null);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;
      let canAskAgain = existing.canAskAgain;
      if (status !== "granted") {
        if (!canAskAgain) {
          setPermBlocked(true);
          return;
        }
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
        canAskAgain = req.canAskAgain;
      }
      if (status !== "granted") {
        setPermissionDenied(true);
        setPermBlocked(!canAskAgain);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      const nextRegion = {
        latitude: next.lat,
        longitude: next.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 400);
      if (mode === "pickup") onChange({ pickup: next, dropoff });
      else onChange({ pickup, dropoff: next });
      resolve(mode, next.lat, next.lng);
    } catch {
      // swallow
    } finally {
      setLocating(false);
    }
  };

  const onMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const next = { lat: latitude, lng: longitude };
    if (mode === "pickup") onChange({ pickup: next, dropoff });
    else onChange({ pickup, dropoff: next });
    resolve(mode, latitude, longitude);
  };

  return (
    <View
      style={{
        borderRadius: radius.lg,
        overflow: "hidden",
        backgroundColor: colors.surfaceSecondary,
      }}
      testID="map-picker"
    >
      <View style={{ flexDirection: "row", padding: spacing.sm, gap: spacing.sm }}>
        <Pressable
          testID="map-mode-pickup"
          onPress={() => setMode("pickup")}
          style={{
            flex: 1,
            paddingVertical: spacing.sm,
            borderRadius: radius.pill,
            backgroundColor: mode === "pickup" ? colors.brandPrimary : colors.surfaceTertiary,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: spacing.xs,
          }}
        >
          {resolving === "pickup" ? (
            <ActivityIndicator
              size="small"
              color={mode === "pickup" ? colors.onBrandPrimary : colors.brandPrimary}
            />
          ) : null}
          <Text style={{
            color: mode === "pickup" ? colors.onBrandPrimary : colors.onSurfaceTertiary,
            fontWeight: "700",
            fontSize: typography.sm,
            fontFamily: fontFamily.text,
          }}>
            Set pickup
          </Text>
        </Pressable>
        <Pressable
          testID="map-mode-dropoff"
          onPress={() => setMode("dropoff")}
          style={{
            flex: 1,
            paddingVertical: spacing.sm,
            borderRadius: radius.pill,
            backgroundColor: mode === "dropoff" ? colors.brandPrimary : colors.surfaceTertiary,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: spacing.xs,
          }}
        >
          {resolving === "dropoff" ? (
            <ActivityIndicator
              size="small"
              color={mode === "dropoff" ? colors.onBrandPrimary : colors.brandPrimary}
            />
          ) : null}
          <Text style={{
            color: mode === "dropoff" ? colors.onBrandPrimary : colors.onSurfaceTertiary,
            fontWeight: "700",
            fontSize: typography.sm,
            fontFamily: fontFamily.text,
          }}>
            Set drop-off
          </Text>
        </Pressable>
      </View>

      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={{ width: "100%", height }}
        initialRegion={region}
        onPress={onMapPress}
        testID="map-view"
      >
        {pickup ? (
          <Marker
            coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
            pinColor={colors.brandPrimary}
            title="Pickup"
          />
        ) : null}
        {dropoff ? (
          <Marker
            coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }}
            pinColor={colors.success}
            title="Drop-off"
          />
        ) : null}
      </MapView>

      <View style={{ padding: spacing.sm, flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
        <Pressable
          testID="map-use-my-location"
          onPress={useMyLocation}
          disabled={locating}
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.pill,
            backgroundColor: colors.brandTertiary,
            flexDirection: "row",
            gap: spacing.sm,
            alignItems: "center",
          }}
        >
          {locating ? <ActivityIndicator color={colors.brandPrimary} size="small" /> : null}
          <Text style={{
            color: colors.onBrandTertiary,
            fontWeight: "700",
            fontSize: typography.sm,
            fontFamily: fontFamily.text,
          }}>
            Use my location
          </Text>
        </Pressable>
        <Text style={{
          color: colors.muted,
          fontSize: typography.sm,
          flexShrink: 1,
          fontFamily: fontFamily.text,
        }}>
          Tap the map to drop a pin
        </Text>
      </View>

      {permissionDenied ? (
        <View style={{ padding: spacing.sm, paddingTop: 0 }}>
          <Text style={{ color: colors.muted, fontSize: typography.sm, fontFamily: fontFamily.text }}>
            Location permission denied. You can still tap the map to pick a point.
          </Text>
          {permBlocked ? (
            <Pressable
              testID="open-settings-button"
              onPress={() => Linking.openSettings()}
              style={{
                marginTop: spacing.sm,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.pill,
                backgroundColor: colors.brandPrimary,
                alignSelf: "flex-start",
              }}
            >
              <Text style={{
                color: colors.onBrandPrimary,
                fontWeight: "700",
                fontSize: typography.sm,
                fontFamily: fontFamily.text,
              }}>
                Open Settings
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
