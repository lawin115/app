// Design tokens for LuxeDrive. Light Premium (white + gold) theme.
import { useMemo } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#FBF9F6",
  onSurface: "#1C1B1A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#2C2A29",
  surfaceTertiary: "#F2EFEA",
  onSurfaceTertiary: "#4A4744",
  surfaceInverse: "#181715",
  onSurfaceInverse: "#FBF9F6",
  muted: "#827D78",

  // Brand (gold)
  brand: "#C6A87C",
  onBrand: "#FFFFFF",
  brandPrimary: "#C6A87C",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E8D5B7",
  onBrandSecondary: "#4A3C24",
  brandTertiary: "#F6F0E4",
  onBrandTertiary: "#8A6B3D",

  // Status
  success: "#437963",
  onSuccess: "#FFFFFF",
  warning: "#D99B4A",
  onWarning: "#FFFFFF",
  error: "#B54D4A",
  onError: "#FFFFFF",
  info: "#5E7A91",
  onInfo: "#FFFFFF",

  // Lines
  border: "#EBE5DC",
  borderStrong: "#D1C7B8",
  divider: "#F2EFEA",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const typography = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
};

// Display (serif) and text (sans) font families. We use system fonts for
// zero-config premium feel — Georgia on iOS / Web, "serif" on Android.
export const fontFamily = {
  display: Platform.select({
    ios: "Georgia",
    android: "serif",
    web: 'Georgia, "Times New Roman", serif',
    default: "serif",
  }) as string,
  text: Platform.select({
    ios: "System",
    android: "sans-serif",
    web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    default: "System",
  }) as string,
};

export const shadow = {
  sm: {
    shadowColor: "#1C1B1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: "#1C1B1A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  lg: {
    shadowColor: "#1C1B1A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const colors = light;
