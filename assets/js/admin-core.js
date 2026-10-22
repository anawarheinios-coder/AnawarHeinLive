/* Allow PNG, JPG, JPEG, SVG, WebP and GIF uploads. */
document.querySelectorAll('input[type="file"]').forEach(input => {
  if (
    ["home-file", "away-file", "poster-file",
     "banner-file", "player-file"].includes(input.id)
  ) {
    input.accept = ".png,.jpg,.jpeg,.svg,.webp,.gif";
  }
});

/* Replaces the original PNG-only image loader. */
async function png(file, large = false) {
  if (!file) return "";

  if (!/\.(png|jpe?g|svg|webp|gif)$/i.test(file.name)) {
    throw new Error(
      "Choose a PNG, JPG, JPEG, SVG, WebP or GIF image."
    );
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Choose an image under 8 MB.");
  }

  const objectURL = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = objectURL;

    try {
      await image.decode();
    } catch {
      throw new Error(
        "Cannot open this image. SVG files must include their own images and dimensions."
      );
    }

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (!width || !height) {
      throw new Error("This image has no valid dimensions.");
    }

    const limit = large ? 1600 : 192;
    const scale = Math.min(1, limit / Math.max(width, height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Your browser cannot process this image.");
    }

    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const result = canvas.toDataURL("image/png");

    if (result.length > 1400000) {
      throw new Error(
        "Image is too large after resizing. Try a smaller image."
      );
    }

    return result;
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}
