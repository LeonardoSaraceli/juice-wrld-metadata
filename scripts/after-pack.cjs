const path = require("node:path");

module.exports = async function applyWindowsResources(context) {
  if (context.electronPlatformName !== "win32") return;

  const { rcedit } = await import("rcedit");
  const productName = context.packager.appInfo.productName;
  const executablePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, "assets", "icon.ico");
  const version = context.packager.appInfo.version;

  await rcedit(executablePath, {
    icon: iconPath,
    "file-version": version,
    "product-version": version,
    "version-string": {
      FileDescription: productName,
      ProductName: productName,
      InternalName: productName,
      OriginalFilename: `${productName}.exe`,
      CompanyName: "Leonardo Lodi",
      LegalCopyright: `Copyright © ${new Date().getFullYear()} Leonardo Lodi`
    }
  });
};
