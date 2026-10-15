import { Link } from "react-router-dom";
import LegalLayout from "../layouts/LegalLayout";
import { SUPPORT_EMAIL } from "../lib/site";

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service">
      <p>
        These terms apply when you create a Site2Chat account, manage a chatbot or use a public chatbot. If you do not
        agree to them, do not use the service. Our <Link to="/privacy">Privacy Policy</Link> explains how information is
        handled.
      </p>

      <h2>What Site2Chat does</h2>
      <p>
        Site2Chat reads public pages from a website an account holder submits, then creates a chatbot that answers
        questions using that website's content. A chatbot can be shared through a link or an embedded widget. An
        ingestion run is limited to 100 pages on the submitted website. Features may change, and the service may
        sometimes be unavailable.
      </p>

      <h2>Your account</h2>
      <p>
        Accounts use Supabase Auth. Email confirmation and password-reset flows are provided through the configured
        Supabase project; whether confirmation is required depends on that project's settings. Keep your sign-in details
        secure and contact us if you suspect unauthorised access. You are responsible for activity carried out through
        your account, subject to rights that cannot be limited by law.
      </p>

      <h2>Websites, content and visitors</h2>
      <ul>
        <li>
          Submit only websites and material that you own or are authorised to access, crawl, process and use this way.
        </li>
        <li>
          You keep your rights in your content. You allow Site2Chat to retrieve, store and process it as needed to
          create, operate and answer from your chatbot.
        </li>
        <li>
          You are responsible for the chatbot you publish and for giving its visitors any notices or choices required
          by law. Visitor questions and generated replies are stored and may be sent to the AI provider selected for the
          chatbot.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        Do not use Site2Chat unlawfully, infringe another person's rights, send spam or malware, access systems without
        permission, probe or overload the service or other websites, or mislead visitors about the chatbot or the
        information it provides.
      </p>

      <h2>AI providers, answers and costs</h2>
      <p>
        Site2Chat currently supports Groq and OpenRouter. Groq uses a platform-configured key. OpenRouter requires an
        account holder's own key and selected model; OpenRouter usage is subject to its terms and charges. The AI
        provider receives the visitor's question and relevant website text to generate a reply. If OpenRouter is used,
        its selected model provider may also process that information. Provider availability, model access and costs
        depend on the provider and service configuration.
      </p>
      <p>
        AI replies may be incomplete, inaccurate or outdated. Review replies before sharing them, and do not rely on
        them for legal, medical, financial or safety decisions.
      </p>

      <h2>Availability and legal rights</h2>
      <p>
        The service and its features may change or be interrupted. Nothing in these terms excludes a right or remedy
        that cannot legally be excluded or limited.
      </p>

      <h2>Deletion and suspension</h2>
      <p>
        You can delete chatbots from your dashboard. The app does not currently provide self-service account deletion;
        contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to request account closure or deletion of
        personal data. We may restrict or suspend use to address a breach of these terms or protect the service, subject
        to applicable law.
      </p>

      <p>
        We may update these terms; the current text will appear on this page. For questions, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or visit the <Link to="/contact">contact page</Link>.
      </p>
    </LegalLayout>
  );
}
