import type { HomeHeroDevice, HomeHeroPresentation, HomeHeroBasePresentation } from "@/data/home-config";

export function resolveHeroDeviceDesign(presentation: HomeHeroPresentation, device: HomeHeroDevice): HomeHeroBasePresentation {
  if (presentation.deviceOverrides?.[device]) return presentation.deviceOverrides[device];
  const { deviceOverrides: _overrides, ...base } = presentation;
  void _overrides;
  return base;
}

export function updateHeroDeviceDesign(
  presentation: HomeHeroPresentation,
  scope: HomeHeroDevice | "all",
  update: (design: HomeHeroBasePresentation) => HomeHeroPresentation,
  sourceDevice: HomeHeroDevice = "desktop",
): HomeHeroPresentation {
  const base = resolveHeroDeviceDesign({ ...presentation, deviceOverrides: undefined }, "desktop");
  const sharedChanges: Partial<Record<"responsive" | "navigation", Record<string, unknown>>> = {};
  if (scope === "all") {
    const source = resolveHeroDeviceDesign(presentation, sourceDevice);
    const updated = update(structuredClone(source));
    for (const key of ["responsive", "navigation"] as const) {
      const before = key === "responsive" ? source.responsive : source.navigation.responsive;
      const after = key === "responsive" ? updated.responsive : updated.navigation.responsive;
      const changed = (["desktop", "tablet", "mobile"] as const).filter(device => JSON.stringify(before[device]) !== JSON.stringify(after[device]));
      if (changed.length === 1 && changed[0] === sourceDevice) {
        sharedChanges[key] = Object.fromEntries(
          Object.entries(after[sourceDevice]).filter(
            ([field, value]) => JSON.stringify(value) !== JSON.stringify((before[sourceDevice] as unknown as Record<string, unknown>)[field])
          )
        );
      }
    }
  }
  const cleanUpdate = (design: HomeHeroBasePresentation) => {
    const result = update(structuredClone(design));
    const clean = resolveHeroDeviceDesign({ ...result, deviceOverrides: undefined }, "desktop");
    if (scope === "all") {
      for (const key of ["responsive", "navigation"] as const) {
        const after = key === "responsive" ? clean.responsive : clean.navigation.responsive;
        if (sharedChanges[key]) {
          for (const device of ["desktop", "tablet", "mobile"] as const) {
            Object.assign(after[device], sharedChanges[key]);
          }
        }
      }
    }
    return clean;
  };
  if (scope !== "all") {
    return { ...presentation, deviceOverrides: {
      ...presentation.deviceOverrides,
      [scope]: cleanUpdate(resolveHeroDeviceDesign(presentation, scope)),
    } };
  }
  const next: HomeHeroPresentation = cleanUpdate(base);
  if (presentation.deviceOverrides) {
    next.deviceOverrides = {};
    for (const device of ["desktop", "tablet", "mobile"] as const) {
      if (presentation.deviceOverrides[device]) next.deviceOverrides[device] = cleanUpdate(presentation.deviceOverrides[device]);
    }
  }
  return next;
}