import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Linking } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";
import * as Location from "expo-location";

import { colors, radius, spacing, typography } from "@/src/theme";

export type Pin = { lat: number; lng: number } | null;

type Props = {
  pickup: Pin;
  dropoff: Pin;
  onChange: (next: { pickup: Pin; dropoff: Pin }) => void;
  height?: number;
};

const DEFAULT_REGION: Region = {
  latitude: 24.4539,
  longitude: 54.3773, // Abu Dhabi; a neutral default for a chauffeur app
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

export function MapPicker({ pickup, dropoff, onChange, height = 260 }: Props) {
  const [mode, setMode] = useState<"pickup" | "dropoff">("pickup");
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [locating, setLocating] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permBlocked, setPermBlocked] = useState(false);
  const mapRef = useRef<MapView | null>(null);

  // Center on existing pins if present
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
  }, []); // mount only

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
    } catch {
      // swallow; keep default
    } finally {
      setLocating(false);
    }
  };

  const onMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const next = { lat: latitude, lng: longitude };
    if (mode === "pickup") onChange({ pickup: next, dropoff });
    else onChange({ pickup, dropoff: next });
  };

  return (
    <View
      style={{
        borderRadius: radius.lg,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
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
          }}
        >
          <Text style={{
            color: mode === "pickup" ? colors.onBrandPrimary : colors.onSurfaceTertiary,
            fontWeight: "700",
            fontSize: typography.sm,
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
          }}
        >
          <Text style={{
            color: mode === "dropoff" ? colors.onBrandPrimary : colors.onSurfaceTertiary,
            fontWeight: "700",
            fontSize: typography.sm,
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
            pinColor="#E6C875"
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
            backgroundColor: colors.surfaceTertiary,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            gap: spacing.sm,
            alignItems: "center",
          }}
        >
          {locating ? (
            <ActivityIndicator color={colors.brandPrimary} size="small" />
          ) : null}
          <Text style={{ color: colors.onSurfaceTertiary, fontWeight: "600", fontSize: typography.sm }}>
            Use my location
          </Text>
        </Pressable>
        <Text style={{ color: colors.muted, fontSize: typography.sm, flexShrink: 1 }}>
          Tap the map to drop a pin
        </Text>
      </View>

      {permissionDenied ? (
        <View style={{ padding: spacing.sm, paddingTop: 0 }}>
          <Text style={{ color: colors.muted, fontSize: typography.sm }}>
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
              <Text style={{ color: colors.onBrandPrimary, fontWeight: "700", fontSize: typography.sm }}>
                Open Settings
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
