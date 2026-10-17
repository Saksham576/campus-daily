import { notFound } from "next/navigation";
import { WelcomeWizard } from "@/components/WelcomeWizard";

/** Dev-only: the first-sign-in setup with no sign-in. */
export default function PreviewWelcome() {
  if (process.env.NODE_ENV === "production") notFound();
  return <WelcomeWizard demo />;
}
