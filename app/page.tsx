import { redirect } from "next/navigation";

// Redirect til demo-prosjektet
export default function Home() {
  redirect("/klp-eiendom/ferjemannsveien-10");
}
