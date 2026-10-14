import LegalLayout, { Todo } from "../layouts/LegalLayout";
import { SUPPORT_EMAIL } from "../lib/site";

export default function Contact() {
  return (
    <LegalLayout title="Contact">
      {SUPPORT_EMAIL ? (
        <>
          <p>
            For help, feedback, privacy requests or to report a problem, email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
          <p className="muted">
            Please include the email address on your account and, for a chatbot problem, the chatbot's name. Never send
            your password or API keys.
          </p>
        </>
      ) : (
        <div className="alert alert-warn" style={{ margin: "14px 0" }}>
          <div>
            <strong>Support contact not set up yet.</strong> The site owner still needs to add a support address. It
            will show here once configured: <Todo>support email address</Todo>
          </div>
        </div>
      )}
    </LegalLayout>
  );
}
