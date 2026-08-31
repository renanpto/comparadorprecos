const TAMANHO_MAXIMO_LADO = 1800;
const QUALIDADE_JPEG = 0.82;

export interface ImagemComprimida {
  base64: string;
  contentType: string;
}

/**
 * Redimensiona/recomprime uma imagem no browser antes de enviar para a API,
 * já que fotos direto da câmera do celular podem passar do limite de payload
 * síncrono do Lambda (6MB). Também corrige orientação: respeita o EXIF da
 * foto original e, se mesmo assim ainda estiver em modo paisagem, força
 * retrato (girando 90°) — fotos de listas manuscritas são quase sempre
 * verticais, e uma foto deitada atrapalha tanto a leitura da IA quanto a
 * visualização depois.
 */
export async function comprimirImagem(file: File): Promise<ImagemComprimida> {
  if (file.type === "application/pdf") {
    const base64 = await fileParaBase64(file);
    return { base64, contentType: "application/pdf" };
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const escala = Math.min(1, TAMANHO_MAXIMO_LADO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);
  const aindaPaisagem = largura > altura;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem neste navegador.");

  if (aindaPaisagem) {
    // Gira 90° (sentido horário) para forçar retrato.
    canvas.width = altura;
    canvas.height = largura;
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
  } else {
    canvas.width = largura;
    canvas.height = altura;
  }
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
