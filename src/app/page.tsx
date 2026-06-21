import { redirect } from "next/navigation";

export default function Home() {
  // Single-clinic app: send everyone to login. Dashboard routing lands once auth is wired.
  redirect("/login");
}
