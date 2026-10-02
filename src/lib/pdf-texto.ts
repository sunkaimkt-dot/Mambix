/**
 * Texto de um PDF, linha a linha, no navegador (pdf.js).
 *
 * O pdf.js entrega pedacos de texto soltos com a posicao de cada um. Aqui eles
 * sao juntados em linhas pela altura (y) e ordenados da esquerda para a
 * direita -- e assim que um extrato "parece" quando aberto. PDF escaneado
 * (imagem) nao tem texto: volta lista vazia e a tela explica.
 */
export async function linhasDoPDF(arquivo: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const linhas: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const conteudo = await pagina.getTextContent();
    type Pedaco = { x: number; y: number; t: string };
    const pedacos: Pedaco[] = [];
    for (const it of conteudo.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      pedacos.push({ x: it.transform[4], y: it.transform[5], t: it.str });
    }
    // Agrupa por linha: tolerancia de 2,5pt na altura.
    pedacos.sort((a, b) => b.y - a.y || a.x - b.x);
    let atual: Pedaco[] = [];
    let yAtual: number | null = null;
    const fecha = () => {
      if (atual.length) linhas.push(atual.sort((a, b) => a.x - b.x).map((q) => q.t).join(" "));
      atual = [];
    };
    for (const q of pedacos) {
      if (yAtual === null || Math.abs(q.y - yAtual) > 2.5) { fecha(); yAtual = q.y; }
      atual.push(q);
    }
    fecha();
  }
  await doc.destroy();
  return linhas;
}
