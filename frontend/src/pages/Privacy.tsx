import { Link } from "react-router-dom";
import LegalLayout from "../layouts/LegalLayout";
import { SUPPORT_EMAIL } from "../lib/site";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        Site2Chat lets account holders create chatbots from websites they submit. This policy describes information
        handled by the service when an owner manages a chatbot or a visitor uses one.
      </p>

      <h2>Information handled by Site2Chat</h2>
      <ul>
        <li>
          <strong>Account and sign-in information.</strong> Registration and sign-in use Supabase Auth in your browser.
          Your email address and password are sent to Supabase Auth; the Site2Chat API receives authentication tokens,
          not your password. Confirmation and password-reset emails are handled through the Supabase project and its
          configured email settings.
        </li>
        <li>
          <strong>Chatbot settings.</strong> We store the chatbot name, optional description, website address, and
          selected AI provider and model.
        </li>
        <li>
          <strong>Website material.</strong> When an owner creates or re-runs a chatbot, Site2Chat reads public pages
          from the submitted website. Each ingestion run is limited to 100 pages on that website. The service stores
          page URLs, titles and extracted text, along with text chunks and embeddings used to find relevant passages.
        </li>
        <li>
          <strong>Chat messages.</strong> A public chatbot visitor can send a question without creating a Site2Chat
          account. We store the question and generated reply with the chatbot's conversation record. The browser keeps a
          random chatbot session identifier in local storage so later messages can be associated with that conversation.
          The chat form does not ask for a visitor's name or email, but a visitor may include personal information in a
          message.
        </li>
        <li>
          <strong>Provider credentials.</strong> If an owner adds an OpenRouter API key, the server encrypts it before
          storing it in the application database. The key is used to call OpenRouter for that owner's chatbots and can
          be removed from Settings. Site2Chat does not display the saved key again.
        </li>
        <li>
          <strong>Browser storage.</strong> Supabase Auth persists the signed-in session in the browser, and Site2Chat
          stores the chatbot session identifier in local storage.
        </li>
        <li>
          <strong>Operational information.</strong> Requests pass through the service's hosting, authentication and
          database providers. Those providers may process technical information such as network and request details.
          The exact fields depend on the deployed providers and their settings.
        </li>
      </ul>

      <h2>How information is used</h2>
      <p>
        Site2Chat uses this information to manage accounts and chatbots, crawl and index submitted websites, retrieve
        relevant website passages, generate chatbot replies, and operate and protect the service. Do not include
        passwords, API keys or other sensitive information in chatbot messages.
      </p>

      <h2>Service providers and disclosures</h2>
      <ul>
        <li>
          <strong>Supabase</strong> provides authentication. Its project settings control account confirmation and
          password-reset email delivery.
        </li>
        <li>
          <strong>Groq</strong> receives the visitor's question and retrieved website context when a chatbot is
          configured to use Groq.
        </li>
        <li>
          <strong>OpenRouter</strong> receives the same prompt when a chatbot is configured to use OpenRouter. The
          selected model provider may also process it through OpenRouter.
        </li>
        <li>
          <strong>Hosting and database providers</strong> process service requests and stored application data. The
          repository's deployment configuration references Render for the API and Vercel for the frontend; the
          production database provider and region are not specified here.
        </li>
      </ul>
      <p>
        These providers process information under their own terms and privacy practices. We may also disclose
        information when required by law or to protect the service, its users or others.
      </p>

      <h2>Storage, deletion and retention</h2>
      <p>
        Deleting a chatbot in the dashboard removes that chatbot and its associated pages, text chunks, conversations
        and messages from the application database. This does not remove an owner's saved OpenRouter key; the owner can
        remove that key separately in Settings. The app does not provide self-service account deletion. To request
        account or personal-data deletion, or to request access or correction, contact{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
      <p>
        The application does not define a time-based retention schedule. Data in provider backups and service logs may
        be subject to separate provider policies; their retention periods and deletion behavior depend on the production
        configuration.
      </p>

      <h2>Your privacy rights</h2>
      <p>
        Privacy rights depend on the laws that apply where you live and on the service operator's circumstances. Contact
        us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to make a privacy request.
      </p>

      <h2>Security</h2>
      <p>
        Owner-only API actions require a valid Supabase authentication token, and saved OpenRouter keys are encrypted
        before database storage using a server-configured encryption key. Other safeguards depend on the deployed
        infrastructure. No online service can promise absolute security.
      </p>

      <h2>Changes and contact</h2>
      <p>
        If this policy changes, the revised text will be published on this page. Questions or privacy requests can be
        sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See also our{" "}
        <Link to="/terms">Terms of Service</Link>.
      </p>
    </LegalLayout>
  );
}
