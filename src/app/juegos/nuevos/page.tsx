import { redirect } from "next/navigation";

export default function NewGamesPage() {
  redirect("/juegos?estado=recent&orden=recientes");
}
