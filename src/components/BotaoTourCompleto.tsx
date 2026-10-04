"use client";
import { EVENTO_JORNADA } from "@/components/TourBoasVindas";

/** No rodape do menu: refaz o tour completo de boas-vindas. */
export default function BotaoTourCompleto() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(EVENTO_JORNADA))}
      className="mb-2 block text-xs font-medium text-marca hover:underline"
    >
      Tour completo do sistema
    </button>
  );
}
