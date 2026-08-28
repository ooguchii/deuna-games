import { redirect } from "next/navigation";

export default function LowSpecGamesPage() {
  redirect("/juegos?equipo=lowSpec");
}
