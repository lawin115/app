import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Platform,
  TextInput,
} from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { CalendarBlank, Clock } from "phosphor-react-native";

import {
  colors,
  fontFamily,
  radius,
  shadow,
  spacing,
  typography,
} from "@/src/theme";

type Mode = "date" | "time";

type Props = {
  mode: Mode;
  value: Date;
  onChange: (next: Date) => void;
  testID?: string;
};

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function formatDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function formatTime(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

export function DateTimeField({ mode, value, onChange, testID }: Props) {
  const Icon = mode === "date" ? CalendarBlank : Clock;
  const label = mode === "date" ? "Date" : "Time";
  const displayValue = mode === "date" ? formatDate(value) : formatTime(value);
  const [iosOpen, setIosOpen] = useState(false);
  const [temp, setTemp] = useState<Date>(value);

  const openPicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode,
        is24Hour: false,
        onChange: (_e, d) => {
          if (d) onChange(d);
        },
      });
      return;
    }
    if (Platform.OS === "ios") {
      setTemp(value);
      setIosOpen(true);
      return;
    }
    // web: handled by the hidden <input> rendered below
  };

  // ---------- WEB FALLBACK ----------
  if (Platform.OS === "web") {
    const htmlType = mode === "date" ? "date" : "time";
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Icon size={18} color={colors.brandPrimary} weight="fill" />
          <Text style={styles.label}>{label}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.valueTxt}>{displayValue}</Text>
          {/* Hidden native HTML input via RN Web TextInput + web-only type */}
          <TextInput
            testID={testID}
            // @ts-expect-error: react-native-web passes "type" to the DOM input
            type={htmlType}
            value={displayValue}
            onChangeText={(txt) => {
              if (mode === "date") {
                const m = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (!m) return;
                const next = new Date(value);
                next.setFullYear(Number(m[1]));
                next.setMonth(Number(m[2]) - 1);
                next.setDate(Number(m[3]));
                onChange(next);
              } else {
                const m = txt.match(/^(\d{2}):(\d{2})$/);
                if (!m) return;
                const next = new Date(value);
                next.setHours(Number(m[1]));
                next.setMinutes(Number(m[2]));
                onChange(next);
              }
            }}
            style={styles.webInput as any}
          />
        </View>
      </View>
    );
  }

  // ---------- NATIVE (iOS / Android) ----------
  return (
    <>
      <Pressable
        testID={testID}
        onPress={openPicker}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      >
        <View style={styles.header}>
          <Icon size={18} color={colors.brandPrimary} weight="fill" />
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.valueTxt}>{displayValue}</Text>
      </Pressable>

      {Platform.OS === "ios" ? (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={styles.scrim}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Pressable
                  testID={`${testID}-cancel`}
                  onPress={() => setIosOpen(false)}
                  hitSlop={10}
                >
                  <Text style={styles.sheetGhost}>Cancel</Text>
                </Pressable>
                <Text style={styles.sheetTitle}>{label}</Text>
                <Pressable
                  testID={`${testID}-done`}
                  onPress={() => {
                    onChange(temp);
                    setIosOpen(false);
                  }}
                  hitSlop={10}
                >
                  <Text style={styles.sheetPrimary}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={temp}
                mode={mode}
                display="spinner"
                textColor={colors.onSurface}
                onChange={(_e, d) => {
                  if (d) setTemp(d);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = {
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flex: 1,
    ...shadow.sm,
  } as const,
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  } as const,
  label: {
    color: colors.muted,
    fontSize: typography.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: fontFamily.text,
    fontWeight: "600",
  } as const,
  valueTxt: {
    color: colors.onSurface,
    fontSize: typography.lg,
    fontFamily: fontFamily.text,
    fontWeight: "600",
  } as const,
  webInput: {
    position: "absolute",
    inset: 0,
    opacity: 0,
    width: "100%",
    height: "100%",
    cursor: "pointer",
  } as const,
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  } as const,
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  } as const,
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  } as const,
  sheetTitle: {
    color: colors.onSurface,
    fontSize: typography.lg,
    fontWeight: "700",
    fontFamily: fontFamily.text,
  } as const,
  sheetGhost: {
    color: colors.muted,
    fontSize: typography.lg,
    fontFamily: fontFamily.text,
    fontWeight: "600",
  } as const,
  sheetPrimary: {
    color: colors.brandPrimary,
    fontSize: typography.lg,
    fontFamily: fontFamily.text,
    fontWeight: "700",
  } as const,
};
