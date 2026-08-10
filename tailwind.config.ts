import type { Config } from "tailwindcss";

/* As cores da marca sao variaveis CSS porque mudam a cada requisicao: o mesmo
   HTML serve a Mambix e ao proximo consultor. Classe fixa do Tailwind nao daria
   conta -- por isso `bg-marca` aponta para var(--marca), e o layout troca o
   valor da variavel conforme a empresa aberta. */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        marca: {
          DEFAULT: "var(--marca)",
          clara: "var(--marca-clara)",
          escura: "var(--marca-escura)",
          contraste: "var(--marca-contraste)",
        },
        positivo: "var(--positivo)",
        negativo: "var(--negativo)",
      },
    },
  },
  plugins: [],
};
export default config;
