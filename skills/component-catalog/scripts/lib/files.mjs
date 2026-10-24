// Keep discovery, extraction and snapshot inputs aligned across supported source formats.
export const isSourceFile = (file) => /\.[jt]sx?$/.test(file) && !file.endsWith(".d.ts");
export const isJavaScript = (file) => /\.jsx?$/.test(file);
