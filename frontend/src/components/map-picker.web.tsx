import { View, Text } from "react-native";
import { colors, radius, spacing, typography } from "@/src/theme";

export type Pin = { lat: number; lng: number } | null;
export type PinMode = "pickup" | "dropoff";

type Props = {
  pickup: Pin;
  dropoff: Pin;
  onChange: (next: { pickup: Pin; dropoff: Pin }) => void;
  onAddressResolved?: (which: PinMode, address: string) => void;
  height?: number;
};

// Web stub: react-native-maps is not supported on web.
// Users on the web preview can still enter addresses via the text fields.
export function MapPicker(_props: Props) {
  return (
    <View
      style={{
        borderRadius: radius.lg,
        padding: spacing.lg,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
      testID="map-picker-web-stub"
    >
      <Text style={{ color: colors.onSurfaceSecondary, fontWeight: "700", fontSize: typography.lg }}>
        Map picker available on mobile
      </Text>
      <Text style={{ color: colors.muted, marginTop: spacing.xs, fontSize: typography.sm }}>
        Open the app in Expo Go (scan the QR) to drop pickup and drop-off pins on the map. On web, use the address fields below.
      </Text>
    </View>
  );
}
