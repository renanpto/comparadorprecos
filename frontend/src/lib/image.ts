const TAMANHO_MAXIMO_LADO = 1800;
const QUALIDADE_JPEG = 0.82;

export interface ImagemComprimida {
  base64: string;
  contentType: string;
}

/**
 * Redimensiona/recomprime uma imagem no browser antes de enviar para a API,
 * já que fotos direto da câmera do celular podem passar do limite de payload
 * síncrono do Lambda (6MB).
 */
export async function comprimirImagem(file: File): Promise<ImagemComprimida> {
  if (file.type === "application/pdf") {
    const base64 = await fileParaBase64(file);
    return { base64, contentType: "application/pdf" };
  }

  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, TAMANHO_MAXIMO_LADO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem neste navegador.");
  ctx.drawImage(bitmap, 0, 0, largura, altura);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALIDADE_JPEG)
  );
  if (!blob) throw new Error("Não foi possível comprimir a imagem.");

  const base64 = await blobParaBase64(blob);
  return { base64, contentType: "image/jpeg" };
}

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(blob);
  });
}

function fileParaBase64(file: File): Promise<string> {
  return blobParaBase64(file);
}
