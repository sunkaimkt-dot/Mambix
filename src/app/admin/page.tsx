import { redirect } from "next/navigation";

/* A antiga porta da plataforma. O login agora fica na raiz; quem tiver o
   endereco antigo salvo cai no lugar certo. */
export default function Admin() {
  redirect("/");
}
