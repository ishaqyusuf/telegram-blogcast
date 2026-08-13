type PdfComponent = typeof import("react-native-pdf").default;

type PdfModule = {
  default?: PdfComponent;
};

type ReactNativeModule = typeof import("react-native");

export type OptionalPdfComponentResult =
  | { Component: PdfComponent; error: null }
  | { Component: null; error: unknown };

function getReactNativeModule() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("react-native") as ReactNativeModule;
}

function importPdfModule() {
  // Metro must defer this native module until the PDF route is mounted.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("react-native-pdf") as PdfModule;
}

function hasNativePdfDependencies() {
  const { TurboModuleRegistry, UIManager } = getReactNativeModule();

  return Boolean(
    TurboModuleRegistry.get("ReactNativeBlobUtil") &&
    UIManager.getViewManagerConfig("RNPDFPdfView"),
  );
}

export function loadOptionalPdfComponent(
  importPdf: () => PdfModule = importPdfModule,
  nativeDependenciesAvailable: () => boolean = hasNativePdfDependencies,
): OptionalPdfComponentResult {
  if (!nativeDependenciesAvailable()) {
    return {
      Component: null,
      error: new Error("The native PDF dependencies are unavailable."),
    };
  }

  try {
    const Component = importPdf().default;
    if (!Component) {
      return {
        Component: null,
        error: new Error("The native PDF component is unavailable."),
      };
    }

    return { Component, error: null };
  } catch (error) {
    return { Component: null, error };
  }
}
