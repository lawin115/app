// Design tokens for LuxeDrive. Dark luxe theme matching design_guidelines.json.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  // Surfaces
  surface: "#09090B",
  onSurface: "#FAFAFA",
  surfaceSecondary: "#18181B",
  onSurfaceSecondary: "#E4E4E7",
  surfaceTertiary: "#27272A",
  onSurfaceTertiary: "#D4D4D8",
  surfaceInverse: "#FAFAFA",
  onSurfaceInverse: "#09090B",
  muted: "#A1A1AA",

  // Brand
  brand: "#C5A059",
  onBrand: "#09090B",
  brandPrimary: "#C5A059",
  onBrandPrimary: "#09090B",
  brandSecondary: "#E6C875",
  onBrandSecondary: "#09090B",
  brandTertiary: "#3F331C",
  onBrandTertiary: "#E6C875",

  // Status
  success: "#2E4E3F",
  onSuccess: "#A7F3D0",
  warning: "#5C4015",
  onWarning: "#FDE68A",
  error: "#5C1D1D",
  onError: "#FECACA",
  info: "#1E3A5F",
  onInfo: "#BFDBFE",

  // Lines
  border: "#27272A",
  borderStrong: "#3F3F46",
  divider: "#27272A",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light?: ThemeColors; dark: ThemeColors } = { dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.light ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "dark" && themes.dark) ? "dark" : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.dark };
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
  pill: 999,
};

export const typography = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
};

// Convenience export for places that cannot use the hook.
export const colors = dark;
