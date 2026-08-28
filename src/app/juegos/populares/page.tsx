import { redirect } from "next/navigation";

export default function PopularGamesPage() {
  redirect("/juegos?orden=popular");
}
