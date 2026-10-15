import LegalLayout from "../layouts/LegalLayout";
import { SUPPORT_EMAIL } from "../lib/site";

export default function Contact() {
  return (
    <LegalLayout title="Contact">
      <p>
        For help, feedback, privacy requests or to report a problem, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
      <p className="muted">
        Please include the email address on your account and, for a chatbot problem, the chatbot's name. Never send your
        password or API keys.
      </p>
    </LegalLayout>
  );
}
