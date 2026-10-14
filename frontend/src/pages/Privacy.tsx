import { Link } from "react-router-dom";
import LegalLayout, { DraftNotice, Todo } from "../layouts/LegalLayout";
import { OPERATOR_NAME, SUPPORT_EMAIL } from "../lib/site";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy">
      <p className="muted">
        Effective date: <Todo>date this policy takes effect</Todo>
      </p>
      <DraftNotice />

      <h2>Who runs Site2Chat</h2>
      <p>
        Site2Chat turns a website you point it at into a chatbot. It is operated by{" "}
        {OPERATOR_NAME || <Todo>legal name and postal address of the operator</Todo>}. Questions about this policy:{" "}
        {SUPPORT_EMAIL ? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> : <Link to="/contact">contact page</Link>}.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details.</strong> Your email address and password. Sign-in is handled by our authentication
          provider, Supabase; passwords are stored by them in hashed form and are never visible to us.
        </li>
        <li>
          <strong>Chatbot details you enter.</strong> The chatbot name, optional description and website address.
        </li>
        <li>
          <strong>Website content.</strong> When you create a chatbot we read pages from the website you provide (up to
          100 pages), then store the text of those pages and numeric representations of it (embeddings) so the chatbot
          can find relevant passages.
        </li>
        <li>
          <strong>AI provider settings.</strong> Which provider and model a chatbot uses. If you add an OpenRouter API
          key, it is stored encrypted on our server and used only to run your chatbots.
        </li>
        <li>
          <strong>Visitor conversations.</strong> Messages sent to a chatbot and its replies are stored and linked to
          that chatbot and to a random session identifier that the visitor's browser keeps in local storage. We do not
          ask visitors for their name or email.
        </li>
        <li>
          <strong>Technical data.</strong> Our hosting providers keep ordinary server logs, which can include IP
          addresses and request details.
        </li>
        <li>
          <strong>Browser storage.</strong> Your signed-in session and the chat session identifier are kept in your
          browser's local storage. We have not added advertising or analytics trackers.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        To run your account, create and answer from your chatbots, send account emails such as confirmation and
        password reset messages, keep the service secure, and fix problems. We do not sell personal data.
      </p>

      <h2>Who we share it with</h2>
      <p>These providers process data on our behalf to run the service:</p>
      <ul>
        <li>Supabase: authentication (and email sending unless a separate provider is set up).</li>
        <li>Render: hosts the Site2Chat API. Vercel: hosts this website.</li>
        <li>
          Our database provider: <Todo>name and region of the database host</Todo>.
        </li>
        <li>
          Groq: when a chatbot uses Groq, the visitor's question and relevant excerpts of your website are sent to Groq
          to generate the reply.
        </li>
        <li>
          OpenRouter and the model provider you choose through it: the same data, only when you select OpenRouter.
          Their terms and billing apply to that use.
        </li>
        <li>
          Email delivery provider: <Todo>name of the SMTP provider, once configured</Todo>.
        </li>
      </ul>
      <p>We may also disclose information when the law requires it or to protect the service and its users.</p>

      <h2>Keeping and deleting data</h2>
      <p>
        Deleting a chatbot from your dashboard removes that chatbot together with its stored pages, embeddings and
        conversations. There is currently no self-service way to delete your whole account; to request it, contact us.
        Server logs and backups are kept by our providers for their own retention periods:{" "}
        <Todo>retention periods once confirmed</Todo>.
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can ask us to access, correct or delete your personal data by contacting us. Depending on where you live,
        you may have additional legal rights: <Todo>rights and legal bases that apply in the operator's jurisdiction</Todo>.
      </p>

      <h2>Security</h2>
      <p>
        Traffic to Site2Chat uses HTTPS, and stored provider API keys are encrypted. No system is completely secure, so
        we cannot guarantee absolute security.
      </p>

      <h2>Children</h2>
      <p>Site2Chat is not directed at children, and we do not knowingly collect their personal data.</p>

      <h2>Changes</h2>
      <p>If we change this policy we will update this page and its effective date.</p>
    </LegalLayout>
  );
}
